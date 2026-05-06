import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { X, Save } from 'lucide-react'

export default function EditarTareaModal({ tarea, onClose, cicloId }) {
  const queryClient = useQueryClient()
  const [nombre, setNombre]         = useState(tarea.nombre_tarea)
  const [fechaTermino, setFechaTermino] = useState(tarea.fecha_termino)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleGuardar(e) {
    e.preventDefault()
    if (!nombre.trim())   { setError('El nombre es obligatorio'); return }
    if (!fechaTermino)    { setError('La fecha es obligatoria'); return }

    setLoading(true)
    setError('')

    try {
      const { error: err } = await supabase
        .from('tasks')
        .update({
          nombre_tarea:  nombre.trim(),
          fecha_termino: fechaTermino,
        })
        .eq('id', tarea.id)

      if (err) throw err

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

          {/* Fecha término */}
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
