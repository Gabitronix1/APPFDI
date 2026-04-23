import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { CheckCircle2, Clock, AlertCircle, ListChecks } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard({ cicloSeleccionado }) {
  const { profile } = useAuth()

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id],
    enabled:  !!cicloSeleccionado?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloSeleccionado.id)
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  const misTareas  = tareas.filter(t => t.responsable_nombre === profile?.nombre)
  const completadas = tareas.filter(t => t.estado === 'completada').length
  const atrasadas   = tareas.filter(t => t.estado === 'con_atraso').length
  const fueraPlazo  = tareas.filter(t => t.alerta === 'fuera_de_plazo' && t.estado !== 'completada').length
  const pendientes  = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const pctAvance   = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0

  const tituloCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Hola, {profile?.nombre?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Resumen del cierre — <span className="text-green-400">{tituloCiclo}</span>
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Avance general del cierre</span>
          <span className="text-sm font-bold text-green-400">{pctAvance}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3">
          <div
            className="bg-green-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${pctAvance}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">{completadas} de {tareas.length} tareas completadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={ListChecks}   label="Total"          value={tareas.length} color="bg-blue-700" />
        <StatCard icon={CheckCircle2} label="Completadas"    value={completadas}   color="bg-green-700" />
        <StatCard icon={Clock}        label="Pendientes"     value={pendientes}    color="bg-amber-600" />
        <StatCard icon={AlertCircle}  label="Atrasadas"      value={atrasadas}     color="bg-red-700" />
        <StatCard icon={AlertCircle}  label="Fuera de plazo" value={fueraPlazo}    color="bg-orange-600" />
      </div>

      {/* Mis tareas */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Mis tareas pendientes</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : misTareas.filter(t => t.estado !== 'completada').length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-gray-300 font-medium">¡Todo al día!</p>
            <p className="text-gray-500 text-sm">No tienes tareas pendientes en este ciclo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {misTareas.filter(t => t.estado !== 'completada').map(tarea => (
              <TareaRow key={tarea.id} tarea={tarea} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TareaRow({ tarea }) {
  const alertaColor = {
    ok:             'border-gray-700',
    por_vencer:     'border-amber-500',
    fuera_de_plazo: 'border-red-500',
  }[tarea.alerta] ?? 'border-gray-700'

  const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'

  const estadoBadge = esFueraPlazo
    ? 'bg-orange-900 text-orange-300'
    : {
        pendiente:   'bg-gray-700 text-gray-300',
        en_progreso: 'bg-blue-800 text-blue-300',
        con_atraso:  'bg-red-900 text-red-300',
      }[tarea.estado] ?? 'bg-gray-700 text-gray-300'

  const estadoLabel = esFueraPlazo
    ? 'Fuera de plazo'
    : tarea.estado.replace('_', ' ')

  return (
    <div className={`bg-gray-900 border ${alertaColor} rounded-xl p-4 flex items-center justify-between gap-4`}>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{tarea.nombre_tarea}</p>
        <p className="text-gray-500 text-xs mt-0.5">{tarea.area} · Vence {tarea.fecha_termino}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${estadoBadge}`}>
        {estadoLabel}
      </span>
    </div>
  )
}