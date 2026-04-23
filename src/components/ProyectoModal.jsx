import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

export default function ProyectoModal({ proyecto, anio, onClose, onGuardado }) {
  const editando = !!proyecto
  const [form, setForm] = useState({
    edt:           proyecto?.edt          ?? '',
    nombre:        proyecto?.nombre       ?? '',
    descripcion:   proyecto?.descripcion  ?? '',
    fecha_inicio:  proyecto?.fecha_inicio ?? '',
    fecha_fin:     proyecto?.fecha_fin    ?? '',
    responsable_id: proyecto?.responsable_id ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-cdg'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users').select('id, nombre, cargo').eq('activo', true).order('nombre')
      return data ?? []
    }
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim())   { setError('El nombre es obligatorio'); return }
    if (!form.fecha_inicio)    { setError('La fecha de inicio es obligatoria'); return }
    if (!form.fecha_fin)       { setError('La fecha de fin es obligatoria'); return }
    setLoading(true)
    setError('')

    const payload = {
      edt:            form.edt.trim(),
      nombre:         form.nombre.trim(),
      descripcion:    form.descripcion.trim() || null,
      fecha_inicio:   form.fecha_inicio,
      fecha_fin:      form.fecha_fin,
      responsable_id: form.responsable_id || null,
      anio,
    }

    const { error: err } = editando
      ? await supabase.from('projects').update(payload).eq('id', proyecto.id)
      : await supabase.from('projects').insert(payload)

    if (err) { setError('Error al guardar'); setLoading(false); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">
            {editando ? 'Editar proyecto' : 'Nuevo proyecto'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">EDT</label>
              <input
                name="edt" type="text" value={form.edt} onChange={handleChange}
                placeholder="1, 2, 3..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <select
                name="responsable_id" value={form.responsable_id} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg
                           px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Sin asignar</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              name="nombre" type="text" value={form.nombre} onChange={handleChange}
              placeholder="Nombre del proyecto"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Descripción</label>
            <textarea
              name="descripcion" value={form.descripcion} onChange={handleChange}
              rows={2} placeholder="Descripción opcional..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                name="fecha_inicio" type="date" value={form.fecha_inicio} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Fecha fin <span className="text-red-400">*</span>
              </label>
              <input
                name="fecha_fin" type="date" value={form.fecha_fin} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold
                       py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </form>
      </div>
    </div>
  )
}