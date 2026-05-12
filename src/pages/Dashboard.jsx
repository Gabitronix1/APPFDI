import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Clock, AlertCircle, ListChecks, TrendingUp,
  User, Users, RefreshCw, Sparkles, X, Calendar, ChevronRight,
  CalendarClock, ChevronDown, ChevronUp, Lock
} from 'lucide-react'
import { useState, useMemo } from 'react'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import CalendarioTareas from '../components/CalendarioTareas'
import PanelRendimiento from '../components/PanelRendimiento'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function nombreCiclo(mes, anio) { return `${MESES[mes - 1]} ${anio}` }
function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}
function formatFechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`
}

function PctBadge({ pct }) {
  if (pct === null || pct === undefined)
    return <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">—</span>
  const color = pct === 100 ? 'bg-green-900 text-green-300'
    : pct >= 80 ? 'bg-amber-900 text-amber-300'
    : pct >= 50 ? 'bg-orange-900 text-orange-300'
    : 'bg-red-900 text-red-300'
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{pct}%</span>
}

function TareaRow({ tarea, onClick, esCicloCerrado }) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy
  const esFueraPlazo = !esCicloCerrado && !estaBloqueada &&
    tarea.alerta === 'fuera_de_plazo' &&
    tarea.estado !== 'completada' && tarea.estado !== 'completada_con_atraso'
  const borderColor = estaBloqueada ? 'border-gray-800'
    : esCicloCerrado ? 'border-gray-800'
    : { ok: 'border-gray-800', por_vencer: 'border-amber-500', fuera_de_plazo: 'border-red-500' }[tarea.alerta] ?? 'border-gray-800'
  const badge = estaBloqueada ? 'bg-gray-800 text-gray-600'
    : esFueraPlazo ? 'bg-orange-900 text-orange-300'
    : { pendiente: 'bg-gray-800 text-gray-300', con_atraso: 'bg-red-900 text-red-300',
        completada_con_atraso: 'bg-yellow-900 text-yellow-300', no_completada: 'bg-gray-800 text-gray-500'
      }[tarea.estado] ?? 'bg-gray-800 text-gray-300'
  const label = estaBloqueada ? 'Bloqueada'
    : esFueraPlazo ? 'Fuera de plazo'
    : tarea.estado === 'con_atraso' ? 'Atrasada'
    : tarea.estado === 'no_completada' ? 'No completada'
    : tarea.estado === 'completada_con_atraso' ? 'Entregada'
    : tarea.estado === 'completada' ? 'Completada'
    : tarea.estado === 'pendiente' ? 'Pendiente'
    : tarea.estado.replace(/_/g, ' ')
  const icono = tarea.tipo === 'cierre'
    ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
    : tarea.tipo === 'recurrente_mes'
    ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
    : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
  return (
    <div onClick={estaBloqueada ? undefined : onClick}
      className={`bg-gray-900/50 border ${borderColor} rounded-xl p-3 flex items-center
        justify-between gap-3 transition
        ${estaBloqueada ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:bg-gray-800' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {icono}
          <p className={`text-sm font-medium truncate ${estaBloqueada ? 'text-gray-500' : 'text-white'}`}>
            {tarea.nombre_tarea}
          </p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          {tarea.area} ·{' '}
          {estaBloqueada
            ? <span className="text-gray-600">Desde {tarea.fecha_inicio}</span>
            : <>Vence {tarea.fecha_termino}</>}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>{label}</span>
    </div>
  )
}

