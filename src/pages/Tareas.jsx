import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import { CheckCircle2, Clock, AlertCircle, Filter, Plus, Trash2 } from 'lucide-react'
import NuevaTareaModal from '../components/NuevaTareaModal'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const ESTADO_STYLES = {
  pendiente:      { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  en_progreso:    { badge: 'bg-blue-800 text-blue-300',     label: 'En progreso' },
  completada:     { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Completada con atraso' },
  con_atraso:     { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
  fuera_de_plazo: { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' },
}

const ALERTA_BORDER = {
  ok:             'border-gray-800',
  por_vencer:     'border-amber-500',
  fuera_de_plazo: 'border-red-500',
}

export default function Tareas({ cicloSeleccionado }) {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [soloMias, setSoloMias]         = useState(false)
  const [filtroArea, setFiltroArea]     = useState('todas')
  const [tareaActiva, setTareaActiva]   = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [eliminando, setEliminando]     = useState(null)   // id de tarea a eliminar
  const [loadingEliminar, setLoadingEliminar] = useState(false)

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

  async function handleEliminar() {
    if (!eliminando) return
    setLoadingEliminar(true)
    try {
      // Borrar evidencias y completions primero
      await supabase.from('evidencias').delete().eq('task_id', eliminando)
      await supabase.from('task_completions').delete().eq('task_id', eliminando)
      // Borrar tarea
      const { error } = await supabase.from('tasks').delete().eq('id', eliminando)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
      setEliminando(null)
    } catch (err) {
      console.error('Error al eliminar:', err)
    } finally {
      setLoadingEliminar(false)
    }
  }

  const tituloCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  const tareaAEliminar = tareas.find(t => t.id === eliminando)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tareas del equipo</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-green-400">{tituloCiclo}</span>
            {' · '}{tareasFiltradas.length} tareas
          </p>
        </div>
        <button
          onClick={() => setMostrarNueva(true)}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-600
                     text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva tarea</span>
        </button>
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
                className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4
                  ${tarea.estado !== 'completada' ? 'hover:bg-gray-800 transition' : 'opacity-60'}`}
              >
                {/* Ícono estado */}
                <div
                  className="shrink-0 cursor-pointer"
                  onClick={() => tarea.estado !== 'completada' && setTareaActiva(tarea)}
                >
                  {tarea.estado === 'completada'
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : esFueraPlazo
                    ? <AlertCircle className="w-5 h-5 text-orange-400" />
                    : tarea.estado === 'con_atraso'
                    ? <AlertCircle className="w-5 h-5 text-red-400" />
                    : <Clock className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Info — clickeable para completar */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => tarea.estado !== 'completada' && setTareaActiva(tarea)}
                >
                  <p className="text-white font-medium truncate">{tarea.nombre_tarea}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {tarea.responsable_nombre} · {tarea.area} · Vence {tarea.fecha_termino}
                  </p>
                </div>

                {/* Badges + botón eliminar */}
                <div className="flex items-center gap-2 shrink-0">
                  {tarea.total_evidencias > 0 && (
                    <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>
                    {estilos.label}
                  </span>

                  {/* Botón eliminar — admin o propio usuario si está pendiente */}
                  {(profile?.rol === 'admin' ||
                    (tarea.responsable_nombre === profile?.nombre && tarea.estado === 'pendiente')
                  ) && (
                    <button
                      onClick={e => { e.stopPropagation(); setEliminando(tarea.id) }}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal completar */}
      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={onCompletada}
        />
      )}

      {/* Modal nueva tarea */}
      {mostrarNueva && cicloSeleccionado && (
        <NuevaTareaModal
          cicloSeleccionado={cicloSeleccionado}
          onClose={() => setMostrarNueva(false)}
          onCreada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
            setMostrarNueva(false)
          }}
        />
      )}

      {/* Modal confirmar eliminación */}
      {eliminando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-900/40 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white font-semibold">¿Eliminar tarea?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              Se eliminará permanentemente:
            </p>
            <p className="text-white text-sm font-medium bg-gray-800 rounded-lg px-3 py-2 mb-6">
              {tareaAEliminar?.nombre_tarea}
            </p>
            <p className="text-gray-500 text-xs mb-6">
              También se eliminarán las evidencias y registros de cumplimiento asociados. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEliminando(null)}
                disabled={loadingEliminar}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                           py-2.5 rounded-xl text-sm transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={loadingEliminar}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700
                           hover:bg-red-600 text-white py-2.5 rounded-xl text-sm
                           font-semibold transition disabled:opacity-50"
              >
                {loadingEliminar
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Eliminando...</>
                  : <><Trash2 className="w-4 h-4" /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}