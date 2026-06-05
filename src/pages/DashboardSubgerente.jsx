import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import CalendarioTareas from '../components/CalendarioTareas'
import PanelRendimiento from '../components/PanelRendimiento'
import GoogleCalendarModal from '../components/GoogleCalendarModal'
import {
  Calendar, Users, User, RefreshCw, CalendarClock,
  Sparkles, ChevronRight, X, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, BarChart2
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

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

function CondicionBadge({ condicion, frecuencia }) {
  if (frecuencia === 'semanal' || frecuencia === 'quincenal') return null
  if (condicion === 'habil')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-900/50 text-blue-300">Día hábil</span>
  if (condicion === 'dia_real')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-800 text-gray-500">Día cal.</span>
  return null
}

function TareaRow({ tarea, onClick, esCicloCerrado, impactoDep }) {
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
      <div className="flex items-center gap-1.5 shrink-0">
        <CondicionBadge condicion={tarea.condicion} frecuencia={tarea.frecuencia} />
        {impactoDep && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-900/50 text-amber-300"
            title={`Depende de "${impactoDep.nombre_tarea}" (${impactoDep.departamento}) con ${impactoDep.impacto_atraso} día${impactoDep.impacto_atraso !== 1 ? 's' : ''} de atraso`}
          >
            ⚠️ Dep. con atraso
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{label}</span>
      </div>
    </div>
  )
}

function GrupoTareasUsuario({ titulo, icono, iconoColor, tareas, onClickTarea, defaultAbierto = true, impactosDep = {} }) {
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
            <TareaRow key={tarea.id} tarea={tarea} onClick={() => onClickTarea(tarea)} esCicloCerrado={false}
              impactoDep={impactosDep[tarea.id]} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BARRA GLOBAL ADMIN ───────────────────────────────────────────────────────
function BarraGlobalAdmin({ tareas, departamento, tituloCiclo, activo, onClick }) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const exigibles   = tareas.filter(t => {
    const bloqueada = t.serie_id && t.fecha_inicio && new Date(t.fecha_inicio + 'T00:00:00') > hoy
    const debida    = t.fecha_termino && new Date(t.fecha_termino + 'T00:00:00') <= hoy
    return !bloqueada && debida
  })
  const completadas = exigibles.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const total       = exigibles.length
  const pct         = total ? Math.round((completadas / total) * 100) : 0

  const conCalidad  = exigibles.filter(t => t.porcentaje_cumplimiento !== null)
  const calidad     = conCalidad.length
    ? Math.round(conCalidad.reduce((s, t) => s + t.porcentaje_cumplimiento, 0) / conCalidad.length)
    : null

  const colorPct   = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
  const colorBarra = pct === 100 ? 'bg-green-500'   : pct > 60 ? 'bg-amber-500'   : 'bg-red-500'
  const colorCal   = calidad === null ? '' : calidad >= 90 ? 'text-green-400' : calidad >= 70 ? 'text-amber-400' : 'text-red-400'
  const borderCard = activo
    ? 'border-green-600 ring-2 ring-green-600'
    : pct === 100 ? 'border-green-800' : pct > 60 ? 'border-amber-800' : 'border-red-800'
  const bgCard     = pct === 100 ? 'bg-green-900/10' : pct > 60 ? 'bg-amber-900/10' : 'bg-red-900/10'

  return (
    <div
      onClick={onClick}
      className={`${bgCard} border ${borderCard} rounded-2xl px-5 py-3.5 flex items-center gap-5
        ${onClick ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
    >
      <div className="shrink-0 min-w-0">
        <p className="text-white text-sm font-semibold leading-none">{departamento}</p>
        <p className="text-gray-500 text-xs mt-0.5">{tituloCiclo}</p>
      </div>

      <div className="w-px h-8 bg-gray-800 shrink-0" />

      <div className="shrink-0 text-center">
        <p className={`text-lg font-bold leading-none ${colorPct}`}>{completadas}
          <span className="text-gray-600 font-normal text-sm">/{total}</span>
        </p>
        <p className="text-xs text-gray-600 mt-0.5">tareas</p>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-700 ${colorBarra}`}
              style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-bold w-9 text-right shrink-0 ${colorPct}`}>{pct}%</span>
        </div>
        {calidad !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-700 bg-yellow-500"
                style={{ width: `${calidad}%` }} />
            </div>
            <span className={`text-xs font-bold w-9 text-right shrink-0 ${colorCal}`}>{calidad}%</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className={`w-2 h-1 inline-block rounded ${colorBarra}`} />
            <span className="text-xs text-gray-600">Cumplimiento</span>
          </div>
          {calidad !== null && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-1 inline-block rounded bg-yellow-500" />
              <span className="text-xs text-gray-600">Desempeño</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── GRÁFICO HISTORIAL DEPTO ──────────────────────────────────────────────────
function GraficoDepto({ historial, departamento }) {
  if (!historial.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-gray-500" />
          <h2 className="text-white font-semibold text-sm">Historial — {departamento}</h2>
        </div>
        <p className="text-gray-600 text-sm text-center py-6">Sin historial disponible</p>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
        <p className="text-gray-300 font-semibold mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}%</p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-green-400" />
        <h2 className="text-white font-semibold text-sm">Historial — {departamento}</h2>
        <span className="text-xs text-gray-600">últimos 6 ciclos</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={historial} barCategoryGap="30%" barGap={4}>
          <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }}
            formatter={v => <span style={{ color: '#9ca3af' }}>{v}</span>}
          />
          <Bar dataKey="cumplimiento" name="Cumplimiento" fill="#22c55e" radius={[3,3,0,0]} />
          <Bar dataKey="desempeno"    name="Desempeño"    fill="#eab308" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── FILA COMPACTA DE MÉTRICAS ────────────────────────────────────────────────
function FilaMetricas({ tareasCierre, tareasRecurrentes, tareasPuntuales,
  tituloCierre, tituloCiclo, esCicloCerrado, onClickBloque }) {

  const calcStats = (tareas) => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const exigibles = tareas.filter(t => {
      const bloqueada = t.serie_id && t.fecha_inicio && new Date(t.fecha_inicio + 'T00:00:00') > hoy
      const debida    = t.fecha_termino && new Date(t.fecha_termino + 'T00:00:00') <= hoy
      return !bloqueada && debida
    })
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
              {s.calidad !== null && <span className="text-yellow-600">{s.calidad}% des.</span>}
              {s.atrasadas > 0 && <span className="text-red-500">{s.atrasadas} ⚠</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DASHBOARD ADMIN (del depto activo) ───────────────────────────────────────
function DashboardAdmin({ tareas, tituloCiclo, cicloSeleccionado, isLoading, profile, esCicloCerrado, impactosDep = {} }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [modalBloque,        setModalBloque]        = useState(null)
  const [filtroModalUsuario, setFiltroModalUsuario] = useState('todos')
  const [tareaDetalle,       setTareaDetalle]       = useState(null)
  const [tareaActiva,        setTareaActiva]        = useState(null)

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
    const exigibles = tareasBloq.filter(t => {
      const bloqueada = t.serie_id && t.fecha_inicio && new Date(t.fecha_inicio + 'T00:00:00') > hoy
      const debida    = t.fecha_termino && new Date(t.fecha_termino + 'T00:00:00') <= hoy
      return !bloqueada && debida
    })
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
            <h2 className="text-white font-semibold text-sm">Equipo del departamento</h2>
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
                esCicloCerrado={esCicloCerrado}
                impactoDep={impactosDep[tarea.id]} />
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL BLOQUE ──────────────────────────────────────── */}
      {modalBloque && (() => {
        const tareasFiltradas = filtroModalUsuario === 'todos'
          ? modalBloque.tareas
          : modalBloque.tareas.filter(t => t.responsable_nombre === filtroModalUsuario)

        const stats = calcModalStats(tareasFiltradas)
        const integrantes = [...new Set(modalBloque.tareas.map(t => t.responsable_nombre).filter(Boolean))].sort()

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold">{modalBloque.titulo}</h3>
                <button onClick={() => setModalBloque(null)} className="text-gray-500 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {integrantes.length > 1 && (
                <div className="px-4 pt-3 pb-3 border-b border-gray-800">
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

              <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b border-gray-800">
                {[
                  { label: 'Total',         value: stats.total,        color: 'text-gray-300',   bg: 'bg-gray-800' },
                  { label: 'Terminadas',    value: stats.completadas,  color: 'text-green-300',  bg: 'bg-green-900/40' },
                  { label: 'Entregadas',    value: stats.atraso,       color: 'text-yellow-300', bg: 'bg-yellow-900/40' },
                  { label: 'Sin completar', value: stats.sinCompletar, color: 'text-red-300',    bg: 'bg-red-900/40' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

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
          onCompletada={() => { queryClient.invalidateQueries({ queryKey: ['tareas-subgerente'] }); setTareaActiva(null) }}
        />
      )}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function DashboardSubgerente({ cicloSeleccionado: _cicloSeleccionado, deptoActivo: deptoActivoProp, onCambiarDepto }) {
  const { profile, deptosAsignados } = useAuth()
  // Usar el depto de props si viene (sincronizado con el navbar), sino el estado local como fallback
  const [deptoLocal, setDeptoLocal] = useState(() => deptosAsignados[0] ?? null)
  const deptoActivo    = deptoActivoProp ?? deptoLocal
  const setDeptoActivo = onCambiarDepto ?? setDeptoLocal
  const queryClient = useQueryClient()
  const [tareaActiva, setTareaActiva] = useState(null)
  const [toastDeshacer, setToastDeshacer] = useState(null)
  const [entradaParaAgendar, setEntradaParaAgendar] = useState(null)

  // 1. Ciclos activos por depto
  const { data: ciclosPorDepto = {}, isLoading: loadingCiclos } = useQuery({
    queryKey: ['ciclos-subgerente', deptosAsignados],
    enabled: deptosAsignados.length > 0,
    queryFn: async () => {
      const result = {}
      for (const depto of deptosAsignados) {
        const { data } = await supabase
          .from('monthly_cycles')
          .select('*')
          .eq('departamento', depto)
          .eq('estado', 'activo')
          .maybeSingle()
        result[depto] = data ?? null
      }
      return result
    }
  })

  // 2. Tareas del depto activo
  const cicloActivo = deptoActivo ? (ciclosPorDepto[deptoActivo] ?? null) : null
  const { data: tareasActivo = [], isLoading: loadingTareas } = useQuery({
    queryKey: ['tareas-subgerente', cicloActivo?.id, deptoActivo],
    enabled: !!cicloActivo?.id && !!deptoActivo,
    queryFn: async () => {
      const { data } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloActivo.id)
        .eq('departamento', deptoActivo)
        .order('fecha_termino', { ascending: true })
      return data ?? []
    }
  })

  // 3. Tareas resumen para las barras (todos los deptos)
  const cicloIdsKey = deptosAsignados.map(d => ciclosPorDepto[d]?.id ?? '').join(',')
  const { data: tareasPorDepto = {} } = useQuery({
    queryKey: ['tareas-resumen-subgerente', cicloIdsKey],
    enabled: !loadingCiclos && Object.keys(ciclosPorDepto).length > 0,
    queryFn: async () => {
      const result = {}
      for (const depto of deptosAsignados) {
        const ciclo = ciclosPorDepto[depto]
        if (!ciclo) { result[depto] = []; continue }
        const { data } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado, porcentaje_cumplimiento, fecha_termino, serie_id, fecha_inicio')
          .eq('ciclo_id', ciclo.id)
          .eq('departamento', depto)
        result[depto] = data ?? []
      }
      return result
    }
  })

  // 4. Historial últimos 6 ciclos del depto activo
  const { data: historialDepto = [] } = useQuery({
    queryKey: ['historial-subgerente', deptoActivo],
    enabled: !!deptoActivo,
    queryFn: async () => {
      const { data: ciclosHist } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .eq('departamento', deptoActivo)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
        .limit(6)
      if (!ciclosHist?.length) return []
      const results = []
      for (const c of ciclosHist) {
        const { data: tareasHist } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado, porcentaje_cumplimiento')
          .eq('ciclo_id', c.id)
          .eq('departamento', deptoActivo)
        if (!tareasHist?.length) continue
        const comp = tareasHist.filter(t =>
          t.estado === 'completada' || t.estado === 'completada_con_atraso').length
        const conPct = tareasHist.filter(t => t.porcentaje_cumplimiento !== null)
        results.push({
          mes: `${MESES[c.mes - 1].slice(0,3)}`,
          cumplimiento: Math.round((comp / tareasHist.length) * 100),
          desempeno: conPct.length
            ? Math.round(conPct.reduce((s,t) => s + t.porcentaje_cumplimiento, 0) / conPct.length)
            : Math.round((comp / tareasHist.length) * 100)
        })
      }
      return results.reverse()
    }
  })

  // 5. Impactos dependencias
  const taskIds = useMemo(() => tareasActivo.map(t => t.id), [tareasActivo])
  const { data: impactosDep = {} } = useQuery({
    queryKey: ['impactos-subgerente', deptoActivo, cicloActivo?.id],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('task_dependencies')
        .select('task_id, impacto_atraso, depends_on:depends_on_id(nombre_tarea, departamento)')
        .in('task_id', taskIds)
        .gt('impacto_atraso', 0)
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

  // 6. Tareas sin agendar en Google Calendar (todos los deptos del subgerente)
  const { data: tareasSinAgendar = [], refetch: refetchSinAgendar } = useQuery({
    queryKey: ['tareas-sin-agendar', deptosAsignados, cicloActivo?.mes, cicloActivo?.anio],
    enabled: deptosAsignados.length > 0 && !!cicloActivo,
    queryFn: async () => {
      // Ciclos activos de los deptos del subgerente
      const { data: ciclos } = await supabase
        .from('monthly_cycles')
        .select('id')
        .in('departamento', deptosAsignados)
        .eq('estado', 'activo')
      const cicloIds = (ciclos ?? []).map(c => c.id)
      if (cicloIds.length === 0) return []
      const { data } = await supabase
        .from('tasks')
        .select('id, nombre_tarea, fecha_termino, duracion_estimada_min, observaciones, area, departamento, tipo, frecuencia, serie_id, mes_calendario, anio_calendario')
        .in('ciclo_id', cicloIds)
        .eq('agendada_en_calendar', false)
        .order('fecha_termino', { ascending: true })
      return data ?? []
    }
  })

  const entradasAgendar = useMemo(() => {
    const series = new Map()
    const puntuales = []
    for (const t of tareasSinAgendar) {
      if (t.serie_id) {
        if (!series.has(t.serie_id)) {
          series.set(t.serie_id, { tipo: 'serie', serie_id: t.serie_id, tarea: t, count: 1, ids: [t.id] })
        } else {
          const s = series.get(t.serie_id)
          s.count++
          s.ids.push(t.id)
        }
      } else {
        puntuales.push({ tipo: 'puntual', tarea: t, ids: [t.id] })
      }
    }
    return [...series.values(), ...puntuales]
  }, [tareasSinAgendar])

  function mostrarToastDeshacer(nombre, ids) {
    setToastDeshacer({ nombre, ids })
    setTimeout(() => {
      setToastDeshacer(prev => (prev && prev.ids === ids ? null : prev))
    }, 6000)
  }

  async function handleDesmarcar(ids) {
    await supabase.from('tasks').update({ agendada_en_calendar: false }).in('id', ids)
    setToastDeshacer(null)
    refetchSinAgendar()
  }

  const tituloCicloActivo = cicloActivo
    ? nombreCiclo(cicloActivo.mes, cicloActivo.anio) : '—'
  const esCicloCerrado = cicloActivo?.estado === 'cerrado'
  const profileConDepto = useMemo(
    () => deptoActivo ? { ...profile, departamento: deptoActivo } : profile,
    [profile, deptoActivo]
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 bg-green-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">
              Hola, {profile?.nombre?.split(' ')[0]} 👋
            </h1>
          </div>
          <p className="text-gray-400 text-sm ml-5">
            Vista Subgerencial · {tituloCicloActivo}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800
                        rounded-xl px-4 py-2 shrink-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{formatFechaHoy()}</span>
        </div>
      </div>

      {/* BANNER DE AGENDADO EN LOTE */}
      {entradasAgendar.length > 0 && (
        <div className="mb-6 bg-blue-950/30 border border-blue-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-semibold text-sm">
              Tienes {entradasAgendar.length} {entradasAgendar.length === 1 ? 'elemento' : 'elementos'} sin agendar en tu calendario
            </h3>
          </div>
          <div className="space-y-2">
            {entradasAgendar.map((entrada) => (
              <div key={entrada.serie_id ?? entrada.tarea.id}
                className="flex items-center justify-between gap-3 bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{entrada.tarea.nombre_tarea}</p>
                  <p className="text-gray-500 text-xs">
                    {entrada.tipo === 'serie'
                      ? `Serie semanal · ${entrada.count} fechas · ${entrada.tarea.departamento}`
                      : `${entrada.tarea.fecha_termino} · ${entrada.tarea.departamento}`}
                  </p>
                </div>
                <button
                  onClick={() => setEntradaParaAgendar(entrada)}
                  className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Agendar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANEL RESUMEN MULTI-DEPTO */}
      <div className="mb-6 space-y-3">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          Resumen de departamentos
        </p>
        {loadingCiclos ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500
                            border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deptosAsignados.map(depto => {
          const ciclo  = ciclosPorDepto[depto]
          const tareas = tareasPorDepto[depto] ?? []
          if (!ciclo) return (
            <div key={depto}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl
                         px-5 py-3.5 flex items-center gap-5">
              <div className="shrink-0">
                <p className="text-white text-sm font-semibold">{depto}</p>
                <p className="text-gray-600 text-xs mt-0.5">Sin ciclo activo</p>
              </div>
              <div className="w-px h-8 bg-gray-800 shrink-0" />
              <div className="flex-1 bg-gray-800 rounded-full h-2" />
            </div>
          )
          return (
            <BarraGlobalAdmin
              key={depto}
              tareas={tareas}
              departamento={depto}
              tituloCiclo={nombreCiclo(ciclo.mes, ciclo.anio)}
              activo={deptoActivo === depto}
              onClick={() => setDeptoActivo(depto)}
            />
          )
        })}
      </div>

      {/* SELECTOR DE DEPTO */}
      {deptosAsignados.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
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

      {deptoActivo && (
        loadingTareas ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500
                            border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">

            {/* GRÁFICO HISTORIAL */}
            <GraficoDepto
              historial={historialDepto}
              departamento={deptoActivo}
            />

            {/* BARRA GLOBAL DEL DEPTO ACTIVO */}
            <BarraGlobalAdmin
              tareas={tareasActivo}
              departamento={deptoActivo}
              tituloCiclo={tituloCicloActivo}
              activo={true}
            />

            {/* CALENDARIO */}
            <CalendarioTareas
              tareas={tareasActivo}
              onClickTarea={setTareaActiva}
              soloMia={false}
            />

            {/* DASHBOARD ADMIN DEL DEPTO */}
            <DashboardAdmin
              tareas={tareasActivo}
              tituloCiclo={tituloCicloActivo}
              cicloSeleccionado={cicloActivo}
              isLoading={loadingTareas}
              profile={profileConDepto}
              esCicloCerrado={esCicloCerrado}
              impactosDep={impactosDep}
            />

          </div>
        )
      )}

      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas-subgerente'] })
            setTareaActiva(null)
          }}
        />
      )}

      {/* MODAL DE HORA PARA AGENDAR EN LOTE */}
      {entradaParaAgendar && (
        <GoogleCalendarModal
          tarea={entradaParaAgendar.tarea}
          onClose={() => setEntradaParaAgendar(null)}
          onAgendado={async () => {
            await supabase
              .from('tasks')
              .update({ agendada_en_calendar: true })
              .in('id', entradaParaAgendar.ids)
            refetchSinAgendar()
            mostrarToastDeshacer(entradaParaAgendar.tarea.nombre_tarea, entradaParaAgendar.ids)
            setEntradaParaAgendar(null)
          }}
        />
      )}

      {/* TOAST DESHACER AGENDADO */}
      {toastDeshacer && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 border border-gray-700
                        rounded-xl shadow-xl p-4 flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Agendada ✓</p>
            <p className="text-gray-500 text-xs truncate">{toastDeshacer.nombre}</p>
          </div>
          <button
            onClick={() => handleDesmarcar(toastDeshacer.ids)}
            className="text-blue-400 hover:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-lg
                       bg-blue-950/40 transition shrink-0"
          >
            Deshacer
          </button>
          <button
            onClick={() => setToastDeshacer(null)}
            className="text-gray-500 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
