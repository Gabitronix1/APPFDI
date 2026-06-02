import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TaskModal from '../components/TaskModal'
import {
  CheckCircle2, Clock, AlertCircle, Filter, Plus, Trash2,
  RefreshCw, Sparkles, Lock, Pencil,
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

function CondicionBadge({ condicion, frecuencia }) {
  if (frecuencia === 'semanal' || frecuencia === 'quincenal') return null
  if (condicion === 'habil')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-900/50 text-blue-300">Día hábil</span>
  if (condicion === 'dia_real')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-800 text-gray-500">Día cal.</span>
  return null
}

function nombreCiclo(mes, anio) {
  return `${MESES[mes - 1]} ${anio}`
}

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

function TareaItem({ tarea, profile, onClickTarea, onEditar, onEliminar, esCicloCerrado, esCicloInactivo, impactoDep }) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

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

  return (
    <div
      className={`bg-gray-950 border ${borde} rounded-xl p-3 flex flex-col gap-2 transition
        ${estaBloqueada ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800/60 cursor-pointer'}`}
    >
      {/* Fila superior: ícono estado + nombre */}
      <div className="flex items-start gap-2" onClick={estaBloqueada ? undefined : onClickTarea}>
        <div className="shrink-0 mt-0.5">
          {estaBloqueada
            ? <Lock className="w-4 h-4 text-gray-600" />
            : tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : tarea.estado === 'con_atraso' && !esCicloCerrado
            ? <AlertCircle className="w-4 h-4 text-red-400" />
            : tarea.estado === 'no_completada'
            ? <AlertCircle className="w-4 h-4 text-gray-500" />
            : <Clock className="w-4 h-4 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            {icono}
            <p className={`text-sm font-medium leading-tight ${estaBloqueada ? 'text-gray-500' : 'text-white'}`}>
              {tarea.nombre_tarea}
            </p>
          </div>
          <p className="text-gray-500 text-xs truncate">{tarea.responsable_nombre}</p>
        </div>
      </div>

      {/* Fila inferior: fecha + badge + acciones */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-gray-600 text-xs">
          {estaBloqueada
            ? <span className="text-gray-700">desde {tarea.fecha_inicio}</span>
            : <>📅 {tarea.fecha_termino}</>}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {tarea.total_evidencias > 0 && !estaBloqueada && (
            <span className="text-xs text-gray-600">{tarea.total_evidencias}📎</span>
          )}
          <CondicionBadge condicion={tarea.condicion} frecuencia={tarea.frecuencia} />
          {impactoDep && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-900/50 text-amber-300"
              title={`Depende de "${impactoDep.nombre_tarea}" (${impactoDep.departamento}) con ${impactoDep.impacto_atraso} día${impactoDep.impacto_atraso !== 1 ? 's' : ''} de atraso`}
            >
              ⚠️ Dep. con atraso
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estilos.badge}`}>
            {estilos.label}
          </span>
          {!esCicloCerrado && !esCicloInactivo && !estaBloqueada && (
            <button
              onClick={e => { e.stopPropagation(); onEditar?.() }}
              className="p-1 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onEliminar && !estaBloqueada &&
            ((profile?.rol === 'admin' || profile?.rol === 'subgerente') ||
             (tarea.responsable_id === profile?.id && tarea.estado === 'pendiente')) && (
            <button
              onClick={e => { e.stopPropagation(); onEliminar() }}
              className="p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COLUMNA KANBAN ───────────────────────────────────────────────────────────
function ColumnaKanban({ titulo, icono, iconoColor, accentBg, tareas, profile,
  esCicloCerrado, esCicloInactivo, onClickTarea, onEditar, onEliminar, activa, onTabClick, impactosDep }) {

  const ordenadas = [...tareas].sort((a, b) => a.nombre_tarea.localeCompare(b.nombre_tarea, 'es'))

  const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const pct = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0
  const colorPct = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className={`flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden
      transition-all duration-200
      ${activa ? 'flex-1' : 'flex-none w-auto'}`}
    >
      {/* Header sticky */}
      <div
        onClick={onTabClick}
        className={`sticky top-0 z-10 px-4 py-3 border-b border-gray-800 ${accentBg} cursor-pointer`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={iconoColor}>{icono}</span>
            <span className="text-white font-semibold text-sm truncate">{titulo}</span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
              {tareas.length}
            </span>
          </div>
          <span className={`text-sm font-bold shrink-0 ${colorPct}`}>{pct}%</span>
        </div>
      </div>

      {/* Tareas con scroll independiente */}
      {activa && (
        <div className="overflow-y-auto flex-1 p-3 space-y-2 scroll-dark"
          style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {ordenadas.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">Sin tareas</p>
          ) : ordenadas.map(tarea => (
            <TareaItem
              key={tarea.id}
              tarea={tarea}
              profile={profile}
              esCicloCerrado={esCicloCerrado}
              esCicloInactivo={esCicloInactivo}
              onClickTarea={() => onClickTarea(tarea)}
              onEditar={() => onEditar(tarea)}
              onEliminar={(esCicloCerrado || esCicloInactivo) ? null : () => onEliminar(tarea.id)}
              impactoDep={impactosDep?.[tarea.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Tareas({ cicloSeleccionado, deptoActivo: deptoActivoProp, onCambiarDepto }) {
  const { profile, deptosAsignados, esSubgerente } = useAuth()
  const queryClient  = useQueryClient()

  const [deptoLocal, setDeptoLocal] = useState(
    () => esSubgerente ? (deptosAsignados[0] ?? profile?.departamento) : profile?.departamento
  )
  const deptoActivo = (esSubgerente && deptoActivoProp) ? deptoActivoProp : deptoLocal
  const setDeptoActivo = (esSubgerente && onCambiarDepto) ? onCambiarDepto : setDeptoLocal

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
  const [templateIdEliminar, setTemplateIdEliminar] = useState(null)
  const [tareaDetalle, setTareaDetalle]             = useState(null)
  const [editando, setEditando]                     = useState(null)
  const [tareasSerieSeleccionadas, setTareasSerieSeleccionadas] = useState([])
  const [tareasSerieDelCiclo, setTareasSerieDelCiclo]           = useState([])

  // Control de columnas activas (en mobile: tab activo, en desktop: todas activas)
  const [columnaActiva, setColumnaActiva] = useState('cierre')

  const { data: cicloDepto } = useQuery({
    queryKey: ['ciclo-tareas-subgerente', deptoActivo],
    enabled: esSubgerente && !!deptoActivo,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('departamento', deptoActivo)
        .eq('estado', 'activo')
        .maybeSingle()
      return data ?? null
    }
  })

  // ── MULTI-DEPTO usuario/admin con tareas cruzadas (NO subgerente) ──────────
  // Deptos donde el usuario tiene tareas en el período del ciclo seleccionado.
  const { data: misDeptosConTareasRaw = [] } = useQuery({
    queryKey: ['mis-deptos-tareas-tareas', profile?.id, cicloSeleccionado?.mes, cicloSeleccionado?.anio],
    enabled: !esSubgerente && !!profile?.id
      && (profile?.rol === 'usuario' || profile?.rol === 'admin')
      && !!cicloSeleccionado?.mes,
    queryFn: async () => {
      const { data: ciclosPeriodo } = await supabase
        .from('monthly_cycles')
        .select('id, departamento')
        .eq('mes', cicloSeleccionado.mes)
        .eq('anio', cicloSeleccionado.anio)
      const cicloIds = (ciclosPeriodo ?? []).map(c => c.id)
      if (cicloIds.length === 0) return []
      const { data: misTareas } = await supabase
        .from('tasks')
        .select('departamento')
        .in('ciclo_id', cicloIds)
        .eq('responsable_id', profile.id)
      return [...new Set((misTareas ?? []).map(t => t.departamento).filter(Boolean))]
    }
  })

  // Deptos disponibles: SIEMPRE incluye el propio (para no quedar atrapado).
  const deptosDisponiblesUsuario = useMemo(() => {
    const set = new Set(misDeptosConTareasRaw)
    if (profile?.departamento) set.add(profile.departamento)
    return [...set].sort()
  }, [misDeptosConTareasRaw, profile?.departamento])

  // Depto activo del usuario/admin cruzado (default: su propio depto).
  const [deptoUsuarioCruzado, setDeptoUsuarioCruzado] = useState(null)

  useEffect(() => {
    if (!esSubgerente && !deptoUsuarioCruzado && deptosDisponiblesUsuario.length > 0) {
      setDeptoUsuarioCruzado(profile?.departamento ?? deptosDisponiblesUsuario[0])
    }
  }, [deptosDisponiblesUsuario, profile, esSubgerente])

  const esDeptoPropioUsuario = !deptoUsuarioCruzado || deptoUsuarioCruzado === profile?.departamento

  // Ciclo del depto cruzado (cuando el usuario/admin ve un depto que no es el suyo).
  const { data: cicloCruzado } = useQuery({
    queryKey: ['ciclo-cruzado-tareas', deptoUsuarioCruzado, cicloSeleccionado?.mes, cicloSeleccionado?.anio],
    enabled: !esSubgerente && !esDeptoPropioUsuario && !!deptoUsuarioCruzado && !!cicloSeleccionado?.mes,
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('departamento', deptoUsuarioCruzado)
        .eq('mes', cicloSeleccionado.mes)
        .eq('anio', cicloSeleccionado.anio)
        .maybeSingle()
      return data ?? null
    }
  })

  const cicloEfectivo      = esSubgerente
    ? cicloDepto
    : (!esDeptoPropioUsuario ? (cicloCruzado ?? cicloSeleccionado) : cicloSeleccionado)
  const esAdminOSubgerente = profile?.rol === 'admin' || profile?.rol === 'subgerente'

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloEfectivo?.id,
      esSubgerente ? deptoActivo : deptoUsuarioCruzado, !esDeptoPropioUsuario],
    enabled:  !!cicloEfectivo?.id && !!(esSubgerente ? deptoActivo : (deptoUsuarioCruzado ?? profile?.departamento)),
    queryFn: async () => {
      const deptoBuscar = esSubgerente ? deptoActivo : (deptoUsuarioCruzado ?? profile?.departamento)
      let query = supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloEfectivo.id)
        .order('nombre_tarea', { ascending: true })
      if (profile?.rol !== 'gerente') {
        query = query.eq('departamento', deptoBuscar)
      }
      // En depto CRUZADO: filtrar solo MIS tareas (no todo el equipo)
      if (!esSubgerente && !esDeptoPropioUsuario) {
        query = query.eq('responsable_id', profile.id)
      }
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  const taskIds = useMemo(() => tareas.map(t => t.id), [tareas])

  const { data: impactosDep = {} } = useQuery({
    queryKey: ['impactos-dep', cicloSeleccionado?.id, taskIds],
    enabled:  taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select('task_id, impacto_atraso, depends_on:depends_on_id(nombre_tarea, departamento)')
        .in('task_id', taskIds)
        .gt('impacto_atraso', 0)
      if (error) throw error
      const mapa = {}
      for (const row of data ?? []) {
        mapa[row.task_id] = {
          impacto_atraso: row.impacto_atraso,
          nombre_tarea:   row.depends_on?.nombre_tarea ?? '',
          departamento:   row.depends_on?.departamento ?? '',
        }
      }
      return mapa
    }
  })

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

  const tituloCiclo    = cicloEfectivo ? nombreCiclo(cicloEfectivo.mes, cicloEfectivo.anio) : ''
  const tituloCierre   = cicloEfectivo ? nombreCierre(cicloEfectivo.mes, cicloEfectivo.anio) : ''
  const esCicloCerrado  = cicloEfectivo?.estado === 'cerrado'
  const esCicloInactivo = cicloEfectivo?.estado === 'inactivo'
  const tareaAEliminar = tareas.find(t => t.id === eliminando)
  const hayFiltrosActivos = busqueda || soloMias || filtroIntegrante !== 'todos' || filtroArea !== 'todas'

  function limpiarFiltros() {
    setBusqueda('')
    setSoloMias(false)
    setFiltroIntegrante('todos')
    setFiltroArea('todas')
  }

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas', cicloEfectivo?.id] })
    setTareaActiva(null)
  }

  function handleClickTarea(tarea) {
    // Ciclo inactivo: pendiente y con_atraso se pueden completar normalmente
    if (esCicloInactivo && (tarea.estado === 'pendiente' || tarea.estado === 'con_atraso')) {
      setTareaActiva(tarea)
    } else if (esCicloCerrado || tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada') {
      setTareaDetalle(tarea)
    } else {
      setTareaActiva(tarea)
    }
  }

  async function handleAbrirEliminar(tareaId) {
    setEliminando(tareaId)

    // Usuarios normales: modal simple, sin opciones de serie ni ciclos futuros
    if (!esAdminOSubgerente) return

    const tarea = tareas.find(t => t.id === tareaId)

    const { data: taskData } = await supabase
      .from('tasks')
      .select('template_id')
      .eq('id', tareaId)
      .single()
    setTemplateIdEliminar(taskData?.template_id ?? null)

    if (tarea?.serie_id) {
      const { data } = await supabase
        .from('tasks')
        .select('id, nombre_tarea, fecha_termino, fecha_inicio, estado')
        .eq('serie_id', tarea.serie_id)
        .eq('ciclo_id', cicloEfectivo.id)
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

      const templateId = tareaAEliminar?.template_id || templateIdEliminar
      if (eliminarRecurrente && templateId) {
        await supabase.from('task_templates')
          .update({ activo: false })
          .eq('id', templateId)
      }

      queryClient.invalidateQueries({ queryKey: ['tareas', cicloEfectivo?.id] })
      setEliminando(null)
      setEliminarRecurrente(false)
      setEliminarSerie(false)
      setTareasSerieSeleccionadas([])
      setTareasSerieDelCiclo([])
      setTemplateIdEliminar(null)
    } catch (err) {
      console.error('Error al eliminar:', err)
    } finally {
      setLoadingEliminar(false)
    }
  }

  const columnas = [
    {
      id:          'cierre',
      titulo:      tituloCierre,
      icono:       <RefreshCw className="w-4 h-4" />,
      iconoColor:  'text-blue-400',
      accentBg:    'bg-blue-950/20',
      tareas:      tareasCierre,
    },
    {
      id:          'recurrentes',
      titulo:      `Recurrentes`,
      icono:       <CalendarClock className="w-4 h-4" />,
      iconoColor:  'text-purple-400',
      accentBg:    'bg-purple-950/20',
      tareas:      tareasRecurrentes,
    },
    {
      id:          'puntuales',
      titulo:      `Puntuales`,
      icono:       <Sparkles className="w-4 h-4" />,
      iconoColor:  'text-amber-400',
      accentBg:    'bg-amber-950/20',
      tareas:      tareasPuntuales,
    },
  ]

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tareas del equipo</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-green-400">{tituloCiclo}</span>
            {' · '}{tareasFiltradas.length} tareas
          </p>
        </div>
        {cicloEfectivo?.estado === 'activo' && (
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

      {/* Selector de depto — solo subgerente con múltiples deptos */}
      {esSubgerente && deptosAsignados.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {deptosAsignados.map(depto => (
            <button
              key={depto}
              onClick={() => setDeptoActivo(depto)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                deptoActivo === depto
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {depto}
            </button>
          ))}
        </div>
      )}

      {/* Selector de depto — usuario/admin con tareas cruzadas (NO subgerente) */}
      {!esSubgerente && (profile?.rol === 'usuario' || profile?.rol === 'admin')
        && deptosDisponiblesUsuario.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <span className="text-xs text-gray-500">Departamento:</span>
          {deptosDisponiblesUsuario.map(depto => (
            <button
              key={depto}
              onClick={() => setDeptoUsuarioCruzado(depto)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                deptoUsuarioCruzado === depto
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {depto}{depto === profile?.departamento ? ' (mi depto)' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Buscador + Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar..."
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

        <button
          onClick={() => { setSoloMias(!soloMias); setFiltroIntegrante('todos') }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition
            ${soloMias ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          <Filter className="w-4 h-4" />
          Solo mis tareas
        </button>

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

      {esCicloCerrado && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700
                        rounded-xl px-4 py-3 mb-4 text-sm text-gray-400">
          <Lock className="w-4 h-4 shrink-0" />
          Este ciclo está cerrado — solo lectura.
        </div>
      )}

      {esCicloInactivo && (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-800
                        rounded-xl px-4 py-3 mb-4 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Este ciclo está inactivo — solo puedes completar tareas pendientes.
        </div>
      )}

      {/* Kanban */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop: 3 columnas */}
          <div className="hidden md:flex gap-4 items-start">
            {columnas.map(col => (
              <ColumnaKanban
                key={col.id}
                {...col}
                activa={true}
                onTabClick={() => {}}
                profile={profile}
                esCicloCerrado={esCicloCerrado}
                esCicloInactivo={esCicloInactivo}
                onClickTarea={handleClickTarea}
                onEditar={setEditando}
                onEliminar={handleAbrirEliminar}
                impactosDep={impactosDep}
              />
            ))}
          </div>

          {/* Mobile: tabs */}
          <div className="md:hidden">
            <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-4">
              {columnas.map(col => (
                <button
                  key={col.id}
                  onClick={() => setColumnaActiva(col.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                    text-xs font-medium transition
                    ${columnaActiva === col.id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <span className={col.iconoColor}>{col.icono}</span>
                  <span>{col.titulo.split(' ')[0]}</span>
                  <span className="text-gray-600 text-xs">({col.tareas.length})</span>
                </button>
              ))}
            </div>
            {columnas.filter(c => c.id === columnaActiva).map(col => (
              <ColumnaKanban
                key={col.id}
                {...col}
                activa={true}
                onTabClick={() => {}}
                profile={profile}
                esCicloCerrado={esCicloCerrado}
                esCicloInactivo={esCicloInactivo}
                onClickTarea={handleClickTarea}
                onEditar={setEditando}
                onEliminar={handleAbrirEliminar}
                impactosDep={impactosDep}
              />
            ))}
          </div>
        </>
      )}

      {/* Modales */}
      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={onCompletada}
        />
      )}

      {mostrarNueva && cicloEfectivo && (
        <NuevaTareaModal
          cicloSeleccionado={cicloEfectivo}
          departamentoForzado={esSubgerente ? deptoActivo : undefined}
          onClose={() => setMostrarNueva(false)}
          onCreada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas', cicloEfectivo?.id] })
            setMostrarNueva(false)
          }}
        />
      )}

      {eliminando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">

          {/* ── Modal simple para usuarios normales ── */}
          {!esAdminOSubgerente ? (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-900/40 rounded-xl">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white font-semibold">¿Eliminar tarea?</h3>
              </div>
              <p className="text-white text-sm font-medium bg-gray-800 rounded-lg px-3 py-2 mb-3">
                {tareaAEliminar?.nombre_tarea}
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Solo se eliminará del ciclo actual.
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

          ) : (
          /* ── Modal completo para admin ── */
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

            {tareaAEliminar?.serie_id && tareasSerieDelCiclo.length > 1 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2 font-medium">
                  Selecciona las tareas a eliminar este mes:
                </p>
                <div className="space-y-1.5">
                  {tareasSerieDelCiclo.map(t => {
                    const seleccionada = tareasSerieSeleccionadas.includes(t.id)
                    const bloqueada    = eliminarRecurrente
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition
                          ${seleccionada ? 'bg-red-950/50 border-red-700' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}
                          ${bloqueada ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          disabled={bloqueada}
                          onChange={() => {
                            if (bloqueada) return
                            setTareasSerieSeleccionadas(prev =>
                              prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                            )
                          }}
                          className="accent-red-500 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white">{t.fecha_termino}</p>
                          <p className="text-xs text-gray-500">
                            {t.estado === 'completada' || t.estado === 'completada_con_atraso' ? '✅ completada'
                              : t.estado === 'pendiente' ? '⏳ pendiente' : t.estado}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {(tareaAEliminar?.template_id || templateIdEliminar) && (
              <label className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 cursor-pointer border transition
                ${eliminarRecurrente ? 'bg-red-950 border-red-700' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
              >
                <input
                  type="checkbox"
                  checked={eliminarRecurrente}
                  onChange={e => {
                    const val = e.target.checked
                    setEliminarRecurrente(val)
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
                  setTemplateIdEliminar(null)
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
          )}
        </div>
      )}

      {editando && (
        <EditarTareaModal
          tarea={editando}
          cicloId={cicloEfectivo?.id}
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
