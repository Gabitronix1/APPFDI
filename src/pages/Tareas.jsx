import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import {
  CheckCircle2, Clock, AlertCircle, Filter, Plus, Trash2,
  RefreshCw, Sparkles, ChevronDown, ChevronUp, Lock, Pencil, CalendarClock
} from 'lucide-react'
import NuevaTareaModal from '../components/NuevaTareaModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import EditarTareaModal from '../components/EditarTareaModal'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const ESTADO_STYLES = {
  pendiente:             { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  con_atraso:            { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  completada:            { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Entregada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
}

const ALERTA_BORDER = {
  ok:             'border-gray-800',
  por_vencer:     'border-amber-500',
  fuera_de_plazo: 'border-red-500',
}

function nombreCiclo(mes, anio) {
  return `${MESES[mes - 1]} ${anio}`
}

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

function TareaItem({ tarea, profile, onClickTarea, onEditar, onEliminar, esCicloCerrado }) {
  const esFueraPlazo = !esCicloCerrado &&
    tarea.alerta === 'fuera_de_plazo' &&
    tarea.estado !== 'completada' &&
    tarea.estado !== 'completada_con_atraso'

  const estilos = esFueraPlazo
    ? { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' }
    : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente

  const borde = esCicloCerrado
    ? 'border-gray-800'
    : ALERTA_BORDER[tarea.alerta] ?? 'border-gray-800'

  const icono = tarea.tipo === 'cierre'
    ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
    : tarea.tipo === 'recurrente_mes'
    ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
    : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />

  return (
    <div className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4 hover:bg-gray-800 transition cursor-pointer`}>
      <div className="shrink-0 cursor-pointer" onClick={onClickTarea}>
        {tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : tarea.estado === 'con_atraso' && !esCicloCerrado
          ? <AlertCircle className="w-5 h-5 text-red-400" />
          : tarea.estado === 'no_completada'
          ? <AlertCircle className="w-5 h-5 text-gray-500" />
          : <Clock className="w-5 h-5 text-gray-500" />}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClickTarea}>
        <div className="flex items-center gap-1.5">
          {icono}
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
        {!esCicloCerrado && (
          <button
            onClick={e => { e.stopPropagation(); onEditar?.() }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
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

// ─── GRUPO COLAPSABLE ─────────────────────────────────────────────────────────
function GrupoTareas({ titulo, icono, iconoColor, tareas, ver, onToggle, profile,
  esCicloCerrado, onClickTarea, onEditar, onEliminar }) {
  if (tareas.length === 0) return null
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 mb-3 w-full group"
      >
        <span className={iconoColor}>{icono}</span>
        <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition">
          {titulo}
        </span>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
          {tareas.length}
        </span>
        <span className="ml-auto text-gray-600">
          {ver ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {ver && (
        <div className="space-y-3">
          {tareas.map(tarea => (
            <TareaItem
              key={tarea.id}
              tarea={tarea}
              profile={profile}
              esCicloCerrado={esCicloCerrado}
              onClickTarea={() => onClickTarea(tarea)}
              onEditar={() => onEditar(tarea)}
              onEliminar={esCicloCerrado ? null : () => onEliminar(tarea.id)}
            />
          ))}
        </div>
      )}
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
  const [verCierre, setVerCierre]                   = useState(true)
  const [verRecurrentes, setVerRecurrentes]         = useState(true)
  const [verPuntuales, setVerPuntuales]             = useState(true)
  const [tareaDetalle, setTareaDetalle]             = useState(null)
  const [editando, setEditando]                     = useState(null)

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

  // ── 3 grupos ──────────────────────────────────────────────────────────────
  const tareasCierre      = tareasFiltradas.filter(t => t.tipo === 'cierre')
  const tareasRecurrentes = tareasFiltradas.filter(t => t.tipo === 'recurrente_mes')
  const tareasPuntuales   = tareasFiltradas.filter(t => t.tipo === 'puntual' || (!t.tipo && !t.template_id))

  const tituloCiclo    = cicloSeleccionado ? nombreCiclo(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const tituloCierre   = cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const esCicloCerrado = cicloSeleccionado?.estado === 'cerrado'
  const tareaAEliminar = tareas.find(t => t.id === eliminando)

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
    setTareaActiva(null)
  }

  function handleClickTarea(tarea) {
    if (esCicloCerrado || tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada') {
      setTareaDetalle(tarea)
    } else {
      setTareaActiva(tarea)
    }
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
        await supabase.from('task_templates').update({ activo: false }).eq('id', tareaAEliminar.template_id)
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
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:border-green-500"
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
          Este ciclo está cerrado — solo lectura. No se pueden agregar ni modificar tareas.
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

          {/* ── CIERRE ──────────────────────────────────────────── */}
          <GrupoTareas
            titulo={tituloCierre}
            icono={<RefreshCw className="w-4 h-4" />}
            iconoColor="text-blue-400"
            tareas={tareasCierre}
            ver={verCierre}
            onToggle={() => setVerCierre(!verCierre)}
            profile={profile}
            esCicloCerrado={esCicloCerrado}
            onClickTarea={handleClickTarea}
            onEditar={setEditando}
            onEliminar={setEliminando}
          />

          {/* ── RECURRENTES DEL MES ─────────────────────────────── */}
          <GrupoTareas
            titulo={`Recurrentes de ${tituloCiclo}`}
            icono={<CalendarClock className="w-4 h-4" />}
            iconoColor="text-purple-400"
            tareas={tareasRecurrentes}
            ver={verRecurrentes}
            onToggle={() => setVerRecurrentes(!verRecurrentes)}
            profile={profile}
            esCicloCerrado={esCicloCerrado}
            onClickTarea={handleClickTarea}
            onEditar={setEditando}
            onEliminar={setEliminando}
          />

          {/* ── PUNTUALES ───────────────────────────────────────── */}
          <GrupoTareas
            titulo={`Tareas puntuales de ${tituloCiclo}`}
            icono={<Sparkles className="w-4 h-4" />}
            iconoColor="text-amber-400"
            tareas={tareasPuntuales}
            ver={verPuntuales}
            onToggle={() => setVerPuntuales(!verPuntuales)}
            profile={profile}
            esCicloCerrado={esCicloCerrado}
            onClickTarea={handleClickTarea}
            onEditar={setEditando}
            onEliminar={setEliminando}
          />

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

      {editando && (
        <EditarTareaModal
          tarea={editando}
          cicloId={cicloSeleccionado?.id}
          onClose={() => setEditando(null)}
        />
      )}

      {tareaDetalle && (
        <DetalleTareaPanel
          tarea={tareaDetalle}
          onClose={() => setTareaDetalle(null)}
        />
      )}
    </div>
  )
}
