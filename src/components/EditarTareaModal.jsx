import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { X, Save, RefreshCw, CalendarClock, Sparkles } from 'lucide-react'
import { getFeriadosDelAnio, ajustarAlDiaHabilSiguiente } from '../lib/feriados'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function EditarTareaModal({ tarea, onClose, cicloId }) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [nombre,       setNombre]       = useState(tarea.nombre_tarea)
  const [area,         setArea]         = useState(tarea.area ?? '')
  const [observaciones,setObservaciones]= useState(tarea.observaciones ?? '')
  const [responsableId,setResponsableId]= useState(tarea.responsable_id ?? '')
  const [fechaTermino, setFechaTermino] = useState(tarea.fecha_termino)
  const [diaHabilFijo, setDiaHabilFijo] = useState(tarea.condicion === 'habil')
  const [diaHabilNum,  setDiaHabilNum]  = useState(
    tarea.condicion === 'habil' ? String(tarea.dia_del_mes ?? '') : ''
  )
  const [propagarSerie, setPropagar]    = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  const esSerie = !!tarea.serie_id

  // Ciclo actual para cálculo de fechas
  const mesCiclo  = tarea.mes  ?? new Date().getMonth() + 1
  const anioCiclo = tarea.anio ?? new Date().getFullYear()

  const feriadosCiclo    = getFeriadosDelAnio(anioCiclo)
  const feriadosAntCiclo = getFeriadosDelAnio(anioCiclo - 1)
  const feriadosComb     = new Set([...feriadosCiclo, ...feriadosAntCiclo])
  const nombreMesCiclo   = `${MESES[mesCiclo - 1]} ${anioCiclo}`

  // Usuarios del departamento para selector de responsable
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-depto', tarea.departamento],
    enabled: profile?.rol === 'admin' || profile?.rol === 'gerente',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .eq('departamento', tarea.departamento)
        .order('nombre')
      if (error) throw error
      return data ?? []
    }
  })

  // Tareas futuras de la serie para preview de propagación
  const [tareasSeriePreview, setTareasSeriePreview] = useState([])
  useEffect(() => {
    if (!esSerie) return
    supabase
      .from('tasks')
      .select('id, nombre_tarea, fecha_termino, fecha_inicio')
      .eq('serie_id', tarea.serie_id)
      .eq('ciclo_id', tarea.ciclo_id)
      .neq('id', tarea.id)
      .gt('fecha_inicio', new Date().toISOString().split('T')[0])
      .order('fecha_termino', { ascending: true })
      .then(({ data }) => setTareasSeriePreview(data ?? []))
  }, [tarea.serie_id])

  // Recalcular fecha cuando cambia día hábil
  useEffect(() => {
    if (!diaHabilFijo || !diaHabilNum) return
    const num = parseInt(diaHabilNum)
    if (isNaN(num) || num < 1 || num > 31) return
    try {
      const fechaBase = new Date(anioCiclo, mesCiclo - 1, num, 12, 0, 0)
      const fecha     = ajustarAlDiaHabilSiguiente(fechaBase, feriadosComb)
      setFechaTermino(fecha.toISOString().split('T')[0])
    } catch (e) {}
  }, [diaHabilFijo, diaHabilNum])

  // Badge por tipo
  const tipoBadge = tarea.tipo === 'cierre'
    ? { label: 'Cierre',      color: 'bg-blue-900 text-blue-300',   icono: <RefreshCw className="w-3 h-3" /> }
    : tarea.tipo === 'recurrente_mes'
    ? { label: 'Recurrente',  color: 'bg-purple-900 text-purple-300', icono: <CalendarClock className="w-3 h-3" /> }
    : { label: 'Puntual',     color: 'bg-amber-900 text-amber-300',  icono: <Sparkles className="w-3 h-3" /> }

  async function handleGuardar(e) {
    e.preventDefault()
    if (!nombre.trim())  { setError('El nombre es obligatorio'); return }
    if (!fechaTermino)   { setError('La fecha es obligatoria'); return }
    if (diaHabilFijo && !diaHabilNum) { setError('Ingresa el número de día hábil'); return }

    setLoading(true)
    setError('')

    try {
      const cambios = {
        nombre_tarea:   nombre.trim(),
        area:           area || 'General',
        observaciones:  observaciones.trim() || null,
        responsable_id: responsableId || tarea.responsable_id,
        fecha_termino:  fechaTermino,
        condicion:      diaHabilFijo ? 'habil' : 'dia_real',
      }

      // 1. Actualizar tarea actual
      const { error: err } = await supabase
        .from('tasks')
        .update(cambios)
        .eq('id', tarea.id)
      if (err) throw err

      // 2. Propagar a tareas futuras de la serie si corresponde
      if (esSerie && propagarSerie && tareasSeriePreview.length > 0) {
        const ids = tareasSeriePreview.map(t => t.id)
        await supabase
          .from('tasks')
          .update({
            nombre_tarea:   cambios.nombre_tarea,
            area:           cambios.area,
            observaciones:  cambios.observaciones,
            responsable_id: cambios.responsable_id,
          })
          .in('id', ids)
      }

      // 3. Actualizar plantilla si tiene template_id
      if (tarea.template_id) {
        const cambiosPlantilla = {
          nombre_tarea:   cambios.nombre_tarea,
          area:           cambios.area,
          responsable_id: cambios.responsable_id,
          condicion:      cambios.condicion,
        }
        if (diaHabilFijo && diaHabilNum) {
          cambiosPlantilla.dia_del_mes = parseInt(diaHabilNum)
        }
        await supabase
          .from('task_templates')
          .update(cambiosPlantilla)
          .eq('id', tarea.template_id)
      }

      queryClient.invalidateQueries({ queryKey: ['tareas', cicloId] })
      onClose()
    } catch (err) {
      setError('Error al guardar, intenta de nuevo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">Editar tarea</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tipoBadge.color}`}>
                {tipoBadge.icono}
                {tipoBadge.label}
              </span>
              {esSerie && (
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  Serie
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Nombre de la tarea <span className="text-red-400">*</span>
            </label>
            <input
              type="text" value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Área */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Área</label>
            <input
              type="text" value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="Ej: Cartografía, Pensiones..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Responsable */}
          {(profile?.rol === 'admin' || profile?.rol === 'gerente') && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              {!reasignando ? (
                <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-white text-sm font-medium">{tarea.responsable_nombre}</p>
                    <p className="text-gray-500 text-xs">{tarea.responsable_cargo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReasignando(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Reasignar
                </button>
              </div>
            ) : (
              <select
                value={responsableId}
                onChange={e => setResponsableId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-300
                           rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Seleccionar responsable...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} — {u.cargo}</option>
                ))}
              </select>
            )}
          </div>
        )}

          {/* Día hábil fijo — solo si no es serie semanal/quincenal */}
          {!esSerie && (
            <>
              <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer border transition
                ${diaHabilFijo
                  ? 'bg-blue-950/40 border-blue-700'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
              >
                <input
                  type="checkbox" checked={diaHabilFijo}
                  onChange={e => { setDiaHabilFijo(e.target.checked); if (!e.target.checked) setDiaHabilNum('') }}
                  className="mt-0.5 w-4 h-4 accent-blue-500 shrink-0"
                />
                <div>
                  <p className="text-sm text-white">Tarea con día hábil definido</p>
                  <p className="text-xs text-gray-500">La fecha se ajustará automáticamente cada mes</p>
                </div>
              </label>

              {diaHabilFijo && (
                <div className="bg-blue-950/20 border border-blue-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-1">
                        Día del mes <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number" min="1" max="31"
                        value={diaHabilNum}
                        onChange={e => setDiaHabilNum(e.target.value)}
                        placeholder="Ej: 8"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                                   text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-1">Fecha calculada</label>
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
                        <p className="text-white text-sm">
                          {fechaTermino || <span className="text-gray-600">—</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                  {fechaTermino && (
                    <p className="text-xs text-blue-400">
                      📅 Calculada para {nombreMesCiclo}. Si cae en finde o feriado se ajusta al siguiente hábil.
                    </p>
                  )}
                </div>
              )}

              {!diaHabilFijo && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Fecha de término <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date" value={fechaTermino}
                    onChange={e => setFechaTermino(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              )}
            </>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Contexto o detalles adicionales..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          {/* Propagación a serie */}
          {esSerie && tareasSeriePreview.length > 0 && (
            <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer border transition
              ${propagarSerie
                ? 'bg-purple-950/40 border-purple-700'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
            >
              <input
                type="checkbox" checked={propagarSerie}
                onChange={e => setPropagar(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-500 shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">Aplicar cambios a tareas siguientes</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Se actualizarán {tareasSeriePreview.length} tarea{tareasSeriePreview.length > 1 ? 's' : ''} futuras de esta serie
                </p>
                {propagarSerie && (
                  <div className="mt-2 space-y-1">
                    {tareasSeriePreview.map(t => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-xs text-purple-300">{t.fecha_termino}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </label>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                         py-2.5 rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700
                         hover:bg-green-600 text-white py-2.5 rounded-xl text-sm
                         font-semibold transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
