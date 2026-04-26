import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X, Upload, CheckCircle2, AlertCircle, UserCheck, Clock } from 'lucide-react'

export default function TaskModal({ tarea, onClose, onCompletada }) {
  const { user, profile } = useAuth()
  const [comentario, setComentario]             = useState('')
  const [archivo, setArchivo]                   = useState(null)
  const [loading, setLoading]                   = useState(false)
  const [error, setError]                       = useState('')
  const [tab, setTab]                           = useState('completar')
  const [nuevoResponsable, setNuevoResponsable] = useState('')
  const [reasignando, setReasignando]           = useState(false)
  const [exito, setExito]                       = useState('')
  const [reasignarRecurrente, setReasignarRecurrente] = useState(false)

  // Calcular días de atraso si se completa hoy
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaTermino = new Date(tarea.fecha_termino + 'T00:00:00')
  const diasAtraso   = Math.max(0, Math.floor((hoy - fechaTermino) / (1000 * 60 * 60 * 24)))

  const pctEstimado = diasAtraso === 0 ? 100
    : diasAtraso === 1 ? 90
    : diasAtraso === 2 ? 80
    : diasAtraso === 3 ? 70
    : 50

  const esAdminOGerente = profile?.rol === 'admin' || profile?.rol === 'gerente'

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-depto', profile?.departamento],
    enabled:  esAdminOGerente,
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .order('nombre')
      if (profile?.rol !== 'gerente') {
        query = query.eq('departamento', profile?.departamento)
      }
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  async function handleCompletar(e) {
    e.preventDefault()
    if (!comentario.trim()) {
      setError('El comentario es obligatorio')
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
          porcentaje_cumplimiento: pctEstimado,
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

    try {
      // Reasignar tarea del ciclo actual
      const { error: errReas } = await supabase
        .from('tasks')
        .update({
          responsable_id: nuevoResponsable,
          reasignado_por: user.id,
          reasignado_at:  new Date().toISOString(),
        })
        .eq('id', tarea.id)
      if (errReas) throw errReas

      // Si se marcó recurrente, actualizar la plantilla también
      if (reasignarRecurrente && tarea.template_id) {
        await supabase
          .from('task_templates')
          .update({ responsable_id: nuevoResponsable })
          .eq('id', tarea.template_id)
      }

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
    if (mime.startsWith('image/'))                               return 'imagen'
    if (mime === 'application/pdf')                              return 'pdf'
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'excel'
    if (mime.includes('word'))                                   return 'word'
    return 'otro'
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">

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

        {/* Tabs — admin y gerente ven reasignar */}
        {esAdminOGerente && (
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => { setTab('completar'); setError('') }}
              className={`flex-1 py-1.5 text-sm rounded-md transition font-medium
                ${tab === 'completar' ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Completar
            </button>
            <button
              onClick={() => { setTab('reasignar'); setError('') }}
              className={`flex-1 py-1.5 text-sm rounded-md transition font-medium
                ${tab === 'reasignar' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Reasignar
            </button>
          </div>
        )}

        {/* Info cumplimiento estimado */}
        {tab === 'completar' && (
          <div className={`flex items-center gap-3 rounded-lg px-4 py-3 mb-4
            ${diasAtraso === 0
              ? 'bg-green-950 border border-green-800'
              : 'bg-orange-950 border border-orange-800'}`}
          >
            {diasAtraso === 0
              ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              : <AlertCircle  className="w-4 h-4 text-orange-400 shrink-0" />}
            <div>
              {diasAtraso === 0 ? (
                <p className="text-green-300 text-sm">
                  Dentro del plazo — cumplimiento: <strong>100%</strong>
                </p>
              ) : (
                <p className="text-orange-300 text-sm">
                  {diasAtraso} día{diasAtraso > 1 ? 's' : ''} de atraso —
                  cumplimiento: <strong>{pctEstimado}%</strong>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">
                El porcentaje se calcula automáticamente
              </p>
            </div>
          </div>
        )}

        {/* Tab: Completar */}
        {tab === 'completar' && (
          <form onSubmit={handleCompletar} className="space-y-4">
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
              {loading ? 'Guardando...' : `Marcar como completada · ${pctEstimado}%`}
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
                           rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
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

            {/* Casilla recurrente — solo si tiene template_id */}
            {tarea.template_id && nuevoResponsable && (
              <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer border transition
                ${reasignarRecurrente
                  ? 'bg-blue-950 border-blue-700'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
              >
                <input
                  type="checkbox"
                  checked={reasignarRecurrente}
                  onChange={e => setReasignarRecurrente(e.target.checked)}
                  className="mt-0.5 accent-blue-500 w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-sm text-white font-medium">Aplicar también a ciclos futuros</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    El nuevo responsable quedará como predeterminado en la plantilla recurrente
                  </p>
                </div>
              </label>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {exito && <p className="text-green-400 text-sm">{exito}</p>}

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
