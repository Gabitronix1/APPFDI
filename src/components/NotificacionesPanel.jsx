import { useNavigate } from 'react-router-dom'
import { Clock, AlertCircle, CheckCircle, X, BellOff } from 'lucide-react'
import { useNotificaciones } from '../hooks/useNotificaciones'

// ─── Configuración por tipo ────────────────────────────────────────────────────
const TIPO_CONFIG = {
  por_vencer: {
    Icon:  Clock,
    color: 'text-amber-400',
    bg:    'bg-amber-900/20',
    ring:  'border-amber-800/40',
  },
  vencida: {
    Icon:  AlertCircle,
    color: 'text-red-400',
    bg:    'bg-red-900/20',
    ring:  'border-red-800/40',
  },
  novedad: {
    Icon:  CheckCircle,
    color: 'text-green-400',
    bg:    'bg-green-900/20',
    ring:  'border-green-800/40',
  },
}

// ─── Formato de hora ──────────────────────────────────────────────────────────
function formatearHora(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const hoy = new Date()
  const esHoy =
    d.getDate()     === hoy.getDate()   &&
    d.getMonth()    === hoy.getMonth()  &&
    d.getFullYear() === hoy.getFullYear()

  if (esHoy) {
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

// ─── Agrupa notificaciones en "Hoy" / "Anteriores" ───────────────────────────
function agrupar(notificaciones) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const grupos = { Hoy: [], Anteriores: [] }
  for (const n of notificaciones) {
    const d = new Date(n.creado_at)
    d.setHours(0, 0, 0, 0)
    if (d >= hoy) grupos.Hoy.push(n)
    else          grupos.Anteriores.push(n)
  }
  return grupos
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NotificacionesPanel({ onClose }) {
  const navigate = useNavigate()
  const { notificaciones, marcarLeida, marcarTodasLeidas } = useNotificaciones()

  const grupos = agrupar(notificaciones)

  async function handleClick(notif) {
    await marcarLeida(notif.id)
    onClose()
    if (notif.link_tipo === 'tarea') {
      navigate('/tareas')
    }
  }

  return (
    <>
      {/* Overlay para cerrar al hacer click fuera */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel slide-over */}
      <div className="fixed top-14 right-3 z-50 w-80 sm:w-96 max-h-[80vh] flex flex-col
                      bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <h3 className="text-white font-semibold text-sm">Notificaciones</h3>
          <div className="flex items-center gap-2">
            {notificaciones.length > 0 && (
              <button
                onClick={marcarTodasLeidas}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Marcar todas como leídas
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto flex-1">
          {notificaciones.length === 0 ? (
            // Estado vacío
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <BellOff className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium text-sm">Todo al día 🎉</p>
              <p className="text-gray-600 text-xs mt-1">No tienes notificaciones pendientes</p>
            </div>
          ) : (
            Object.entries(grupos).map(([grupo, items]) => {
              if (items.length === 0) return null
              return (
                <div key={grupo}>
                  {/* Separador de grupo */}
                  <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      {grupo}
                    </p>
                  </div>

                  {/* Items */}
                  {items.map(notif => {
                    const cfg = TIPO_CONFIG[notif.tipo] ?? TIPO_CONFIG.novedad
                    const { Icon, color, bg, ring } = cfg

                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className={`w-full flex items-start gap-3 px-4 py-3.5
                                    border-b border-gray-800 text-left
                                    hover:bg-gray-800/60 transition-colors group`}
                      >
                        {/* Icono */}
                        <div className={`shrink-0 w-8 h-8 rounded-full border ${bg} ${ring}
                                         flex items-center justify-center mt-0.5`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>

                        {/* Texto */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold leading-snug">
                            {notif.titulo}
                          </p>
                          <p className="text-gray-400 text-xs mt-0.5 leading-relaxed line-clamp-2">
                            {notif.mensaje}
                          </p>
                        </div>

                        {/* Hora + punto */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                          <span className="text-gray-600 text-[10px]">
                            {formatearHora(notif.creado_at)}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
