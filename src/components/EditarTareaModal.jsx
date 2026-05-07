import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { X, Save } from 'lucide-react'
import { getFeriadosDelAnio, getNesimoHabilDelMes } from '../lib/feriados'

export default function EditarTareaModal({ tarea, onClose, cicloId }) {
  const queryClient = useQueryClient()
  const [nombre, setNombre]             = useState(tarea.nombre_tarea)
  const [fechaTermino, setFechaTermino] = useState(tarea.fecha_termino)
  const [diaHabilFijo, setDiaHabilFijo] = useState(tarea.condicion === 'habil')
  const [diaHabilNum, setDiaHabilNum]   = useState(
    tarea.condicion === 'habil' ? String(tarea.dia_del_mes ?? '') : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  // Próximo mes para leyenda
  const hoy = new Date()
  let mesNext = hoy.getMonth() + 2
  let anioNext = hoy.getFullYear()
  if (mesNext > 12) { mesNext = 1; anioNext++ }

  // Recalcular fecha cuando cambia día hábil
  useEffect(() => {
    if (!diaHabilFijo || !diaHabilNum) return
    const num = parseInt(diaHabilNum)
    if (isNaN(num) || num < 1 || num > 23) return

    const feriados    = getFeriadosDelAnio(anioNext)
    const feriadosAnt = getFeriadosDelAnio(anioNext - 1)
    const feriadosComb = new Set([...feriados, ...feriadosAnt])

    try {
      const fecha = getNesimoHabilDelMes(mesNext, anioNext, num, feriadosComb)
      setFechaTermino(fecha.toISOString().split('T')[0])
    } catch (e) {}
  }, [diaHabilFijo, diaHabilNum])

  async function handleGuardar(e) {
    e.preventDefault()
    if (!nombre.trim())  { setError('El nombre es obligatorio'); return }
    if (!fechaTermino)   { setError('La fecha es obligatoria'); return }
    if (diaHabilFijo && !diaHabilNum) { setError('Ingresa el número de día hábil'); return }

    setLoading(true)
    setError('')

    try {
      const { error: err } = await supabase
        .from('tasks')
        .update({
          nombre_tarea:  nombre.trim(),
          fecha_termino: fechaTermino,
          condicion:     diaHabilFijo ? 'habil' : 'dia_real',
        })
        .eq('id', tarea.id)

      if (err) throw err

      // Si es recurrente y tiene día hábil, actualizar la plantilla también
      if (tarea.template_id && diaHabilFijo && diaHabilNum) {
        await supabase
          .from('task_templates')
          .update({
            condicion:   'habil',
            dia_del_mes: parseInt(diaHabilNum),
          })
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">Editar tarea</h2>
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
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Casilla día hábil fijo */}
          <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer border transition
            ${diaHabilFijo
              ? 'bg-blue-950/40 border-blue-700'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
          >
            <input
              type="checkbox"
              checked={diaHabilFijo}
              onChange={e => {
                setDiaHabilFijo(e.target.checked)
                if (!e.target.checked) setDiaHabilNum('')
              }}
              className="mt-0.5 w-4 h-4 accent-blue-500 shrink-0"
            />
            <div>
              <p className="text-sm text-white">Tarea con día hábil definido</p>
              <p className="text-xs text-gray-500">La fecha se calculará automáticamente cada mes</p>
            </div>
          </label>

          {/* Campo día hábil */}
          {diaHabilFijo && (
            <div className="bg-blue-950/20 border border-blue-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">
                    Día hábil del mes <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="23"
                    value={diaHabilNum}
                    onChange={e => setDiaHabilNum(e.target.value)}
                    placeholder="Ej: 3"
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
                  📅 Fecha calculada para {MESES[mesNext - 1]} {anioNext}. Se recalculará cada mes si es recurrente.
                </p>
              )}
            </div>
          )}

          {/* Fecha manual — solo si NO hay día hábil fijo */}
          {!diaHabilFijo && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Fecha de término <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={fechaTermino}
                onChange={e => setFechaTermino(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                         py-2.5 rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
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
