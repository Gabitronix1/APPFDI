import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X, Plus, RefreshCw, Sparkles, CalendarClock } from 'lucide-react'
import { getFeriadosDelAnio, ajustarAlDiaHabilSiguiente } from '../lib/feriados'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function NuevaTareaModal({ cicloSeleccionado, onClose, onCreada, departamentoForzado }) {
  const { user, profile } = useAuth()

  const deptoActivo     = departamentoForzado ?? profile?.departamento
  const esUsuario       = profile?.rol === 'usuario'
  const esAdminOGerente = profile?.rol === 'admin' || profile?.rol === 'gerente'

  const [form, setForm] = useState({
    nombre_tarea:      '',
    area:              '',
    tipo:              'puntual',
    frecuencia:        'mensual',
    condicion:         'dia_real',
    fecha_inicio:      '',
    fecha_termino:     '',
    responsable_id:    esUsuario ? user.id : '',
    observaciones:     '',
    guardar_plantilla: false,
    dia_habil_fijo:    false,
    dia_habil_num:     '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-depto', deptoActivo],
    enabled: esAdminOGerente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .eq('departamento', deptoActivo)
        .order('nombre')
      if (error) throw error
      return data ?? []
    }
  })

  // Calcular fecha automática cuando se activa día hábil fijo
  useEffect(() => {
    if (!form.dia_habil_fijo || !form.dia_habil_num) return
    const num = parseInt(form.dia_habil_num)
    if (isNaN(num) || num < 1 || num > 31) return

    const hoy  = new Date()
    let mes    = hoy.getMonth() + 2
    let anio   = hoy.getFullYear()
    if (mes > 12) { mes = 1; anio++ }

    const feriados    = getFeriadosDelAnio(anio)
    const feriadosAnt = getFeriadosDelAnio(anio - 1)
    const feriadosComb = new Set([...feriados, ...feriadosAnt])

    try {
      const fechaBase = new Date(anio, mes - 1, num, 12, 0, 0)
      const fecha     = ajustarAlDiaHabilSiguiente(fechaBase, feriadosComb)
      const fechaStr  = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
      setForm(prev => ({ ...prev, fecha_termino: fechaStr, condicion: 'habil' }))
    } catch (e) {}
  }, [form.dia_habil_fijo, form.dia_habil_num])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre_tarea.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.fecha_termino)       { setError('La fecha de término es obligatoria'); return }
    if (!form.responsable_id)      { setError('Asigna un responsable'); return }
    if (form.dia_habil_fijo && !form.dia_habil_num) { setError('Ingresa el número de día hábil'); return }

    setLoading(true)
    setError('')

    try {
      const { error: errTarea } = await supabase
        .from('tasks')
        .insert({
          ciclo_id:        cicloSeleccionado.id,
          responsable_id:  form.responsable_id,
          nombre_tarea:    form.nombre_tarea.trim(),
          area:            form.area || 'General',
          departamento:    deptoActivo,
          condicion:       form.dia_habil_fijo ? 'habil' : form.condicion,
          fecha_inicio:    form.fecha_inicio || form.fecha_termino,
          fecha_termino:   form.fecha_termino,
          estado:          'pendiente',
          observaciones:   form.observaciones.trim() || null,
          tipo_tarea:      'adicional',
          tipo:            form.tipo,
          frecuencia:      form.tipo === 'recurrente_mes' ? form.frecuencia : null,
          mes_calendario:  new Date().getMonth() + 1,
          anio_calendario: new Date().getFullYear(),
        })
      if (errTarea) throw errTarea

      if (form.tipo === 'cierre' || form.tipo === 'recurrente_mes') {
        const diaDelMes = form.dia_habil_fijo
          ? parseInt(form.dia_habil_num)
          : new Date(form.fecha_termino + 'T12:00:00').getDate()
        await supabase
          .from('task_templates')
          .insert({
            nombre_tarea:   form.nombre_tarea.trim(),
            area:           form.area || 'General',
            departamento:   deptoActivo,
            condicion:      form.dia_habil_fijo ? 'habil' : form.condicion,
            dia_del_mes:    diaDelMes,
            responsable_id: form.responsable_id,
            tipo:           form.tipo,
            frecuencia:     form.tipo === 'recurrente_mes' ? form.frecuencia : null,
            activo:         true,
          })
      }

      onCreada()
    } catch (err) {
      setError('Error al crear la tarea, intenta de nuevo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const hoy = new Date()
  let mesNext  = hoy.getMonth() + 2
  let anioNext = hoy.getFullYear()
  if (mesNext > 12) { mesNext = 1; anioNext++ }
  const nombreProxMes = `${MESES[mesNext - 1]} ${anioNext}`

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">Nueva tarea</h2>
            <p className="text-gray-400 text-sm">
              {MESES[cicloSeleccionado.mes - 1]} {cicloSeleccionado.anio}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Nombre de la tarea <span className="text-red-400">*</span>
            </label>
            <input
              name="nombre_tarea"
              type="text"
              value={form.nombre_tarea}
              onChange={handleChange}
              placeholder="Ej: Revisión de contratos pendientes"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Área */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Área</label>
            <input
              name="area"
              type="text"
              value={form.area}
              onChange={handleChange}
              placeholder="Ej: Cartografía, Pensiones, Producción..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Tipo de tarea */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tipo de tarea</label>
            <div className="grid grid-cols-3 gap-2">

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, tipo: 'cierre' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition
                  ${form.tipo === 'cierre'
                    ? 'bg-blue-950/50 border-blue-600 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                <RefreshCw className="w-4 h-4" />
                Cierre
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, tipo: 'recurrente_mes' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition
                  ${form.tipo === 'recurrente_mes'
                    ? 'bg-purple-950/50 border-purple-600 text-purple-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                <CalendarClock className="w-4 h-4" />
                Recurrente
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, tipo: 'puntual' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition
                  ${form.tipo === 'puntual'
                    ? 'bg-amber-950/50 border-amber-600 text-amber-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                <Sparkles className="w-4 h-4" />
                Puntual
              </button>

            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {form.tipo === 'cierre'        && 'Tarea del proceso de cierre del mes anterior'}
              {form.tipo === 'recurrente_mes' && 'Se repite mensualmente, dentro del mes actual'}
              {form.tipo === 'puntual'        && 'Tarea específica de este mes, no se repite'}
            </p>
          </div>

          {/* Frecuencia — solo si recurrente_mes */}
          {form.tipo === 'recurrente_mes' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Frecuencia</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'mensual',   label: 'Mensual' },
                  { value: 'quincenal', label: 'Quincenal' },
                  { value: 'semanal',   label: 'Semanal' },
                ].map(op => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, frecuencia: op.value }))}
                    className={`py-2 rounded-lg border text-xs font-medium transition
                      ${form.frecuencia === op.value
                        ? 'bg-purple-950/50 border-purple-600 text-purple-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Responsable */}
          {esAdminOGerente ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Responsable <span className="text-red-400">*</span>
              </label>
              <select
                name="responsable_id"
                value={form.responsable_id}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 text-gray-300
                           rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Seleccionar responsable...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} — {u.cargo}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5">Responsable</p>
              <p className="text-white text-sm font-medium">{profile?.nombre}</p>
            </div>
          )}

          {/* Casilla día hábil fijo */}
          <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer border transition
            ${form.dia_habil_fijo
              ? 'bg-blue-950/40 border-blue-700'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
          >
            <input
              type="checkbox"
              name="dia_habil_fijo"
              checked={form.dia_habil_fijo}
              onChange={handleChange}
              className="mt-0.5 w-4 h-4 accent-blue-500 shrink-0"
            />
            <div>
              <p className="text-sm text-white">Tarea con día hábil definido</p>
              <p className="text-xs text-gray-500">La fecha se calculará automáticamente cada mes</p>
            </div>
          </label>

          {/* Campo día hábil */}
          {form.dia_habil_fijo && (
            <div className="bg-blue-950/20 border border-blue-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">
                    Día del mes <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="dia_habil_num"
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_habil_num}
                    onChange={handleChange}
                    placeholder="Ej: 8"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Fecha calculada</label>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
                    <p className="text-white text-sm">
                      {form.fecha_termino || <span className="text-gray-600">—</span>}
                    </p>
                  </div>
                </div>
              </div>
              {form.fecha_termino && (
                <p className="text-xs text-blue-400">
                  📅 Fecha calculada para {nombreProxMes}. Si cae en finde o feriado se ajusta al siguiente hábil.
                </p>
              )}
            </div>
          )}

          {/* Fechas manuales */}
          {!form.dia_habil_fijo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fecha inicio</label>
                <input
                  name="fecha_inicio"
                  type="date"
                  value={form.fecha_inicio}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                             text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Fecha término <span className="text-red-400">*</span>
                </label>
                <input
                  name="fecha_termino"
                  type="date"
                  value={form.fecha_termino}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                             text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Observaciones (opcional)</label>
            <textarea
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              rows={2}
              placeholder="Contexto o detalles adicionales..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          {/* Guardar como plantilla */}
          <label className={`flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer border transition
            ${form.guardar_plantilla
              ? 'bg-green-950/40 border-green-700'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
          >
            <input
              type="checkbox"
              name="guardar_plantilla"
              checked={form.guardar_plantilla}
              onChange={handleChange}
              className="w-4 h-4 accent-green-500"
            />
            <div>
              <p className="text-sm text-white">Guardar como plantilla recurrente</p>
              <p className="text-xs text-gray-500">Se repetirá automáticamente cada mes</p>
            </div>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-700
                       hover:bg-green-600 text-white font-semibold py-3 rounded-xl
                       transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Creando...' : 'Crear tarea'}
          </button>

        </form>
      </div>
    </div>
  )
}
