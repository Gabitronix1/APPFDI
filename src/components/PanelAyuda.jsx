import { X, CheckCircle2, Clock, RefreshCw, Sparkles, FileText, UserCheck, Plus, ChevronDown, Eye } from 'lucide-react'

const SECCIONES = [
  {
    titulo: 'Ver historial y evidencias',
    icono: Eye,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-800',
    items: [
      'Haz clic en cualquier tarea completada (verde o amarilla) para ver su historial completo.',
      'En el panel lateral verás quién la completó, cuándo, su comentario y el % de cumplimiento.',
      'Si tiene archivos adjuntos, aparecerán con un botón de descarga directo.',
      'Las tareas pendientes también son clickeables — se abre el formulario para completarlas.',
    ]
  },
  {
    titulo: 'Tipos de tareas',
    icono: RefreshCw,
    color: 'text-blue-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      '🔄 Tareas recurrentes — se generan automáticamente cada mes desde plantillas. Se identifican con el ícono azul de ciclo.',
      '✨ Tareas del ciclo — creadas manualmente para un mes específico. Se identifican con el ícono dorado.',
      'Al eliminar una tarea recurrente puedes elegir eliminarla solo del ciclo actual o de todos los ciclos futuros.',
    ]
  },
  {
    titulo: 'Completar una tarea',
    icono: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Haz clic en cualquier tarea pendiente para abrirla.',
      'Escribe un comentario describiendo lo que realizaste (obligatorio).',
      'Puedes adjuntar evidencias: imágenes, PDFs, Excel o Word.',
      'El % de cumplimiento se calcula automáticamente según los días de atraso.',
      'Si la completas después de la fecha límite, quedará registrada como "Completada con atraso".',
    ]
  },
  {
    titulo: '% de cumplimiento',
    icono: Clock,
    color: 'text-amber-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'El sistema calcula automáticamente el porcentaje según cuándo se completó la tarea:',
      '✅ Completada a tiempo → 100%',
      '1 día de atraso → 90%',
      '2 días de atraso → 80%',
      '3 días de atraso → 70%',
      '4+ días de atraso → 50%',
      'Las tareas no completadas al cerrar el ciclo quedan en 0%.',
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
    titulo: 'Crear nueva tarea',
    icono: Plus,
    color: 'text-green-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Cualquier usuario puede crear tareas adicionales para el ciclo actual con el botón "+ Nueva tarea".',
      'Los admins y gerencia pueden marcar una tarea como "recurrente" al crearla — esto la convierte en plantilla y se repetirá cada mes automáticamente.',
      'Las tareas creadas manualmente aparecen con el ícono ✨ dorado.',
    ]
  },
  {
    titulo: 'Cambio de ciclo mensual',
    icono: ChevronDown,
    color: 'text-gray-400',
    bg: 'bg-gray-800/50 border-gray-700',
    items: [
      'Los admins pueden navegar entre meses con las flechas ← → en el navbar.',
      'El botón + crea un nuevo ciclo mensual generando automáticamente todas las tareas recurrentes con sus fechas según el calendario hábil chileno (incluye feriados).',
      'Al crear un nuevo ciclo, el anterior se cierra automáticamente.',
      'El botón ⚡ permite reactivar un ciclo cerrado.',
      'El botón 🗑 elimina el ciclo y todas sus tareas permanentemente.',
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
            <p className="text-gray-400 text-sm mt-0.5">Portal de Gestión FDI</p>
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
                {/* Header sección */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700/50">
                  <Icono className={`w-4 h-4 shrink-0 ${sec.color}`} />
                  <h3 className="text-white font-medium text-sm">{sec.titulo}</h3>
                </div>
                {/* Items */}
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

          {/* Footer */}
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
