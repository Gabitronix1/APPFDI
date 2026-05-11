import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import {
  CheckCircle2, Clock, AlertCircle, Filter, Plus, Trash2,
  RefreshCw, Sparkles, ChevronDown, ChevronUp, Lock, Pencil,
  CalendarClock, Search, X
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
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Bloqueo para tareas de serie futura
  const estaBloqueada = tarea.serie_id &&
    tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy

  const esFueraPlazo = !esCicloCerrado && !estaBloqueada &&
    tarea.alerta === 'fuera_de_plazo' &&
    tarea.estado !== 'completada' &&
    tarea.estado !== 'completada_con_atraso'

  const estilos = estaBloqueada
    ? { badge: 'bg-gray-800 text-gray-600', label: 'Bloqueada' }
    : esFueraPlazo
    ? { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' }
    : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente

  const borde = estaBloqueada
    ? 'border-gray-800'
    : esCicloCerrado
    ? 'border-gray-800'
    : ALERTA_BORDER[tarea.alerta] ?? 'border-gray-800'

  const icono = tarea.tipo === 'cierre'
    ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
    : tarea.tipo === 'recurrente_mes'
    ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
    : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />

  function handleClick() {
    if (estaBloqueada) return
    onClickTarea()
  }

  return (
    <div
      className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4 transition
        ${estaBloqueada ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer'}`}
    >
      <div className="shrink-0" onClick={handleClick}>
        {estaBloqueada
          ? <Lock className="w-5 h-5 text-gray-600" />
          : tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : tarea.estado === 'con_atraso' && !esCicloCerrado
          ? <AlertCircle className="w-5 h-5 text-red-400" />
          : tarea.estado === 'no_completada'
          ? <AlertCircle className="w-5 h-5 text-gray-500" />
          : <Clock className="w-5 h-5 text-gray-500" />}
      </div>

      <div className="flex-1 min-w-0" onClick={handleClick}>
        <div className="flex items-center gap-1.5">
          {icono}
          <p className={`font-medium truncate ${estaBloqueada ? 'text-gray-500' : 'text-white'}`}>
            {tarea.nombre_tarea}
          </p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          {tarea.responsable_nombre} · {tarea.area} ·{' '}
          {estaBloqueada
            ? <span className="text-gray-600">Disponible desde {tarea.fecha_inicio}</span>
            : <>Vence {tarea.fecha_termino}</>}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {tarea.total_evidencias > 0 && !estaBloqueada && (
          <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
        )}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>
          {estilos.label}
        </span>
        {!esCicloCerrado && !estaBloqueada && (
          <button
            onClick={e => { e.stopPropagation(); onEditar?.() }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {profile?.rol === 'admin' && onEliminar && !estaBloqueada && (
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
  const ordenadas = [...tareas].sort((a, b) => a.nombre_tarea.localeCompare(b.nombre_tarea, 'es'))
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
          {ordenadas.map(tarea => (
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

  const [busqueda, setBusqueda]                     = useState('')
  const [soloMias, setSoloMias]                     = useState(false)
  const [filtroIntegrante, setFiltroIntegrante]     = useState('todos')
  const [filtroArea, setFiltroArea]                 = useState('todas')
  const [tareaActiva, setTareaActiva]               = useState(null)
  const [mostrarNueva, setMostrarNueva]             = useState(false)
  const [eliminando, setEliminando]                 = useState(null)
  const [eliminarRecurrente, setEliminarRecurrente] = useState(false)
  const [eliminarSerie, setEliminarSerie]           = useState(false)
  const [loadingEliminar, setLoadingEliminar]       = useState(false)
  const [verCierre, setVerCierre]                   = useState(true)
  const [verRecurrentes, setVerRecurrentes]         = useState(true)
  const [verPuntuales, setVerPuntuales]             = useState(true)
  const [tareaDetalle, setTareaDetalle]             = useState(null)
  const [editando, setEditando]                     = useState(null)
  const [tareasSerieSeleccionadas, setTareasSerieSeleccionadas] = useState([])
  const [tareasSerieDelCiclo, setTareasSerieDelCiclo]           = useState([])

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id, profile?.departamento],
    enabled:  !!cicloSeleccionado?.id && !!profile?.departamento,
    queryFn: async () => {
      let query = supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloSeleccionado.id)
        .order('nombre_tarea', { ascending: true })
      if (profile?.rol !== 'gerente') {
        query = query.eq('departamento', profile?.departamento)
      }
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  // Integrantes únicos para el filtro
  const integrantes = useMemo(() => {
    const nombres = [...new Set(tareas.map(t => t.responsable_nombre).filter(Boolean))]
    return nombres.sort((a, b) => a.localeCompare(b, 'es'))
  }, [tareas])

  const areas = ['todas', ...new Set(tareas.map(t => t.area).filter(Boolean))]

  const tareasFiltradas = useMemo(() => tareas.filter(t => {
    if (soloMias && t.responsable_nombre !== profile?.nombre) return false
    if (filtroIntegrante !== 'todos' && t.responsable_nombre !== filtroIntegrante) return false
    if (filtroArea !== 'todas' && t.area !== filtroArea) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      return (
        t.nombre_tarea?.toLowerCase().includes(q) ||
        t.area?.toLowerCase().includes(q) ||
        t.responsable_nombre?.toLowerCase().includes(q)
      )
    }
    return true
  }), [tareas, soloMias, filtroIntegrante, filtroArea, busqueda, profile])

  const tareasCierre      = tareasFiltradas.filter(t => t.tipo === 'cierre')
  const tareasRecurrentes = tareasFiltradas.filter(t => t.tipo === 'recurrente_mes')
  const tareasPuntuales   = tareasFiltradas.filter(t => t.tipo === 'puntual' || (!t.tipo && !t.template_id))

  const tituloCiclo    = cicloSeleccionado ? nombreCiclo(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const tituloCierre   = cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const esCicloCerrado = cicloSeleccionado?.estado === 'cerrado'
  const tareaAEliminar = tareas.find(t => t.id === eliminando)

  const hayFiltrosActivos = busqueda || soloMias || filtroIntegrante !== 'todos' || filtroArea !== 'todas'

  function limpiarFiltros() {
    setBusqueda('')
    setSoloMias(false)
    setFiltroIntegrante('todos')
    setFiltroArea('todas')
  }

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

  async function handleAbrirEliminar(tareaId) {  // 👈 acá
    setEliminando(tareaId)
    const tarea = tareas.find(t => t.id === tareaId)
    if (tarea?.serie_id) {
      const { data } = await supabase
        .from('tasks')
        .select('id, nombre_tarea, fecha_termino, fecha_inicio, estado')
        .eq('serie_id', tarea.serie_id)
        .eq('ciclo_id', cicloSeleccionado.id)
        .order('fecha_termino', { ascending: true })
      const serie = data ?? []
      setTareasSerieDelCiclo(serie)
      setTareasSerieSeleccionadas([tareaId])
    } else {
      setTareasSerieDelCiclo([])
      setTareasSerieSeleccionadas([])
    }
  }

  async function handleEliminar() {
  if (!eliminando) return
  setLoadingEliminar(true)
  try {
    const idsAEliminar = tareaAEliminar?.serie_id && tareasSerieSeleccionadas.length > 0
      ? tareasSerieSeleccionadas
      : [eliminando]

    await supabase.from('evidencias').delete().in('task_id', idsAEliminar)
    await supabase.from('task_completions').delete().in('task_id', idsAEliminar)
    await supabase.from('tasks').delete().in('id', idsAEliminar)

    if (eliminarRecurrente && tareaAEliminar?.template_id) {
      await supabase.from('task_templates')
        .update({ activo: false })
        .eq('id', tareaAEliminar.template_id)
    }

    queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
    setEliminando(null)
    setEliminarRecurrente(false)
    setEliminarSerie(false)
    setTareasSerieSeleccionadas([])
    setTareasSerieDelCiclo([])
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

      {/* Buscador */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, área o responsable..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-9 py-2.5
                     text-white text-sm focus:outline-none focus:border-green-500 transition"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">

        {/* Solo mis tareas */}
        <button
          onClick={() => { setSoloMias(!soloMias); setFiltroIntegrante('todos') }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition
            ${soloMias ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          <Filter className="w-4 h-4" />
          Solo mis tareas
        </button>

        {/* Filtro por integrante */}
        <select
          value={filtroIntegrante}
          onChange={e => { setFiltroIntegrante(e.target.value); setSoloMias(false) }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2
                     focus:outline-none focus:border-green-500"
        >
          <option value="todos">Todos los integrantes</option>
          {integrantes.map(n => (
            <option key={n} value={n}>{n.split(' ')[0]} {n.split(' ')[1]}</option>
          ))}
        </select>

        {/* Filtro por área */}
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

        {/* Limpiar filtros */}
        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400
                       hover:text-white bg-gray-800 hover:bg-gray-700 transition"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Banner ciclo cerrado */}
      {esCicloCerrado && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700
                        rounded-xl px-4 py-3 mb-6 text-sm text-gray-400">
          <Lock className="w-4 h-4 shrink-0" />
          Este ciclo está cerrado — solo lectura.
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-2">No hay tareas con ese filtro</p>
          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros} className="text-green-400 text-sm hover:text-green-300 transition">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">

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
            onEliminar={handleAbrirEliminar}
          />

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
            onEliminar={handleAbrirEliminar}
          />

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
            onEliminar={handleAbrirEliminar}
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

      {/* Selector de tareas de la serie */}
      {tareaAEliminar?.serie_id && tareasSerieDelCiclo.length > 1 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2 font-medium">
            Selecciona las tareas a eliminar este mes:
          </p>
          <div className="space-y-1.5">
            {tareasSerieDelCiclo.map(t => {
              const seleccionada = tareasSerieSeleccionadas.includes(t.id)
              const bloqueada    = eliminarRecurrente // si elimina futuros, están todas forzadas
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition
                    ${seleccionada
                      ? 'bg-red-950/50 border-red-700'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'}
                    ${bloqueada ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionada}
                    disabled={bloqueada}
                    onChange={() => {
                      if (bloqueada) return
                      setTareasSerieSeleccionadas(prev =>
                        prev.includes(t.id)
                          ? prev.filter(id => id !== t.id)
                          : [...prev, t.id]
                      )
                    }}
                    className="accent-red-500 w-4 h-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{t.fecha_termino}</p>
                    <p className="text-xs text-gray-500">
                      {t.estado === 'completada' || t.estado === 'completada_con_atraso'
                        ? '✅ completada'
                        : t.estado === 'pendiente'
                        ? '⏳ pendiente'
                        : t.estado}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Eliminar de ciclos futuros */}
      {tareaAEliminar?.template_id && (
        <label
          className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 cursor-pointer border transition
            ${eliminarRecurrente
              ? 'bg-red-950 border-red-700'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
        >
          <input
            type="checkbox"
            checked={eliminarRecurrente}
            onChange={e => {
              const val = e.target.checked
              setEliminarRecurrente(val)
              // Si activa "futuros", seleccionar todas automáticamente
              if (val && tareaAEliminar?.serie_id) {
                setTareasSerieSeleccionadas(tareasSerieDelCiclo.map(t => t.id))
              }
            }}
            className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
          />
          <div>
            <p className="text-sm text-white font-medium">Eliminar también de ciclos futuros</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tareaAEliminar?.serie_id
                ? 'Se seleccionarán todas las tareas de la serie y no se generarán en próximos meses'
                : 'La tarea dejará de generarse automáticamente en próximos meses'}
            </p>
          </div>
        </label>
      )}

      <p className="text-gray-500 text-xs mb-6">
        {eliminarRecurrente
          ? 'Se eliminará del ciclo actual y no se generará en futuros ciclos.'
          : tareasSerieSeleccionadas.length > 1
          ? `Se eliminarán ${tareasSerieSeleccionadas.length} tareas de este ciclo.`
          : 'Solo se eliminará del ciclo actual.'}
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => {
            setEliminando(null)
            setEliminarRecurrente(false)
            setEliminarSerie(false)
            setTareasSerieSeleccionadas([])
            setTareasSerieDelCiclo([])
          }}
          disabled={loadingEliminar}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                     py-2.5 rounded-xl text-sm transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleEliminar}
          disabled={loadingEliminar || (tareaAEliminar?.serie_id && tareasSerieSeleccionadas.length === 0)}
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
