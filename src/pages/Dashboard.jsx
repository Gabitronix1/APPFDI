import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Layers3,
  ListChecks,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function nombreCierre(mes, anio) {
  if (!mes || !anio) return 'Ciclo activo'
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

function slugify(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatoFechaES(date = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatoFechaCorta(date) {
  if (!date) return 'sin fecha'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return 'sin fecha'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(d)
}

function diasHasta(fecha) {
  if (!fecha) return null
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function getFinMes(cicloSeleccionado) {
  if (!cicloSeleccionado?.anio || !cicloSeleccionado?.mes) return null
  return new Date(cicloSeleccionado.anio, cicloSeleccionado.mes, 0, 23, 59, 59)
}

function getDiasRestantes(cicloSeleccionado) {
  const finMes = getFinMes(cicloSeleccionado)
  if (!finMes) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  finMes.setHours(0, 0, 0, 0)
  return Math.ceil((finMes.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function esCompletada(t) {
  return t.estado === 'completada' || t.estado === 'completada_con_atraso'
}

function esPendiente(t) {
  return t.estado === 'pendiente' || t.estado === 'en_progreso'
}

function getTipoTarea(t) {
  const raw = String(t?.tipo_tarea ?? t?.tipo ?? t?.categoria ?? t?.clase ?? t?.origen ?? '').toLowerCase()
  if (raw.includes('ciclo')) return 'ciclo'
  return 'recurrente'
}

function getTipoLabel(t) {
  return getTipoTarea(t) === 'ciclo' ? 'Ciclo' : 'Recurrente'
}

function getEstadoLabel(t) {
  if (t.alerta === 'fuera_de_plazo' && !esCompletada(t)) return 'Fuera de plazo'
  return String(t.estado ?? 'pendiente').replace(/_/g, ' ')
}

function getEstadoChipClass(t) {
  if (t.alerta === 'fuera_de_plazo' && !esCompletada(t)) return 'bg-orange-900/60 text-orange-300 border-orange-800'
  switch (t.estado) {
    case 'completada':
      return 'bg-green-900/60 text-green-300 border-green-800'
    case 'completada_con_atraso':
      return 'bg-yellow-900/60 text-yellow-300 border-yellow-800'
    case 'con_atraso':
      return 'bg-red-900/60 text-red-300 border-red-800'
    case 'en_progreso':
      return 'bg-blue-900/60 text-blue-300 border-blue-800'
    case 'pendiente':
      return 'bg-gray-800 text-gray-300 border-gray-700'
    case 'no_completada':
      return 'bg-gray-900 text-gray-500 border-gray-800'
    default:
      return 'bg-gray-800 text-gray-300 border-gray-700'
  }
}

function getTypeChipClass(tipo) {
  if (tipo === 'ciclo') return 'bg-indigo-900/50 text-indigo-300 border-indigo-800'
  return 'bg-blue-900/50 text-blue-300 border-blue-800'
}

function pctColorClass(pct) {
  if (pct === null || pct === undefined) return 'text-gray-500'
  if (pct === 100) return 'text-green-400'
  if (pct >= 85) return 'text-emerald-400'
  if (pct >= 65) return 'text-amber-400'
  if (pct >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function pctBarClass(pct) {
  if (pct === null || pct === undefined) return 'bg-gray-700'
  if (pct === 100) return 'bg-green-500'
  if (pct >= 85) return 'bg-emerald-500'
  if (pct >= 65) return 'bg-amber-500'
  if (pct >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function Panel({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_40%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_35%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${className}`}>
      {children}
    </span>
  )
}

function ProgressBar({ value = 0, height = 'h-3' }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`w-full rounded-full bg-white/5 ${height}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${pctBarClass(pct)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function SectionTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{eyebrow}</p>}
        <h2 className="mt-1 text-lg md:text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-white/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'bg-white/5' }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 ${tone}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {helper && <p className="mt-1 text-sm text-white/50">{helper}</p>}
        </div>
      </div>
    </Panel>
  )
}

function TaskTypePill({ tarea }) {
  const tipo = getTipoTarea(tarea)
  return <Badge className={getTypeChipClass(tipo)}>{getTipoLabel(tarea)}</Badge>
}

function TaskRow({ tarea, onClick }) {
  const tipo = getTipoTarea(tarea)
  const esFueraDePlazo = tarea.alerta === 'fuera_de_plazo' && !esCompletada(tarea)
  const pct = esCompletada(tarea)
    ? (tarea.porcentaje_cumplimiento ?? 100)
    : tarea.estado === 'no_completada' || tarea.estado === 'con_atraso'
      ? 0
      : null

  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <div className="rounded-2xl border border-white/5 bg-black/20 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.05]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {tipo === 'ciclo'
                ? <Layers3 className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
                : <Sparkles className="h-3.5 w-3.5 text-blue-300 shrink-0" />
              }
              <p className="truncate text-sm font-medium text-white">{tarea.nombre_tarea}</p>
            </div>
            <p className="mt-1 text-xs text-white/45">
              {tarea.area || 'Sin área'} · vence {formatoFechaCorta(tarea.fecha_termino)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <TaskTypePill tarea={tarea} />
              <Badge className={getEstadoChipClass(tarea)}>
                {esFueraDePlazo ? 'Fuera de plazo' : getEstadoLabel(tarea)}
              </Badge>
            </div>
            {pct !== null && (
              <span className={`text-sm font-bold ${pctColorClass(pct)}`}>{pct}%</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function RiskBadge({ late, pending, daysRemaining }) {
  const overdueWeight = late * 2 + pending
  const urgent = daysRemaining !== null && daysRemaining <= 5
  let label = 'En control'
  let className = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  let icon = <CheckCircle2 className="h-3.5 w-3.5" />

  if (overdueWeight >= 5 || (urgent && overdueWeight >= 3)) {
    label = 'Comprometido'
    className = 'bg-red-500/10 text-red-300 border-red-500/20'
    icon = <AlertTriangle className="h-3.5 w-3.5" />
  } else if (overdueWeight >= 2 || urgent) {
    label = 'En riesgo'
    className = 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    icon = <Clock3 className="h-3.5 w-3.5" />
  }

  return <Badge className={className}>{icon}{label}</Badge>
}

function MemberRow({ nombre, stats, onClick }) {
  const pct = stats.total ? Math.round(((stats.completadas + stats.completadasAtraso) / stats.total) * 100) : 0
  const restantes = Math.max(0, stats.total - stats.completadas - stats.completadasAtraso)
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <div className="rounded-2xl border border-white/5 bg-black/20 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.05]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 ring-1 ring-white/5">
              <span className="text-sm font-bold text-emerald-200">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-white">{nombre}</p>
                <RiskBadge late={stats.atrasadas} pending={stats.pendientes} daysRemaining={null} />
              </div>
              <p className="mt-1 text-xs text-white/45">
                {stats.total} tareas · {restantes} sin completar · {stats.atrasadas} con atraso
              </p>
              <div className="mt-3">
                <ProgressBar value={pct} height="h-2.5" />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className={`text-2xl font-bold ${pctColorClass(pct)}`}>{pct}%</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">avance</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            {stats.completadas + stats.completadasAtraso} completadas
          </Badge>
          {stats.atrasadas > 0 && (
            <Badge className="border-red-500/20 bg-red-500/10 text-red-300">
              {stats.atrasadas} con atraso
            </Badge>
          )}
          {stats.pendientes > 0 && (
            <Badge className="border-white/10 bg-white/5 text-white/55">
              {stats.pendientes} sin completar
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

function StateBreakdown({ completadas, completadasAtraso, atrasadas, pendientes, total }) {
  const cards = [
    { label: 'Total', value: total, tone: 'text-white' },
    { label: 'A tiempo', value: completadas, tone: 'text-emerald-300' },
    { label: 'Con atraso', value: completadasAtraso + atrasadas, tone: 'text-amber-300' },
    { label: 'Sin completar', value: pendientes, tone: 'text-red-300' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-2xl border border-white/5 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}

function TimelineHint({ historial }) {
  if (!historial?.length) return null
  const first = historial[0]?.pct ?? 0
  const last = historial[historial.length - 1]?.pct ?? 0
  const delta = last - first
  const sign = delta > 0 ? '+' : ''
  const label =
    delta === 0 ? 'estable'
      : delta > 0 ? `${sign}${delta}% vs. inicio del periodo`
      : `${delta}% vs. inicio del periodo`

  return (
    <Badge className="border-white/10 bg-white/5 text-white/65">
      {last >= first ? <TrendingUp className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5 rotate-180" />}
      {label}
    </Badge>
  )
}

function useTareas(cicloSeleccionado, profile) {
  return useQuery({
    queryKey: ['tareas', cicloSeleccionado?.id, profile?.departamento],
    enabled: !!cicloSeleccionado?.id && !!profile?.departamento,
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
    },
  })
}

function useHistorial12m(profile) {
  return useQuery({
    queryKey: ['historial-anual', profile?.departamento],
    enabled: !!profile?.departamento,
    queryFn: async () => {
      const { data: ciclosHist, error } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .order('anio', { ascending: true })
        .order('mes', { ascending: true })

      if (error) throw error
      if (!ciclosHist?.length) return []

      const ultimosDoce = ciclosHist.slice(-12)
      const results = []

      for (const ciclo of ultimosDoce) {
        const { data: tareasHist, error: errHist } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado')
          .eq('ciclo_id', ciclo.id)
          .eq('departamento', profile?.departamento)

        if (errHist || !tareasHist?.length) continue

        const completadasHist = tareasHist.filter(esCompletada).length
        results.push({
          mes: `${MESES[ciclo.mes - 1]?.slice(0, 3) ?? ''} ${String(ciclo.anio).slice(-2)}`,
          pct: Math.round((completadasHist / tareasHist.length) * 100),
          completadas: completadasHist,
          total: tareasHist.length,
        })
      }

      return results
    },
  })
}

function DashboardAdmin({ tareas, cicloSeleccionado, profile }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tareaActiva, setTareaActiva] = useState(null)
  const [tareaDetalle, setTareaDetalle] = useState(null)
  const { data: historial = [] } = useHistorial12m(profile)

  const tituloCiclo = useMemo(
    () => nombreCierre(cicloSeleccionado?.mes, cicloSeleccionado?.anio),
    [cicloSeleccionado]
  )

  const fechaHoy = formatoFechaES(new Date())
  const diasRestantes = getDiasRestantes(cicloSeleccionado)

  const completadas = tareas.filter(t => t.estado === 'completada').length
  const completadasAtraso = tareas.filter(t => t.estado === 'completada_con_atraso').length
  const atrasadas = tareas.filter(t => t.estado === 'con_atraso').length
  const pendientes = tareas.filter(t => esPendiente(t) || t.estado === 'no_completada').length
  const sinCompletar = atrasadas + pendientes
  const pctCierre = tareas.length ? Math.round(((completadas + completadasAtraso) / tareas.length) * 100) : 0

  const tasksOrdenadas = useMemo(() => {
    return [...tareas].sort((a, b) => {
      const aUrg = a.estado === 'con_atraso' ? 0 : a.estado === 'no_completada' ? 1 : 2
      const bUrg = b.estado === 'con_atraso' ? 0 : b.estado === 'no_completada' ? 1 : 2
      if (aUrg !== bUrg) return aUrg - bUrg
      const da = diasHasta(a.fecha_termino)
      const db = diasHasta(b.fecha_termino)
      if (da !== null && db !== null && da !== db) return da - db
      return String(a.nombre_tarea ?? '').localeCompare(String(b.nombre_tarea ?? ''))
    })
  }, [tareas])

  const tareasCriticas = tasksOrdenadas.filter(t => !esCompletada(t)).slice(0, 5)
  const recurrentes = tasksOrdenadas.filter(t => getTipoTarea(t) === 'recurrente')
  const ciclo = tasksOrdenadas.filter(t => getTipoTarea(t) === 'ciclo')

  const teamStats = useMemo(() => {
    const map = tareas.reduce((acc, tarea) => {
      const nombre = tarea.responsable_nombre ?? 'Sin asignar'
      if (!acc[nombre]) {
        acc[nombre] = {
          total: 0,
          completadas: 0,
          completadasAtraso: 0,
          atrasadas: 0,
          pendientes: 0,
        }
      }

      acc[nombre].total += 1
      if (tarea.estado === 'completada') acc[nombre].completadas += 1
      if (tarea.estado === 'completada_con_atraso') acc[nombre].completadasAtraso += 1
      if (tarea.estado === 'con_atraso') acc[nombre].atrasadas += 1
      if (esPendiente(tarea) || tarea.estado === 'no_completada') acc[nombre].pendientes += 1
      return acc
    }, {})

    return Object.entries(map)
      .map(([nombre, stats]) => {
        const pct = stats.total
          ? Math.round(((stats.completadas + stats.completadasAtraso) / stats.total) * 100)
          : 0
        return { nombre, ...stats, pct }
      })
      .sort((a, b) => a.pct - b.pct || b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre))
  }, [tareas])

  function abrirIntegrante(nombre) {
    navigate(`/integrantes/${slugify(nombre)}`, {
      state: {
        nombre,
        departamento: profile?.departamento,
        cicloId: cicloSeleccionado?.id,
        mes: cicloSeleccionado?.mes,
        anio: cicloSeleccionado?.anio,
      },
    })
  }

  return (
    <div className="relative space-y-6 py-6 md:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <Panel className="p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_.9fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Flame className="h-3.5 w-3.5" />
                Cierre activo
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-white/65">
                <CalendarDays className="h-3.5 w-3.5" />
                Hoy: {fechaHoy}
              </Badge>
              {diasRestantes !== null && (
                <Badge className={diasRestantes >= 0
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/20 bg-red-500/10 text-red-300'}>
                  {diasRestantes >= 0 ? `${diasRestantes} días restantes` : `${Math.abs(diasRestantes)} días de atraso`}
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                Hola, {profile?.nombre?.split(' ')[0] ?? 'Gabriel'} 👋
              </h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                {tituloCiclo} · una lectura ejecutiva para ver avance, riesgo y foco operativo en un solo lugar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/10 bg-white/5 text-white/70">Total: {tareas.length}</Badge>
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Completadas: {completadas + completadasAtraso}</Badge>
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">Con atraso: {completadasAtraso + atrasadas}</Badge>
              <Badge className="border-red-500/20 bg-red-500/10 text-red-300">Sin completar: {sinCompletar}</Badge>
              <RiskBadge late={completadasAtraso + atrasadas} pending={pendientes} daysRemaining={diasRestantes} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Estado del cierre</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{pctCierre}%</h3>
              </div>
              <div className={`text-5xl font-bold ${pctColorClass(pctCierre)}`}>{pctCierre}%</div>
            </div>

            <div className="mt-4">
              <ProgressBar value={pctCierre} height="h-4" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-white/40 uppercase tracking-[0.18em] text-[11px]">A tiempo</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">{completadas}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-white/40 uppercase tracking-[0.18em] text-[11px]">Con atraso</p>
                <p className="mt-1 text-xl font-bold text-amber-300">{completadasAtraso + atrasadas}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-white/40 uppercase tracking-[0.18em] text-[11px]">Pendientes</p>
                <p className="mt-1 text-xl font-bold text-white">{pendientes}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-white/40 uppercase tracking-[0.18em] text-[11px]">Total</p>
                <p className="mt-1 text-xl font-bold text-white">{tareas.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ListChecks} label="Tareas del ciclo" value={tareas.length} helper="base operativa del periodo" tone="bg-blue-500/10" />
        <MetricCard icon={CheckCircle2} label="Completadas" value={completadas + completadasAtraso} helper={`${tareas.length ? Math.round(((completadas + completadasAtraso) / tareas.length) * 100) : 0}% del total`} tone="bg-emerald-500/10" />
        <MetricCard icon={Clock3} label="Con atraso" value={completadasAtraso + atrasadas} helper="requieren seguimiento" tone="bg-amber-500/10" />
        <MetricCard icon={AlertTriangle} label="Sin completar" value={sinCompletar} helper="pendientes y atrasadas" tone="bg-red-500/10" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Panel className="p-6">
          <SectionTitle
            eyebrow="Atención hoy"
            title="Tareas críticas"
            subtitle="Las tareas más urgentes aparecen arriba para decidir rápido."
            action={<Badge className="border-white/10 bg-white/5 text-white/60">{tareasCriticas.length} visibles</Badge>}
          />
          <div className="mt-5 space-y-3">
            {tareasCriticas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
                <p className="font-medium text-white">Todo está al día</p>
                <p className="mt-1 text-sm text-white/50">No hay tareas críticas en este momento.</p>
              </div>
            ) : (
              tareasCriticas.map(tarea => (
                <TaskRow
                  key={tarea.id}
                  tarea={tarea}
                  onClick={() => {
                    if (esCompletada(tarea) || tarea.estado === 'no_completada') {
                      setTareaDetalle(tarea)
                    } else {
                      setTareaActiva(tarea)
                    }
                  }}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle
            eyebrow="Tareas del mes"
            title="Recurrentes y ciclo"
            subtitle="La distinción de cierre desaparece y todo lo operativo queda ordenado en dos grupos."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-300" />
                  <p className="font-medium text-white">Recurrentes</p>
                </div>
                <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">{recurrentes.length}</Badge>
              </div>
              <p className="mt-3 text-sm text-white/50">
                {recurrentes.filter(esCompletada).length} completadas · {recurrentes.filter(t => !esCompletada(t)).length} pendientes
              </p>
              <div className="mt-4 space-y-2">
                {recurrentes.slice(0, 4).map(tarea => (
                  <TaskRow
                    key={tarea.id}
                    tarea={tarea}
                    onClick={() => {
                      if (esCompletada(tarea) || tarea.estado === 'no_completada') {
                        setTareaDetalle(tarea)
                      } else {
                        setTareaActiva(tarea)
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-indigo-300" />
                  <p className="font-medium text-white">Ciclo</p>
                </div>
                <Badge className="border-indigo-500/20 bg-indigo-500/10 text-indigo-300">{ciclo.length}</Badge>
              </div>
              <p className="mt-3 text-sm text-white/50">
                {ciclo.filter(esCompletada).length} completadas · {ciclo.filter(t => !esCompletada(t)).length} pendientes
              </p>
              <div className="mt-4 space-y-2">
                {ciclo.slice(0, 4).map(tarea => (
                  <TaskRow
                    key={tarea.id}
                    tarea={tarea}
                    onClick={() => {
                      if (esCompletada(tarea) || tarea.estado === 'no_completada') {
                        setTareaDetalle(tarea)
                      } else {
                        setTareaActiva(tarea)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <SectionTitle
          eyebrow="Mi equipo hoy"
          title="Ordenado desde el más atrasado"
          subtitle="La lista prioriza a quien necesita más apoyo primero."
          action={<Badge className="border-white/10 bg-white/5 text-white/60">{teamStats.length} integrantes</Badge>}
        />
        <div className="mt-5 space-y-3">
          {teamStats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <p className="text-white/55">No hay integrantes para mostrar.</p>
            </div>
          ) : (
            teamStats.map(({ nombre, ...stats }) => (
              <MemberRow
                key={nombre}
                nombre={nombre}
                stats={stats}
                onClick={() => abrirIntegrante(nombre)}
              />
            ))
          )}
        </div>
      </Panel>

      {historial.length > 1 && (
        <Panel className="p-6">
          <SectionTitle
            eyebrow="Tendencia"
            title="Cumplimiento últimos 12 meses"
            subtitle="La serie muestra cómo ha evolucionado el avance del departamento."
            action={<TimelineHint historial={historial} />}
          />
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historial} margin={{ top: 5, right: 16, left: -16, bottom: 5 }}>
                <defs>
                  <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.45} />
                <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
                        <p className="mt-1 text-2xl font-bold text-white">{payload[0].value}%</p>
                        <p className="text-sm text-white/50">
                          {payload[0].payload.completadas}/{payload[0].payload.total} tareas
                        </p>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#22C55E"
                  strokeWidth={3}
                  dot={{ fill: '#22C55E', r: 3 }}
                  activeDot={{ r: 6, fill: '#16A34A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {tareaDetalle && (
        <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />
      )}

      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas'] })
            setTareaActiva(null)
          }}
        />
      )}
    </div>
  )
}

function DashboardUsuario({ tareas, profile, cicloSeleccionado, isLoading, onClickTarea }) {
  const [tareaDetalle, setTareaDetalle] = useState(null)

  const misTareas = tareas.filter(t => t.responsable_nombre === profile?.nombre)
  const misCompletadas = misTareas.filter(t => t.estado === 'completada').length
  const misCompletadasAtraso = misTareas.filter(t => t.estado === 'completada_con_atraso').length
  const misPendientes = misTareas.filter(esPendiente).length
  const misSinCompletar = misTareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada' || esPendiente(t)).length
  const miPct = misTareas.length ? Math.round(((misCompletadas + misCompletadasAtraso) / misTareas.length) * 100) : 0

  const recurrentes = misTareas.filter(t => getTipoTarea(t) === 'recurrente')
  const ciclo = misTareas.filter(t => getTipoTarea(t) === 'ciclo')

  return (
    <div className="relative space-y-6 py-6 md:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%)]" />
      <Panel className="p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Users className="h-3.5 w-3.5" />
                Mi panel
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-white/65">
                {cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : 'Ciclo activo'}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">
              Hola, {profile?.nombre?.split(' ')[0] ?? 'Gabriel'} 👋
            </h1>
            <p className="max-w-2xl text-sm md:text-base text-white/60">
              Tu avance, tus pendientes y tu carga de trabajo en una vista limpia y rápida.
            </p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Mi avance</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-white/55">completadas</p>
                <p className="mt-1 text-4xl font-bold text-white">{miPct}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/55">{misCompletadas + misCompletadasAtraso} / {misTareas.length}</p>
                <p className="text-xs text-white/40">tareas cerradas</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar value={miPct} height="h-4" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Completadas: {misCompletadas + misCompletadasAtraso}</Badge>
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">Pendientes: {misPendientes}</Badge>
              <Badge className="border-red-500/20 bg-red-500/10 text-red-300">Sin completar: {misSinCompletar}</Badge>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={ListChecks} label="Mis tareas" value={misTareas.length} helper="ciclo actual" tone="bg-blue-500/10" />
        <MetricCard icon={CheckCircle2} label="Completadas" value={misCompletadas + misCompletadasAtraso} helper="a tiempo o con atraso" tone="bg-emerald-500/10" />
        <MetricCard icon={Clock3} label="Pendientes" value={misPendientes} helper="requieren atención" tone="bg-amber-500/10" />
        <MetricCard icon={AlertTriangle} label="Sin completar" value={misSinCompletar} helper="no avanzadas" tone="bg-red-500/10" />
      </div>

      <Panel className="p-6">
        <SectionTitle
          eyebrow="Mis tareas por tipo"
          title="Recurrentes y ciclo"
          subtitle="La vista separa las tareas repetitivas de las del ciclo para priorizar mejor."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-300" />
                <p className="font-medium text-white">Recurrentes</p>
              </div>
              <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">{recurrentes.length}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {recurrentes.length === 0 ? (
                <p className="text-sm text-white/45">Sin tareas</p>
              ) : (
                recurrentes.map(t => (
                  <TaskRow
                    key={t.id}
                    tarea={t}
                    onClick={() => {
                      if (esCompletada(t) || t.estado === 'no_completada') {
                        setTareaDetalle(t)
                      } else {
                        onClickTarea(t)
                      }
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-indigo-300" />
                <p className="font-medium text-white">Ciclo</p>
              </div>
              <Badge className="border-indigo-500/20 bg-indigo-500/10 text-indigo-300">{ciclo.length}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {ciclo.length === 0 ? (
                <p className="text-sm text-white/45">Sin tareas</p>
              ) : (
                ciclo.map(t => (
                  <TaskRow
                    key={t.id}
                    tarea={t}
                    onClick={() => {
                      if (esCompletada(t) || t.estado === 'no_completada') {
                        setTareaDetalle(t)
                      } else {
                        onClickTarea(t)
                      }
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <SectionTitle
          eyebrow="Mis pendientes"
          title="Lo que todavía falta"
          subtitle="Las tareas abiertas quedan agrupadas en una lista limpia, sin ruido."
        />
        <div className="mt-5 space-y-3">
          {misTareas.filter(t => !esCompletada(t) && t.estado !== 'no_completada').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
              <p className="font-medium text-white">¡Todo al día!</p>
              <p className="mt-1 text-sm text-white/50">No tienes tareas pendientes para este ciclo.</p>
            </div>
          ) : (
            misTareas
              .filter(t => !esCompletada(t) && t.estado !== 'no_completada')
              .map(tarea => (
                <TaskRow key={tarea.id} tarea={tarea} onClick={() => onClickTarea(tarea)} />
              ))
          )}
        </div>
      </Panel>

      {tareaDetalle && (
        <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />
      )}
    </div>
  )
}

export default function Dashboard({ cicloSeleccionado }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [tareaActiva, setTareaActiva] = useState(null)

  const { data: tareas = [], isLoading } = useTareas(cicloSeleccionado, profile)
  const esAdmin = profile?.rol === 'admin' || profile?.rol === 'gerente'

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4 py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4">
      {esAdmin ? (
        <DashboardAdmin tareas={tareas} cicloSeleccionado={cicloSeleccionado} profile={profile} />
      ) : (
        <DashboardUsuario
          tareas={tareas}
          profile={profile}
          cicloSeleccionado={cicloSeleccionado}
          isLoading={isLoading}
          onClickTarea={setTareaActiva}
        />
      )}

      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas'] })
            setTareaActiva(null)
          }}
        />
      )}
    </div>
  )
}
