import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, CheckCircle2, Clock, AlertCircle, Download, FileText, Image, FileSpreadsheet, File, RefreshCw, Sparkles } from 'lucide-react'

function getIconoArchivo(tipo) {
  switch (tipo) {
    case 'imagen': return <Image className="w-4 h-4 text-blue-400" />
    case 'pdf':    return <FileText className="w-4 h-4 text-red-400" />
    case 'excel':  return <FileSpreadsheet className="w-4 h-4 text-green-400" />
    default:       return <File className="w-4 h-4 text-gray-400" />
  }
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const ESTADO_CONFIG = {
  completada:            { color: 'text-green-400', bg: 'bg-green-900/30 border-green-800', icono: CheckCircle2, label: 'Completada a tiempo' },
  completada_con_atraso: { color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800', icono: Clock, label: 'Completada con atraso' },
  con_atraso:            { color: 'text-red-400', bg: 'bg-red-900/30 border-red-800', icono: AlertCircle, label: 'No completada — Atrasada' },
  no_completada:         { color: 'text-gray-500', bg: 'bg-gray-800/50 border-gray-700', icono: AlertCircle, label: 'No completada' },
}

export default function DetalleTareaPanel({ tarea, onClose }) {
  // Cargar historial de completaciones
  const { data: completaciones = [], isLoading: loadingComp } = useQuery({
  queryKey: ['completaciones', tarea.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('task_completions')
      .select('*')
      .eq('task_id', tarea.id)
      .order('fecha_completado', { ascending: false })
    if (error) throw error

    const ids = [...new Set(data.map(c => c.completado_por).filter(Boolean))]
    if (ids.length === 0) return data

    const { data: usuarios } = await supabase
      .from('users')
      .select('id, nombre')
      .in('id', ids)

    return data.map(c => ({
      ...c,
      completado_por_user: usuarios?.find(u => u.id === c.completado_por) ?? null
    }))
  }
})

const { data: evidencias = [], isLoading: loadingEv } = useQuery({
  queryKey: ['evidencias', tarea.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('evidencias')
      .select('*')
      .eq('task_id', tarea.id)
      .order('subido_at', { ascending: false })
    if (error) throw error

    const ids = [...new Set(data.map(e => e.subido_por).filter(Boolean))]
    if (ids.length === 0) return data

    const { data: usuarios } = await supabase
      .from('users')
      .select('id, nombre')
      .in('id', ids)

    return data.map(e => ({
      ...e,
      subido_por_user: usuarios?.find(u => u.id === e.subido_por) ?? null
    }))
  }
})
  const cfg = ESTADO_CONFIG[tarea.estado] ?? ESTADO_CONFIG.con_atraso
  const Icono = cfg.icono

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {tarea.template_id
                ? <RefreshCw className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                : <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span className="text-xs text-gray-500">
                {tarea.template_id ? 'Tarea recurrente' : 'Tarea del ciclo'}
              </span>
            </div>
            <h2 className="text-white font-semibold text-lg leading-tight">
              {tarea.nombre_tarea}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {tarea.area} · {tarea.responsable_nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Estado */}
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${cfg.bg}`}>
            <Icono className={`w-5 h-5 ${cfg.color} shrink-0`} />
            <div>
              <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Fecha límite: {tarea.fecha_termino}
              </p>
            </div>
          </div>

          {/* Historial de completaciones */}
          <div>
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Historial de completación
            </h3>

            {loadingComp ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : completaciones.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-sm">Sin registros de completación</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completaciones.map((comp, i) => (
                  <div key={comp.id} className="bg-gray-800/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-900 flex items-center justify-center shrink-0">
                          <span className="text-green-300 text-xs font-bold">
                            {comp.completado_por_user?.nombre?.split(' ').map(n => n[0]).join('').slice(0,2) ?? '?'}
                          </span>
                        </div>
                        <span className="text-gray-300 text-sm font-medium">
                          {comp.completado_por_user?.nombre ?? 'Usuario'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          comp.porcentaje_cumplimiento === 100 ? 'bg-green-900 text-green-300'
                          : comp.porcentaje_cumplimiento >= 80 ? 'bg-amber-900 text-amber-300'
                          : comp.porcentaje_cumplimiento >= 50 ? 'bg-orange-900 text-orange-300'
                          : 'bg-red-900 text-red-300'
                        }`}>
                          {comp.porcentaje_cumplimiento}%
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">
                      {formatFecha(comp.fecha_completado)}
                    </p>
                    {comp.comentario && (
                      <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                        <p className="text-gray-300 text-sm italic">"{comp.comentario}"</p>
                      </div>
                    )}
                    {comp.reabierto_at && (
                      <p className="text-xs text-amber-500 mt-2">
                        ⚠ Reabierta el {formatFecha(comp.reabierto_at)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidencias */}
          <div>
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <File className="w-4 h-4 text-blue-400" />
              Evidencias
              {evidencias.length > 0 && (
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {evidencias.length}
                </span>
              )}
            </h3>

            {loadingEv ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : evidencias.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-sm">Sin evidencias adjuntas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {evidencias.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-3">
                    <div className="shrink-0">
                      {getIconoArchivo(ev.tipo_archivo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm truncate">{ev.nombre_archivo}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {ev.subido_por_user?.nombre ?? 'Usuario'} · {formatBytes(ev.tamanio_bytes)}
                      </p>
                    </div>
                    <a
                      href={ev.url_storage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones */}
          {tarea.observaciones && (
            <div>
              <h3 className="text-white font-medium text-sm mb-2">Observaciones</h3>
              <p className="text-gray-400 text-sm bg-gray-800/50 rounded-xl px-4 py-3">
                {tarea.observaciones}
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}