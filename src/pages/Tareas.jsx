import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import { CheckCircle2, Clock, AlertCircle, Filter, Plus, Trash2, RefreshCw, Sparkles, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import NuevaTareaModal from '../components/NuevaTareaModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const ESTADO_STYLES = {
  pendiente:             { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  en_progreso:           { badge: 'bg-blue-800 text-blue-300',     label: 'En progreso' },
  completada:            { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Completada con atraso' },
  con_atraso:            { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
  fuera_de_plazo:        { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' },
}

const ALERTA_BORDER = {
  ok:             'border-gray-800',
  por_vencer:     'border-amber-500',
  fuera_de_plazo: 'border-red-500',
}

function TareaItem({ tarea, profile, onClickTarea, onEliminar }) {
  const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
  const estilos = esFueraPlazo
    ? ESTADO_STYLES.fuera_de_plazo
    : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente
  const borde = ALERTA_BORDER[tarea.alerta] ?? 'border-gray-800'

  return (
    <div className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4 hover:bg-gray-800 transition cursor-pointer`}>
      <div className="shrink-0 cursor-pointer" onClick={onClickTarea}>
        {tarea.estado === 'completada'
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : esFueraPlazo
          ? <AlertCircle className="w-5 h-5 text-orange-400" />
          : tarea.estado === 'con_atraso'
          ? <AlertCircle className="w-5 h-5 text-red-400" />
          : <Clock className="w-5 h-5 text-gray-500" />}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClickTarea}>
        <div className="flex items-center gap-1.5">
          {tarea.template_id
            ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
            : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
          <p className="text-white font-medium truncate">{tarea.nombre_tarea}</p>
        </div>
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
        {profile?.rol === 'admin' && onEliminar && (
          <button
            onClick={e => { e.stopPropagation(); onEliminar() }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Tareas({ cicloSeleccionado }) {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [soloMias, setSoloMias]                     = useState(false)
  const [filtroArea, setFiltroArea]                 = useState('todas')
  const [tareaActiva, setTareaActiva]               = useState(null)
  const [mostrarNueva, setMostrarNueva]             = useState(false)
  const [eliminando, setEliminando]                 = useState(null)
  const [eliminarRecurrente, setEliminarRecurrente] = useState(false)
  const [loadingEliminar, setLoadingEliminar]       = useState(false)
  const [verRecurrentes, setVerRecurrentes]         = useState(true)
  const [verNuevas, setVerNuevas]                   = useState(true)
  const [tareaDetalle, setTareaDetalle]             = useState(null)

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id, profile?.departamento],
    enabled:  !!cicloSeleccionado?.id && !!profile?.departamento,
    queryFn: async () => {
      let query = supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloSeleccionado.id)
        .order('fecha_termino', { ascending: true })
      if (profile?.rol !== 'gerente') {
        query = query.eq('departamento', profile?.departamento)
      }
      const { data, error } = await query
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

  const tareasRecurrentes = tareasFiltradas.filter(t => t.template_id)
  const tareasNuevas      = tareasFiltradas.filter(t => !t.template_id)

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
    setTareaActiva(null)
  }

  async function handleEliminar() {
    if (!eliminando) return
    setLoadingEliminar(true)
    try {
      await supabase.from('evidencias').delete().eq('task_id', eliminando)
      await supabase.from('task_completions').delete().eq('task_id', eliminando)
      const { error } = await supabase.from('tasks').delete().eq('id', eliminando)
      if (error) throw error
      if (eliminarRecurrente && tareaAEliminar?.template_id) {
        await supabase
          .from('task_templates')
          .update({ activo: false })
          .eq('id', tareaAEliminar.template_id)
      }
      queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
      setEliminando(null)
      setEliminarRecurrente(false)
    } catch (err) {
      console.error('Error al eliminar:', err)
    } finally {
      setLoadingEliminar(false)
    }
  }

  function nombreCierre(mes, anio) {
    if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
    return `Cierre de ${MESES[mes - 2]} ${anio}`
  }

  const tituloCiclo    = cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const esCicloCerrado = cicloSeleccionado?.estado === 'cerrado'
  const tareaAEliminar = tareas.find(t => t.id === eliminando)

  function handleClickTarea(tarea) {
    if (esCicloCerrado || tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada') {
      setTareaDetalle(tarea)
    } else {
      setTareaActiva(tarea)
    }
  }

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
        {!esCicloCerrado && (
          <button
            onClick={() => setMostrarNueva(true)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600
                       text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva tarea</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
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

      {/* Banner ciclo cerrado */}
      {esCicloCerrado && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700
                        rounded-xl px-4 py-3 mb-6 text-sm text-gray-400">
          <Lock className="w-4 h-4 shrink-0" />
          Este cierre está cerrado — solo lectura. No se pueden agregar ni modificar tareas.
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No hay tareas con ese filtro</div>
      ) : (
        <div className="space-y-6">

          {/* Cierre del mes */}
          {tareasRecurrentes.length > 0 && (
            <div>
              <button
                onClick={() => setVerRecurrentes(!verRecurrentes)}
                className="flex items-center gap-2 mb-3 w-full"
              >
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-gray-300">Tareas recurrentes</span>
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {tareasRecurrentes.length}
                </span>
                <span className="ml-auto text-gray-600">
                  {verRecurrentes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {verRecurrentes && (
                <div className="space-y-3">
                  {tareasRecurrentes.map(tarea => (
                    <TareaItem
                      key={tarea.id}
                      tarea={tarea}
                      profile={profile}
                      onClickTarea={() => handleClickTarea(tarea)}
                      onEliminar={esCicloCerrado ? null : () => setEliminando(tarea.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tareas del mes calendario */}
          {tareasNuevas.length > 0 && (
            <div>
              <button
                onClick={() => setVerNuevas(!verNuevas)}
                className="flex items-center gap-2 mb-3 w-full"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-gray-300">
                  Tareas de {MESES[new Date().getMonth()]} {new Date().getFullYear()}
                </span>
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {tareasNuevas.length}
                </span>
                <span className="ml-auto text-gray-600">
                  {verNuevas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {verNuevas && (
                <div className="space-y-3">
                  {tareasNuevas.map(tarea => (
                    <TareaItem
                      key={tarea.id}
                      tarea={tarea}
                      profile={profile}
                      onClickTarea={() => handleClickTarea(tarea)}
                      onEliminar={esCicloCerrado ? null : () => setEliminando(tarea.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
            <p className="text-gray-400 text-sm mb-2">Se eliminará permanentemente:</p>
            <p className="text-white text-sm font-medium bg-gray-800 rounded-lg px-3 py-2 mb-4">
              {tareaAEliminar?.nombre_tarea}
            </p>
            {tareaAEliminar?.template_id && (
              <label className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 cursor-pointer border transition
                ${eliminarRecurrente ? 'bg-red-950 border-red-700' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
              >
                <input
                  type="checkbox"
                  checked={eliminarRecurrente}
                  onChange={e => setEliminarRecurrente(e.target.checked)}
                  className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-sm text-white font-medium">Eliminar también de ciclos futuros</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    La tarea dejará de generarse automáticamente en próximos meses
                  </p>
                </div>
              </label>
            )}
            <p className="text-gray-500 text-xs mb-6">
              {eliminarRecurrente
                ? 'Se eliminará del ciclo actual y no se generará en futuros ciclos.'
                : 'Solo se eliminará del ciclo actual. Los ciclos futuros no se verán afectados.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setEliminando(null); setEliminarRecurrente(false) }}
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

      {/* Panel detalle tarea */}
      {tareaDetalle && (
        <DetalleTareaPanel
          tarea={tareaDetalle}
          onClose={() => setTareaDetalle(null)}
        />
      )}
    </div>
  )
}