// ─── FILA COMPACTA DE MÉTRICAS ────────────────────────────────────────────────
function FilaMetricas({ tareasCierre, tareasRecurrentes, tareasPuntuales,
  tituloCierre, tituloCiclo, esCicloCerrado, onClickBloque }) {

  const calcStats = (tareas) => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const exigibles = tareas.filter(t =>
      !(t.serie_id && t.fecha_inicio && new Date(t.fecha_inicio + 'T00:00:00') > hoy))
    const completadas = exigibles.filter(t => t.estado === 'completada').length
    const atraso      = exigibles.filter(t => t.estado === 'completada_con_atraso').length
    const pendientes  = exigibles.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
    const atrasadas   = exigibles.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
    const pct         = exigibles.length ? Math.round(((completadas + atraso) / exigibles.length) * 100) : 0
    const conPct      = exigibles.filter(t => t.porcentaje_cumplimiento !== null)
    const calidad     = conPct.length ? Math.round(conPct.reduce((s,t) => s + t.porcentaje_cumplimiento, 0) / conPct.length) : null
    return { completadas, atraso, pendientes, atrasadas, pct, calidad, total: exigibles.length }
  }

  const bloques = [
    { id: 'cierre',      titulo: tituloCierre,  tareas: tareasCierre,      icono: <RefreshCw className="w-3.5 h-3.5" />,     color: 'text-blue-400',   border: 'hover:border-blue-700' },
    { id: 'recurrentes', titulo: 'Recurrentes', tareas: tareasRecurrentes, icono: <CalendarClock className="w-3.5 h-3.5" />, color: 'text-purple-400', border: 'hover:border-purple-700' },
    { id: 'puntuales',   titulo: 'Puntuales',   tareas: tareasPuntuales,   icono: <Sparkles className="w-3.5 h-3.5" />,      color: 'text-amber-400',  border: 'hover:border-amber-700' },
  ].filter(b => b.tareas.length > 0)

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${bloques.length}, 1fr)` }}>
      {bloques.map(b => {
        const s = calcStats(b.tareas)
        const colorPct   = s.pct === 100 ? 'text-green-400' : s.pct > 60 ? 'text-amber-400' : 'text-red-400'
        const colorBarra = s.pct === 100 ? 'bg-green-500'   : s.pct > 60 ? 'bg-amber-500'   : 'bg-red-500'
        return (
          <div key={b.id}
            onClick={() => onClickBloque(b.id, b.tareas, b.titulo)}
            className={`bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer
              transition ${b.border} hover:bg-gray-800/40`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className={b.color}>{b.icono}</span>
                <span className="text-xs font-semibold text-gray-300 truncate">{b.titulo}</span>
              </div>
              <span className={`text-lg font-bold ${colorPct}`}>{s.pct}%</span>
            </div>
            <div className="space-y-1.5 mb-3">
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all duration-700 ${colorBarra}`}
                  style={{ width: `${s.pct}%` }} />
              </div>
              {s.calidad !== null && (
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div className="h-1 rounded-full transition-all duration-700 bg-yellow-500"
                    style={{ width: `${s.calidad}%` }} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{s.completadas + s.atraso}/{s.total}</span>
              {s.calidad !== null && <span className="text-yellow-600">{s.calidad}% cal.</span>}
              {s.atrasadas > 0 && <span className="text-red-500">{s.atrasadas} ⚠</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DASHBOARD ADMIN ──────────────────────────────────────────────────────────
function DashboardAdmin({ tareas, tituloCiclo, cicloSeleccionado, isLoading, profile, esCicloCerrado }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [modalBloque,       setModalBloque]       = useState(null)
  const [filtroModalUsuario, setFiltroModalUsuario] = useState('todos')
  const [tareaDetalle,      setTareaDetalle]      = useState(null)
  const [tareaActiva,       setTareaActiva]       = useState(null)

  const tareasCierre      = tareas.filter(t => t.tipo === 'cierre')
  const tareasRecurrentes = tareas.filter(t => t.tipo === 'recurrente_mes')
  const tareasPuntuales   = tareas.filter(t => t.tipo === 'puntual' || (!t.tipo && !t.template_id))
  const tituloCierre      = cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : '—'

  const porIntegrante = tareas.reduce((acc, t) => {
    const nombre = t.responsable_nombre ?? 'Sin asignar'
    if (!acc[nombre]) acc[nombre] = { total: 0, completadas: 0, pendientes: 0, atrasadas: 0, fueraPlazo: 0 }
    acc[nombre].total++
    if (t.estado === 'completada' || t.estado === 'completada_con_atraso') acc[nombre].completadas++
    if (t.estado === 'pendiente' || t.estado === 'en_progreso') acc[nombre].pendientes++
    if (t.estado === 'con_atraso') acc[nombre].atrasadas++
    if (t.alerta === 'fuera_de_plazo' && t.estado !== 'completada') acc[nombre].fueraPlazo++
    return acc
  }, {})

  const { data: historial = [] } = useQuery({
    queryKey: ['historial-admin', profile?.departamento],
    queryFn: async () => {
      const { data: ciclosHist } = await supabase
        .from('monthly_cycles').select('id, mes, anio')
        .order('anio', { ascending: false }).order('mes', { ascending: false }).limit(12)
      if (!ciclosHist?.length) return []
      const results = []
      for (const c of ciclosHist) {
        const { data: tareasHist } = await supabase
          .from('v_tareas_ciclo_activo').select('estado, porcentaje_cumplimiento')
          .eq('ciclo_id', c.id).eq('departamento', profile?.departamento)
        if (!tareasHist?.length) continue
        const comp   = tareasHist.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
        const conPct = tareasHist.filter(t => t.porcentaje_cumplimiento !== null)
        results.push({
          mes: nombreCiclo(c.mes, c.anio),
          pct: Math.round((comp / tareasHist.length) * 100),
          completadas: comp, total: tareasHist.length,
          pctPromedio: conPct.length
            ? Math.round(conPct.reduce((s, t) => s + t.porcentaje_cumplimiento, 0) / conPct.length)
            : Math.round((comp / tareasHist.length) * 100)
        })
      }
      return results.reverse()
    }
  })

  function handleClickTarea(tarea) {
    if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada')
      setTareaDetalle(tarea)
    else setTareaActiva(tarea)
  }

  const misTareasPendientes = tareas.filter(t =>
    t.responsable_nombre === profile?.nombre &&
    !['completada', 'completada_con_atraso', 'no_completada'].includes(t.estado)
  )

  const calcModalStats = (tareasBloq) => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const exigibles = tareasBloq.filter(t =>
      !(t.serie_id && t.fecha_inicio && new Date(t.fecha_inicio + 'T00:00:00') > hoy))
    return {
      total:        exigibles.length,
      completadas:  exigibles.filter(t => t.estado === 'completada').length,
      atraso:       exigibles.filter(t => t.estado === 'completada_con_atraso').length,
      pendientes:   exigibles.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length,
      sinCompletar: exigibles.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length,
    }
  }

  return (
    <div className="space-y-5">

      {/* ── FILA COMPACTA DE MÉTRICAS ─────────────────────────── */}
      <FilaMetricas
        tareasCierre={tareasCierre}
        tareasRecurrentes={tareasRecurrentes}
        tareasPuntuales={tareasPuntuales}
        tituloCierre={tituloCierre}
        tituloCiclo={tituloCiclo}
        esCicloCerrado={esCicloCerrado}
        onClickBloque={(id, tareasBloq, titulo) => {
          setModalBloque({ id, tareas: tareasBloq, titulo })
          setFiltroModalUsuario('todos')
        }}
      />

      {/* ── CALENDARIO + EQUIPO ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CalendarioTareas
          tareas={tareas}
          onClickTarea={handleClickTarea}
          soloMia={false}
        />

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <Users className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold text-sm">Mi equipo hoy</h2>
          </div>
          <div className="divide-y divide-gray-800/50">
            {Object.entries(porIntegrante)
              .sort((a, b) => {
                const pctA = a[1].total ? (a[1].completadas / a[1].total) : 0
                const pctB = b[1].total ? (b[1].completadas / b[1].total) : 0
                return pctA - pctB
              })
              .map(([nombre, stats]) => {
                const pct      = stats.total ? Math.round((stats.completadas / stats.total) * 100) : 0
                const color    = pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
                const texto    = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
                const iniciales = nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)
                return (
                  <div key={nombre}
                    onClick={() => navigate(`/integrante/${encodeURIComponent(nombre)}`, { state: { cicloId: cicloSeleccionado?.id } })}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/40 cursor-pointer transition group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center shrink-0">
                      <span className="text-blue-300 text-xs font-bold">{iniciales}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium">{nombre.split(' ')[0]} {nombre.split(' ')[1]}</p>
                        <span className={`text-sm font-bold ${texto}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {stats.pendientes > 0 && <span className="text-xs text-amber-500">⏳ {stats.pendientes}</span>}
                        {stats.fueraPlazo > 0 && <span className="text-xs text-red-400">🔴 {stats.fueraPlazo}</span>}
                        {pct === 100 && <span className="text-xs text-green-400">✅ Al día</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition shrink-0" />
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* ── PANEL DE RENDIMIENTO ──────────────────────────────── */}
      <PanelRendimiento
        tareas={tareas}
        historial={historial}
        departamento={profile?.departamento}
      />

      {/* ── MIS TAREAS PENDIENTES ─────────────────────────────── */}
      {misTareasPendientes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-green-400" />
            <h2 className="text-white font-semibold text-sm">Mis tareas pendientes</h2>
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {misTareasPendientes.length}
            </span>
          </div>
          <div className="space-y-2">
            {misTareasPendientes.map(tarea => (
              <TareaRow key={tarea.id} tarea={tarea}
                onClick={() => !esCicloCerrado && handleClickTarea(tarea)}
                esCicloCerrado={esCicloCerrado} />
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL BLOQUE ──────────────────────────────────────── */}
      {modalBloque && (() => {
        const stats = calcModalStats(modalBloque.tareas)
        const integrantes = [...new Set(modalBloque.tareas.map(t => t.responsable_nombre).filter(Boolean))].sort()
        const tareasFiltradas = filtroModalUsuario === 'todos'
          ? modalBloque.tareas
          : modalBloque.tareas.filter(t => t.responsable_nombre === filtroModalUsuario)

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold">{modalBloque.titulo}</h3>
                <button onClick={() => setModalBloque(null)} className="text-gray-500 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Cuadraditos stats */}
              <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b border-gray-800">
                {[
                  { label: 'Total',         value: stats.total,        color: 'text-gray-300',   bg: 'bg-gray-800' },
                  { label: 'Completadas',   value: stats.completadas,  color: 'text-green-300',  bg: 'bg-green-900/40' },
                  { label: 'Entregadas',    value: stats.atraso,       color: 'text-yellow-300', bg: 'bg-yellow-900/40' },
                  { label: 'Sin completar', value: stats.sinCompletar, color: 'text-red-300',    bg: 'bg-red-900/40' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Filtro usuario */}
              {integrantes.length > 1 && (
                <div className="px-4 pt-3 pb-2 border-b border-gray-800">
                  <select
                    value={filtroModalUsuario}
                    onChange={e => setFiltroModalUsuario(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm
                               rounded-lg px-3 py-2 focus:outline-none focus:border-green-500"
                  >
                    <option value="todos">Todos los integrantes</option>
                    {integrantes.map(n => (
                      <option key={n} value={n}>{n.split(' ')[0]} {n.split(' ')[1]}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Lista tareas */}
              <div className="overflow-y-auto p-4 space-y-2 scroll-dark flex-1">
                {tareasFiltradas.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Sin tareas</p>
                ) : tareasFiltradas.map(tarea => (
                  <div key={tarea.id}
                    onClick={() => { setModalBloque(null); handleClickTarea(tarea) }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center
                      gap-3 cursor-pointer hover:bg-gray-700 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {tarea.tipo === 'cierre'
                          ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                          : tarea.tipo === 'recurrente_mes'
                          ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
                          : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                        <p className="text-white text-sm font-medium truncate">{tarea.nombre_tarea}</p>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{tarea.responsable_nombre} · {tarea.area}</p>
                    </div>
                    {(tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso') && (
                      <PctBadge pct={tarea.porcentaje_cumplimiento ?? 100} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {tareaDetalle && <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />}
      {tareaActiva && (
        <TaskModal tarea={tareaActiva} onClose={() => setTareaActiva(null)}
          onCompletada={() => { queryClient.invalidateQueries({ queryKey: ['tareas'] }); setTareaActiva(null) }}
        />
      )}
    </div>
  )
}

// ─── GRUPO COLAPSABLE USUARIO ─────────────────────────────────────────────────
function GrupoTareasUsuario({ titulo, icono, iconoColor, tareas, onClickTarea, defaultAbierto = true }) {
  const [abierto, setAbierto] = useState(defaultAbierto)
  if (tareas.length === 0) return null

  const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const atrasadas   = tareas.filter(t => t.estado === 'con_atraso' || t.alerta === 'fuera_de_plazo').length

  return (
    <div>
      <button onClick={() => setAbierto(v => !v)} className="w-full flex items-center gap-2 py-2 group">
        <span className={iconoColor}>{icono}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide group-hover:text-white transition">
          {titulo}
        </span>
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{tareas.length}</span>
        {!abierto && (
          <div className="flex items-center gap-2 ml-2">
            {completadas > 0 && <span className="text-xs text-green-500">✓ {completadas}</span>}
            {atrasadas > 0   && <span className="text-xs text-red-400">⚠ {atrasadas}</span>}
            {tareas.length - completadas - atrasadas > 0 && (
              <span className="text-xs text-amber-500">⏳ {tareas.length - completadas - atrasadas}</span>
            )}
          </div>
        )}
        <span className="ml-auto text-gray-600">
          {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      {abierto && (
        <div className="space-y-2 mt-1">
          {tareas.map(tarea => (
            <TareaRow key={tarea.id} tarea={tarea} onClick={() => onClickTarea(tarea)} esCicloCerrado={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── DASHBOARD USUARIO ────────────────────────────────────────────────────────
function DashboardUsuario({ tareas, profile, tituloCiclo, isLoading, onClickTarea }) {
  const [tareaDetalle, setTareaDetalle] = useState(null)

  const misTareas            = tareas.filter(t => t.responsable_nombre === profile?.nombre)
  const misCompletadas       = misTareas.filter(t => t.estado === 'completada').length
  const misCompletadasAtraso = misTareas.filter(t => t.estado === 'completada_con_atraso').length
  const misPendientes        = misTareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const misAtrasadas         = misTareas.filter(t => t.estado === 'con_atraso').length
  const miPct                = misTareas.length
    ? Math.round(((misCompletadas + misCompletadasAtraso) / misTareas.length) * 100) : 0
  const miPctCalidad = (() => {
    const conPct = misTareas.filter(t => t.porcentaje_cumplimiento !== null)
    if (!conPct.length) return null
    return Math.round(conPct.reduce((s, t) => s + t.porcentaje_cumplimiento, 0) / conPct.length)
  })()

  const misPendientesActivas  = misTareas.filter(t =>
    t.estado !== 'completada' && t.estado !== 'completada_con_atraso' && t.estado !== 'no_completada'
  )
  const pendientesCierre      = misPendientesActivas.filter(t => t.tipo === 'cierre')
  const pendientesRecurrentes = misPendientesActivas.filter(t => t.tipo === 'recurrente_mes')
  const pendientesPuntuales   = misPendientesActivas.filter(t => t.tipo === 'puntual' || (!t.tipo && !t.template_id))

  const totalEquipo       = tareas.length
  const completadasEquipo = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const pctEquipo         = totalEquipo ? Math.round((completadasEquipo / totalEquipo) * 100) : 0

  const tareasConDato = misTareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso' ||
    t.estado === 'no_completada' || t.estado === 'con_atraso'
  )
  const miPromedioCalidad = tareasConDato.length
    ? Math.round(tareasConDato.reduce((s, t) => {
        if (t.estado === 'completada' || t.estado === 'completada_con_atraso') return s + (t.porcentaje_cumplimiento ?? 100)
        return s
      }, 0) / tareasConDato.length)
    : null

  const colorPct   = miPct === 100 ? 'text-green-400' : miPct > 50 ? 'text-amber-400' : 'text-red-400'
  const colorBarra = miPct === 100 ? 'bg-green-500'   : miPct > 50 ? 'bg-amber-500'   : 'bg-red-500'

  return (
    <div className="space-y-5">

      {/* ── RESUMEN COMPACTO ──────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-white font-semibold">Mi avance</h2>
            <p className="text-gray-500 text-sm">{tituloCiclo}</p>
          </div>
          <span className={`text-3xl font-bold ${colorPct}`}>{miPct}%</span>
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-700 ${colorBarra}`}
              style={{ width: `${miPct}%` }} />
          </div>
          {miPctCalidad !== null && (
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-700 bg-yellow-500"
                style={{ width: `${miPctCalidad}%` }} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',       value: misTareas.length,                     color: 'text-gray-300',  bg: 'bg-gray-800' },
            { label: 'Completadas', value: misCompletadas + misCompletadasAtraso, color: 'text-green-300', bg: 'bg-green-900/40' },
            { label: 'Pendientes',  value: misPendientes,                         color: 'text-amber-300', bg: 'bg-amber-900/40' },
            { label: 'Vencidas',    value: misAtrasadas,                          color: 'text-red-300',   bg: 'bg-red-900/40' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-green-500 inline-block rounded" />
              <span className="text-xs text-gray-600">Cumplimiento</span>
            </div>
            {miPctCalidad !== null && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-0.5 bg-yellow-500 inline-block rounded" />
                <span className="text-xs text-gray-600">Calidad: <span className="text-yellow-400">{miPctCalidad}%</span></span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">Equipo: <span className="text-gray-400">{pctEquipo}%</span></p>
        </div>
      </div>

      {/* ── CALENDARIO ────────────────────────────────────────── */}
      <CalendarioTareas
        tareas={misTareas}
        onClickTarea={onClickTarea}
        soloMia={true}
      />

      {/* ── MIS TAREAS PENDIENTES ─────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-green-400" />
          <h2 className="text-white font-semibold text-sm">Mis tareas pendientes</h2>
          {misPendientesActivas.length > 0 && (
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {misPendientesActivas.length}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : misPendientesActivas.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">¡Todo al día!</p>
            <p className="text-gray-500 text-sm">No tienes tareas pendientes este mes</p>
          </div>
        ) : (
          <div className="space-y-3">
            <GrupoTareasUsuario titulo="Cierre" icono={<RefreshCw className="w-3 h-3" />}
              iconoColor="text-blue-400" tareas={pendientesCierre} onClickTarea={onClickTarea} />
            <GrupoTareasUsuario titulo="Recurrentes del mes" icono={<CalendarClock className="w-3 h-3" />}
              iconoColor="text-purple-400" tareas={pendientesRecurrentes} onClickTarea={onClickTarea} />
            <GrupoTareasUsuario titulo="Puntuales" icono={<Sparkles className="w-3 h-3" />}
              iconoColor="text-amber-400" tareas={pendientesPuntuales} onClickTarea={onClickTarea} />
          </div>
        )}
      </div>

      {/* ── MI % DE CALIDAD ───────────────────────────────────── */}
      {miPromedioCalidad !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h2 className="text-white font-semibold text-sm">Mi % de calidad</h2>
            </div>
            <span className={`text-2xl font-bold ${
              miPromedioCalidad === 100 ? 'text-green-400'
              : miPromedioCalidad >= 80  ? 'text-amber-400'
              : miPromedioCalidad >= 50  ? 'text-orange-400'
              : 'text-red-400'
            }`}>{miPromedioCalidad}%</span>
          </div>
          <div className="space-y-2">
            {tareasConDato.map(t => {
              const pct = t.estado === 'completada' || t.estado === 'completada_con_atraso'
                ? (t.porcentaje_cumplimiento ?? 100) : 0
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.tipo === 'cierre' ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                        : t.tipo === 'recurrente_mes' ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
                        : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                      <p className="text-gray-300 text-sm truncate">{t.nombre_tarea}</p>
                    </div>
                    <p className="text-gray-600 text-xs">{t.area}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.dias_atraso > 0 && <span className="text-xs text-gray-500">{t.dias_atraso}d</span>}
                    <PctBadge pct={pct} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AVANCE EQUIPO (compacto) ──────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400 text-sm font-medium">Avance del equipo</span>
          </div>
          <span className={`text-sm font-bold ${pctEquipo === 100 ? 'text-green-400' : pctEquipo > 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {pctEquipo}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all duration-700 ${pctEquipo === 100 ? 'bg-green-500' : pctEquipo > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pctEquipo}%` }} />
        </div>
        <p className="text-xs text-gray-600 mt-1.5">{completadasEquipo} de {totalEquipo} tareas completadas</p>
      </div>

      {tareaDetalle && <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Dashboard({ cicloSeleccionado }) {
  const { profile }  = useAuth()
  const [tareaActiva, setTareaActiva] = useState(null)
  const queryClient  = useQueryClient()

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id, profile?.departamento],
    enabled:  !!cicloSeleccionado?.id && !!profile?.departamento,
    queryFn: async () => {
      let query = supabase
        .from('v_tareas_ciclo_activo').select('*')
        .eq('ciclo_id', cicloSeleccionado.id)
        .order('fecha_termino', { ascending: true })
      if (profile?.rol !== 'gerente')
        query = query.eq('departamento', profile?.departamento)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  const tituloCiclo    = cicloSeleccionado ? nombreCiclo(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const esCicloCerrado = cicloSeleccionado?.estado === 'cerrado'
  const esAdmin        = profile?.rol === 'admin'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 bg-green-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">
              Hola, {profile?.nombre?.split(' ')[0]} 👋
            </h1>
          </div>
          <p className="text-gray-400 text-sm ml-5">
            {esAdmin ? 'Vista de administrador' : 'Vista personal'} · {tituloCiclo}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 shrink-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{formatFechaHoy()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : esAdmin ? (
        <DashboardAdmin
          tareas={tareas} tituloCiclo={tituloCiclo}
          cicloSeleccionado={cicloSeleccionado} isLoading={isLoading}
          profile={profile} esCicloCerrado={esCicloCerrado}
        />
      ) : (
        <DashboardUsuario
          tareas={tareas} profile={profile}
          tituloCiclo={tituloCiclo} isLoading={isLoading}
          onClickTarea={setTareaActiva}
        />
      )}

      {tareaActiva && (
        <TaskModal tarea={tareaActiva} onClose={() => setTareaActiva(null)}
          onCompletada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
            setTareaActiva(null)
          }}
        />
      )}
    </div>
  )
}
