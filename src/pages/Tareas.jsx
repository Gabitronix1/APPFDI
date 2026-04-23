import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import { CheckCircle2, Clock, AlertCircle, Filter } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const ESTADO_STYLES = {
  pendiente:      { badge: 'bg-gray-700 text-gray-300',    label: 'Pendiente' },
  en_progreso:    { badge: 'bg-blue-800 text-blue-300',    label: 'En progreso' },
  completada:     { badge: 'bg-green-800 text-green-300',  label: 'Completada' },
  con_atraso:     { badge: 'bg-red-900 text-red-300',      label: 'Atrasada' },
  fuera_de_plazo: { badge: 'bg-orange-900 text-orange-300',label: 'Fuera de plazo' },
}

const ALERTA_BORDER = {
  ok:             'border-gray-800',
  por_vencer:     'border-amber-500',
  fuera_de_plazo: 'border-red-500',
}

export default function Tareas({ cicloSeleccionado }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [soloMias, setSoloMias]       = useState(false)
  const [filtroArea, setFiltroArea]   = useState('todas')
  const [tareaActiva, setTareaActiva] = useState(null)

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id],
    enabled:  !!cicloSeleccionado?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloSeleccionado.id)   // ← filtro clave
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  const areas = ['todas', ...new Set(tareas.map(t => t.area).filter(Boolean))]

  const tareasFiltradas = tareas.filter(t => {
    if (soloMias && t.responsable_nombre !== profile?.nombre) return false
    if (filtroArea !== 'todas' && t.area !== filtroArea) return false
    return true
  })

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
    setTareaActiva(null)
  }

  const tituloCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tareas del equipo</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-green-400">{tituloCiclo}</span>
            {' · '}{tareasFiltradas.length} tareas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setSoloMias(!soloMias)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
            ${soloMias ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          <Filter className="w-4 h-4" />
          Solo mis tareas
        </button>

        <select
          value={filtroArea}
          onChange={e => setFiltroArea(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500"
        >
          {areas.map(a => (
            <option key={a} value={a}>{a === 'todas' ? 'Todas las áreas' : a}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No hay tareas con ese filtro</div>
      ) : (
        <div className="space-y-3">
          {tareasFiltradas.map(tarea => {
            const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
            const estilos = esFueraPlazo
              ? ESTADO_STYLES.fuera_de_plazo
              : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente
            const borde = ALERTA_BORDER[tarea.alerta] ?? 'border-gray-800'
            return (
              <div
                key={tarea.id}
                onClick={() => tarea.estado !== 'completada' && setTareaActiva(tarea)}
                className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4
                  ${tarea.estado !== 'completada'
                    ? 'cursor-pointer hover:bg-gray-800 transition'
                    : 'opacity-60'}`}
              >
                <div className="shrink-0">
                  {tarea.estado === 'completada'
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : esFueraPlazo
                    ? <AlertCircle className="w-5 h-5 text-orange-400" />
                    : tarea.estado === 'con_atraso'
                    ? <AlertCircle className="w-5 h-5 text-red-400" />
                    : <Clock className="w-5 h-5 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{tarea.nombre_tarea}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {tarea.responsable_nombre} · {tarea.area} · Vence {tarea.fecha_termino}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tarea.total_evidencias > 0 && (
                    <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>
                    {estilos.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={onCompletada}
        />
      )}
    </div>
  )
}