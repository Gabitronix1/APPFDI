import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'


export default function NuevaTareaModal({ cicloSeleccionado, onClose, onCreada, departamentoForzado }) {
  const { user, profile } = useAuth()

  const deptoActivo = departamentoForzado ?? profile?.departamento

  const [form, setForm] = useState({
    nombre_tarea:   '',
    area:           '',
    condicion:      'dia_real',
    fecha_inicio:   '',
    fecha_termino:  '',
    responsable_id: '',
    observaciones:  '',
    guardar_plantilla: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-depto', deptoActivo],
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

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre_tarea.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.fecha_termino)       { setError('La fecha de término es obligatoria'); return }
    if (!form.responsable_id)      { setError('Asigna un responsable'); return }

    setLoading(true)
    setError('')

    try {
      // 1. Insertar tarea en el ciclo actual
      const { error: errTarea } = await supabase
        .from('tasks')
        .insert({
          ciclo_id:       cicloSeleccionado.id,
          responsable_id: form.responsable_id,
          nombre_tarea:   form.nombre_tarea.trim(),
          area:           form.area || 'Otro',
          departamento: deptoActivo,
          condicion:      form.condicion,
          fecha_inicio:   form.fecha_inicio || form.fecha_termino,
          fecha_termino:  form.fecha_termino,
          estado:         'pendiente',
          observaciones:  form.observaciones.trim() || null,
          tipo_tarea:      'adicional',
          mes_calendario:  new Date().getMonth() + 1,
          anio_calendario: new Date().getFullYear(),
        })
      if (errTarea) throw errTarea

      // 2. Si se marcó guardar como plantilla
      if (form.guardar_plantilla && profile?.rol === 'admin') {
        const diaDelMes = new Date(form.fecha_termino + 'T12:00:00').getDate()
        await supabase
          .from('task_templates')
          .insert({
            nombre_tarea:   form.nombre_tarea.trim(),
            area:           form.area || 'Otro',
            departamento: deptoActivo,
            condicion:      form.condicion,
            dia_del_mes:    diaDelMes,
            responsable_id: form.responsable_id,
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">Nueva tarea</h2>
            <p className="text-gray-400 text-sm">
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
              ][cicloSeleccionado.mes - 1]} {cicloSeleccionado.anio}
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

          {/* Responsable */}
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

          {/* Fechas */}
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

          {/* Guardar como plantilla — solo admin */}
          {(profile?.rol === 'admin' || profile?.rol === 'gerente') && (
            <label className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3 cursor-pointer">
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
          )}

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
