import { X, CheckCircle2, Clock, RefreshCw, Sparkles, FileText, UserCheck, Plus, ChevronDown, Eye, Lock, TrendingUp, Star, GitBranch, Link2, Bell, Timer, Calendar } from 'lucide-react'

const SECCIONES = [
  {
    titulo: 'Cierres y tareas recurrentes',
    icono: RefreshCw,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-800',
    items: [
      '🔄 Las tareas recurrentes se generan automáticamente al crear un nuevo cierre — corresponden a las entregas fijas del mes anterior.',
      'Ejemplo: el "Cierre de Abril" contiene las tareas que se trabajan durante abril y principios de mayo.',
      'El selector de meses en el navbar muestra el nombre del cierre — ej: "Cierre de Abril 2026".',
      'Los ciclos cerrados son solo lectura — no se pueden agregar ni modificar tareas.',
      'Al crear un nuevo cierre, el anterior se cierra automáticamente.',
    ]
  },
  {
    titulo: 'Tareas adicionales ✨',
    icono: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      '✨ Las tareas adicionales son creadas manualmente para el mes calendario actual — no son parte del cierre.',
      'Cualquier usuario puede crear tareas adicionales para sí mismo con el botón "+ Nueva tarea".',
      'Los admins y gerencia pueden crear tareas para cualquier integrante del equipo.',
      'Se pueden guardar como plantilla recurrente para que se repitan automáticamente cada mes.',
      'Se identifican con el ícono dorado ✨ en la lista de tareas.',
    ]
  },
  {
    titulo: 'Estados de las tareas',
    icono: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      '⏳ Pendiente — tarea activa dentro del plazo.',
      '🔴 Atrasada — la fecha límite venció pero el ciclo sigue activo. Aún se puede entregar.',
      '✅ Completada — entregada al 100% dentro del plazo.',
      '🟡 Entregada — entregada con porcentaje menor a 100% (atraso o calidad parcial).',
      '⚫ No completada — el ciclo se cerró y la tarea no fue entregada.',
    ]
  },
  {
    titulo: 'Completar una tarea',
    icono: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Haz clic en cualquier tarea pendiente o atrasada para abrirla.',
      'El comentario es opcional — puedes describir lo que realizaste.',
      'Puedes adjuntar evidencias: imágenes, PDFs, Excel o Word.',
      'El % de cumplimiento se calcula automáticamente según los días de atraso:',
      '✅ A tiempo → 100% | 1 día → 90% | 2 días → 80% | 3 días → 70% | 4+ días → 50%',
      'Las tareas completadas en ciclos cerrados solo se pueden ver — no modificar.',
    ]
  },
  {
    titulo: 'Ver historial y evidencias',
    icono: Eye,
    color: 'text-blue-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Haz clic en cualquier tarea completada, entregada o no completada para ver su historial.',
      'En el panel lateral verás quién la completó, cuándo, el comentario y el % de cumplimiento.',
      'Si tiene archivos adjuntos aparecerán con un botón de descarga directo.',
      'El historial muestra también si la calificación fue ajustada por un admin o gerente.',
    ]
  },
  {
    titulo: 'Ajuste de calificación',
    icono: Star,
    color: 'text-amber-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Solo admins y gerencia pueden ajustar la calificación de una tarea entregada.',
      'Haz clic en la tarea completada → en el panel lateral aparece "Ajustar calificación".',
      'Puedes modificar el % con el slider y dejar una observación opcional.',
      'El ajuste queda registrado con quién lo hizo y cuándo.',
      'El dashboard se actualiza automáticamente reflejando el nuevo porcentaje.',
    ]
  },
  {
    titulo: 'Reasignar tareas',
    icono: UserCheck,
    color: 'text-blue-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Solo admins y gerencia pueden reasignar tareas.',
      'Haz clic en una tarea pendiente y selecciona la pestaña "Reasignar".',
      'Si la tarea es recurrente, puedes marcar "Aplicar también a ciclos futuros" para que el nuevo responsable quede como predeterminado en la plantilla.',
    ]
  },
  {
    titulo: 'Dashboard y métricas',
    icono: TrendingUp,
    color: 'text-green-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'El dashboard muestra dos secciones separadas: tareas del cierre y tareas adicionales del mes.',
      'La barra verde muestra el % de tareas completadas. La barra amarilla muestra la calidad promedio real de las entregas.',
      'El gráfico de tendencia muestra los últimos 12 cierres con ambas métricas.',
      'Haz clic en las stat cards (completadas, entregadas, sin completar) para ver el detalle de esas tareas.',
      'Haz clic en un integrante del equipo para ver su detalle personal con todas sus tareas.',
      'El detalle del integrante se actualiza al cambiar el ciclo en el navbar.',
    ]
  },
  {
    titulo: 'Navegación de ciclos',
    icono: ChevronDown,
    color: 'text-gray-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Usa las flechas ← → en el navbar para navegar entre cierres históricos.',
      'Los cierres cerrados muestran un banner 🔒 "solo lectura" — no se pueden modificar.',
      'El botón + crea un nuevo cierre generando automáticamente las tareas recurrentes con fechas según el calendario hábil chileno (incluye feriados).',
      'El botón 🗑 elimina el cierre activo y todas sus tareas permanentemente.',
      'Al crear un nuevo cierre, el anterior se cierra automáticamente.',
    ]
  },
  {
    titulo: 'Ciclos inactivos vs cerrados',
    icono: Lock,
    color: 'text-gray-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      '🔘 Inactivo: el ciclo anterior queda inactivo al crear uno nuevo. Puedes seguir completando tareas pendientes.',
      '🔒 Cerrado: el admin cierra manualmente el ciclo. Las tareas pasan a solo lectura.',
    ]
  },
  {
    titulo: 'Flujos interdepartamentales',
    icono: GitBranch,
    color: 'text-green-400',
    bg: 'bg-green-900/10 border-green-800',
    items: [
      '🗺️ Página Flujos: mapa interactivo de solicitudes entre departamentos.',
      'Crea solicitudes desde el panel lateral seleccionando el departamento y responsable destino.',
      'Estados: Solicitado → En proceso → Entregado.',
      'Solo el departamento destino puede cambiar el estado de la solicitud.',
      'Las solicitudes de flujos generan notificaciones automáticas a los responsables.',
    ]
  },
  {
    titulo: 'Dependencias entre tareas',
    icono: Link2,
    color: 'text-purple-400',
    bg: 'bg-purple-900/10 border-purple-800',
    items: [
      'Una tarea puede depender de otra tarea de otro departamento.',
      'Tipo referencia: no bloquea la tarea, solo registra el impacto entre ellas.',
      'Si la tarea dependida se completa con atraso, se registra el impacto en las tareas que dependen de ella.',
      'Visible en el detalle de cada tarea y en el mapa de Flujos.',
    ]
  },
  {
    titulo: 'Duración estimada',
    icono: Timer,
    color: 'text-blue-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Selector híbrido al crear o editar una tarea.',
      'Botones rápidos: 30m, 1h, 2h, 4h, 8h.',
      'O ingresa manualmente horas y minutos de forma libre.',
    ]
  },
  {
    titulo: 'Días semanales múltiples',
    icono: Calendar,
    color: 'text-amber-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Las tareas semanales pueden asignarse a varios días de la semana.',
      'Ejemplo: Lunes + Miércoles + Viernes.',
      'Cada combinación genera instancias independientes dentro del ciclo.',
    ]
  },
  {
    titulo: 'Notificaciones',
    icono: Bell,
    color: 'text-amber-400',
    bg: 'bg-amber-900/10 border-amber-800',
    items: [
      '🔔 La campana en el navbar muestra el conteo de notificaciones no leídas.',
      'Tipos: tareas por vencer, tareas vencidas, novedades.',
      'Las solicitudes de flujos generan notificaciones automáticas: al crear una solicitud se notifica al responsable destino, y al cambiar el estado (en proceso / entregado) se notifica al responsable origen.',
      'Haz clic en una notificación para ir directamente al recurso relacionado.',
    ]
  },
]

export default function PanelAyuda({ onClose }) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Manual de uso</h2>
            <p className="text-gray-400 text-sm mt-0.5">Portal de Gestión FDI — v2.0</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {SECCIONES.map((sec, i) => {
            const Icono = sec.icono
            return (
              <div key={i} className={`border rounded-xl overflow-hidden ${sec.bg}`}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700/50">
                  <Icono className={`w-4 h-4 shrink-0 ${sec.color}`} />
                  <h3 className="text-white font-medium text-sm">{sec.titulo}</h3>
                </div>
                <ul className="px-4 py-3 space-y-2">
                  {sec.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-gray-600 shrink-0 mt-0.5">·</span>
                      <p className="text-gray-300 text-xs leading-relaxed">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <div className="pt-2 pb-4 text-center">
            <p className="text-gray-600 text-xs">
              ¿Tienes dudas? Contacta a tu administrador del sistema.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
