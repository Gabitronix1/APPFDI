import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X, Upload, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'

export default function TaskModal({ tarea, onClose, onCompletada }) {
  const { user, profile } = useAuth()
  const [comentario, setComentario] = useState('')
  const [porcentaje, setPorcentaje] = useState(100)
  const [archivo, setArchivo]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [tab, setTab]               = useState('completar') // 'completar' | 'reasignar'
  const [nuevoResponsable, setNuevoResponsable] = useState('')
  const [reasignando, setReasignando] = useState(false)
  const [exito, setExito]           = useState('')

  // Cargar usuarios CDG para reasignación (solo admin)
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-cdg'],
    enabled:  profile?.rol === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    }
  })

  async function handleCompletar(e) {
    e.preventDefault()
    if (comentario.length < 10) {
      setError('El comentario debe tener al menos 10 caracteres')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { error: errComp } = await supabase
        .from('task_completions')
        .insert({
          task_id:                 tarea.id,
          completado_por:          user.id,
          comentario,
          porcentaje_cumplimiento: porcentaje,
        })
      if (errComp) throw errComp

      if (archivo) {
        const ext  = archivo.name.split('.').pop()
        const path = `evidencias/${tarea.id}/${Date.now()}.${ext}`
        const { error: errUp } = await supabase.storage
          .from('evidencias')
          .upload(path, archivo)
        if (!errUp) {
          const { data: { publicUrl } } = supabase.storage
            .from('evidencias')
            .getPublicUrl(path)
          await supabase.from('evidencias').insert({
            task_id:        tarea.id,
            subido_por:     user.id,
            nombre_archivo: archivo.name,
            url_storage:    publicUrl,
            tipo_archivo:   getTipoArchivo(archivo.type),
            tamanio_bytes:  archivo.size,
          })
        }
      }

      onCompletada()
    } catch (err) {
      setError('Ocurrió un error, intenta de nuevo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReasignar(e) {
    e.preventDefault()
    if (!nuevoResponsable) { setError('Selecciona un responsable'); return }
    setReasignando(true)
    setError('')
    console.log('Reasignando tarea:', tarea.id)
    console.log('Nuevo responsable:', nuevoResponsable)
    console.log('Reasignado por:', user.id)


    try {
      const { error: errReas } = await supabase
        .from('tasks')
        .update({
          responsable_id: nuevoResponsable,
          reasignado_por: user.id,
          reasignado_at:  new Date().toISOString(),
        })
        .eq('id', tarea.id)
      if (errReas) throw errReas

      setExito('Tarea reasignada correctamente')
      setTimeout(() => onCompletada(), 1500)
    } catch (err) {
      setError('Error al reasignar, intenta de nuevo')
      console.error(err)
    } finally {
      setReasignando(false)
    }
  }

  function getTipoArchivo(mime) {
    if (mime.startsWith('image/'))                              return 'imagen'
    if (mime === 'application/pdf')                             return 'pdf'
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'excel'
    if (mime.includes('word'))                                  return 'word'
    return 'otro'
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">{tarea.nombre_tarea}</h2>
            <p className="text-gray-400 text-sm">
              {tarea.area} · Vence {tarea.fecha_termino}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              Responsable actual: <span className="text-gray-300">{tarea.responsable_nombre}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs — solo admin ve reasignar */}
        {profile?.rol === 'admin' && (
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => { setTab('completar'); setError('') }}
              className={`flex-1 py-1.5 text-sm rounded-md transition font-medium
                ${tab === 'completar'
                  ? 'bg-green-700 text-white'
                  : 'text-gray-400 hover:text-white'}`}
            >
              Completar
            </button>
            <button
              onClick={() => { setTab('reasignar'); setError('') }}
              className={`flex-1 py-1.5 text-sm rounded-md transition font-medium
                ${tab === 'reasignar'
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-400 hover:text-white'}`}
            >
              Reasignar
            </button>
          </div>
        )}

        {/* Alerta fuera de plazo */}
        {tarea.alerta === 'fuera_de_plazo' && tab === 'completar' && (
          <div className="flex items-center gap-2 bg-orange-950 border border-orange-700 
                          rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
            <p className="text-orange-300 text-sm">
              Esta tarea venció el <strong>{tarea.fecha_termino}</strong>.
              Se registrará como completada <strong>fuera de plazo</strong>.
            </p>
          </div>
        )}

        {/* Tab: Completar */}
        {tab === 'completar' && (
          <form onSubmit={handleCompletar} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Porcentaje de cumplimiento:{' '}
                <span className="text-green-400 font-bold">{porcentaje}%</span>
              </label>
              <input
                type="range" min="0" max="100" step="25"
                value={porcentaje}
                onChange={e => setPorcentaje(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Comentario <span className="text-red-400">*</span>
              </label>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={3}
                placeholder="Describe brevemente lo que realizaste..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 
                           text-white text-sm focus:outline-none focus:border-green-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{comentario.length}/10 mínimo</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Evidencia (opcional)</label>
              <label className="flex items-center gap-2 bg-gray-800 border border-dashed 
                                border-gray-600 rounded-lg px-4 py-3 cursor-pointer 
                                hover:border-green-500 transition">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">
                  {archivo ? archivo.name : 'Subir archivo o imagen'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                  onChange={e => setArchivo(e.target.files[0])}
                />
              </label>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-700 
                         hover:bg-green-600 text-white font-semibold py-3 rounded-xl 
                         transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Marcar como completada'}
            </button>
          </form>
        )}

        {/* Tab: Reasignar */}
        {tab === 'reasignar' && (
          <form onSubmit={handleReasignar} className="space-y-4">
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-400">
              Responsable actual:{' '}
              <span className="text-white font-medium">{tarea.responsable_nombre}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Nuevo responsable <span className="text-red-400">*</span>
              </label>
              <select
                value={nuevoResponsable}
                onChange={e => setNuevoResponsable(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-300 
                           rounded-lg px-3 py-2.5 text-sm focus:outline-none 
                           focus:border-blue-500"
              >
                <option value="">Seleccionar persona...</option>
                {usuarios
                  .filter(u => u.id !== tarea.responsable_id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.cargo}
                    </option>
                  ))}
              </select>
            </div>

            {error  && <p className="text-red-400 text-sm">{error}</p>}
            {exito  && <p className="text-green-400 text-sm">{exito}</p>}

            <button
              type="submit"
              disabled={reasignando || !nuevoResponsable}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 
                         hover:bg-blue-600 text-white font-semibold py-3 rounded-xl 
                         transition disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              {reasignando ? 'Reasignando...' : 'Confirmar reasignación'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}