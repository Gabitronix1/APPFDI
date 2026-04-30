import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Flame,
  Sparkles,
  Users,
  AlertTriangle,
  Layers3,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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

function nombreCiclo(mes, anio) {
  if (!mes || !anio) return 'Ciclo activo'
  if (mes === 1) return `Ciclo de Diciembre ${anio - 1}`
  return `Ciclo de ${MESES[mes - 2]} ${anio}`
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

function getEstadoClass(t) {
  if (t.alerta === 'fuera_de_plazo' && !esCompletada(t)) return 'bg-orange-500/10 text-orange-300 border-orange-500/20'
  switch (t.estado) {
    case 'completada':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    case 'completada_con_atraso':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    case 'con_atraso':
      return 'bg-red-500/10 text-red-300 border-red-500/20'
    case 'en_progreso':
      return 'bg-blue-500/10 text-blue-300 border-blue-500/20'
    case 'pendiente':
      return 'bg-white/5 text-white/60 border-white/10'
    case 'no_completada':
      return 'bg-white/5 text-white/35 border-white/10'
    default:
      return 'bg-white/5 text-white/60 border-white/10'
  }
}

function getTypeClass(tipo) {
  if (tipo === 'ciclo') return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
  return 'bg-blue-500/10 text-blue-300 border-blue-500/20'
}

function pctColorClass(pct) {
  if (pct >= 100) return 'text-emerald-300'
  if (pct >= 85) return 'text-emerald-300'
  if (pct >= 65) return 'text-amber-300'
  if (pct >= 40) return 'text-orange-300'
  return 'text-red-300'
}

function pctBarClass(pct) {
  if (pct >= 100) return 'bg-emerald-500'
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

function StatCard({ label, value, helper, className = 'text-white' }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${className}`}>{value}</p>
      {helper && <p className="mt-1 text-sm text-white/50">{helper}</p>}
    </div>
  )
}

function TaskRow({ tarea, onClick }) {
  const tipo = getTipoTarea(tarea)
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
              <Badge className={getTypeClass(tipo)}>{getTipoLabel(tarea)}</Badge>
              <Badge className={getEstadoClass(tarea)}>{String(tarea.estado ?? 'pendiente').replace(/_/g, ' ')}</Badge>
            </div>
            {pct !== null && <span className={`text-sm font-bold ${pctColorClass(pct)}`}>{pct}%</span>}
          </div>
        </div>
      </div>
    </button>
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

function useTeamStats(cicloSeleccionado, profile) {
  return useQuery({
    queryKey: ['team-stats', cicloSeleccionado?.id, profile?.departamento],
    enabled: !!cicloSeleccionado?.id && !!profile?.departamento,
    queryFn: async () => {
      let query = supabase
        .from('v_tareas_ciclo_activo')
        .select('responsable_nombre, estado, porcentaje_cumplimiento, fecha_termino, tipo_tarea, tipo, categoria, clase, origen, alerta')
        .eq('ciclo_id', cicloSeleccionado.id)

      if (profile?.rol !== 'gerente') query = query.eq('departamento', profile?.departamento)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

function MemberMiniCard({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}

export default function DetalleIntegrante({ cicloSeleccionado }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { integranteSlug } = useParams()
  const [tareaActiva, setTareaActiva] = useState(null)
  const [tareaDetalle, setTareaDetalle] = useState(null)

  const { data: tareas = [], isLoading } = useTareas(cicloSeleccionado, profile)
  const { data: teamRaw = [] } = useTeamStats(cicloSeleccionado, profile)

  const nombreDesdeRuta = location.state?.nombre ?? decodeURIComponent(integranteSlug ?? '')

  const tareasIntegrante = useMemo(() => {
    const targetSlug = integranteSlug ? String(integranteSlug) : slugify(nombreDesdeRuta)
    return tareas.filter(t => slugify(t.responsable_nombre) === targetSlug)
  }, [tareas, integranteSlug, nombreDesdeRuta])

  const nombreIntegrante = useMemo(() => {
    if (location.state?.nombre) return location.state.nombre
    const primerNombre = tareasIntegrante[0]?.responsable_nombre
    if (primerNombre) return primerNombre
    return nombreDesdeRuta
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }, [location.state?.nombre, tareasIntegrante, nombreDesdeRuta])

  const completadas = tareasIntegrante.filter(t => t.estado === 'completada').length
  const completadasAtraso = tareasIntegrante.filter(t => t.estado === 'completada_con_atraso').length
  const atrasadas = tareasIntegrante.filter(t => t.estado === 'con_atraso').length
  const pendientes = tareasIntegrante.filter(esPendiente).length
  const noCompletadas = tareasIntegrante.filter(t => t.estado === 'no_completada').length
  const sinCompletar = pendientes + atrasadas + noCompletadas
  const pct = tareasIntegrante.length ? Math.round(((completadas + completadasAtraso) / tareasIntegrante.length) * 100) : 0

  const recurrentes = tareasIntegrante.filter(t => getTipoTarea(t) === 'recurrente')
  const ciclo = tareasIntegrante.filter(t => getTipoTarea(t) === 'ciclo')

  const ranking = useMemo(() => {
    const grouped = teamRaw.reduce((acc, tarea) => {
      const nombre = tarea.responsable_nombre ?? 'Sin asignar'
      if (!acc[nombre]) {
        acc[nombre] = { total: 0, completadas: 0, completadasAtraso: 0, atrasadas: 0, pendientes: 0 }
      }
      acc[nombre].total += 1
      if (tarea.estado === 'completada') acc[nombre].completadas += 1
      if (tarea.estado === 'completada_con_atraso') acc[nombre].completadasAtraso += 1
      if (tarea.estado === 'con_atraso') acc[nombre].atrasadas += 1
      if (esPendiente(tarea) || tarea.estado === 'no_completada') acc[nombre].pendientes += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([nombre, stats]) => {
        const avance = stats.total
          ? Math.round(((stats.completadas + stats.completadasAtraso) / stats.total) * 100)
          : 0
        return { nombre, ...stats, avance }
      })
      .sort((a, b) => b.avance - a.avance || a.nombre.localeCompare(b.nombre))
  }, [teamRaw])

  const posicion = useMemo(() => {
    const idx = ranking.findIndex(r => r.nombre === nombreIntegrante)
    return idx >= 0 ? idx + 1 : null
  }, [ranking, nombreIntegrante])

  const promedioEquipo = useMemo(() => {
    if (!ranking.length) return 0
    return Math.round(ranking.reduce((acc, item) => acc + item.avance, 0) / ranking.length)
  }, [ranking])

  function diasDiff(fecha) {
    if (!fecha) return 999
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return 999
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const tareasUrgentes = useMemo(() => {
    return [...tareasIntegrante]
      .filter(t => !esCompletada(t))
      .sort((a, b) => {
        const da = a.estado === 'con_atraso' ? -999 : diasDiff(a.fecha_termino)
        const db = b.estado === 'con_atraso' ? -999 : diasDiff(b.fecha_termino)
        if (da !== db) return da - db
        return String(a.nombre_tarea ?? '').localeCompare(String(b.nombre_tarea ?? ''))
      })
      .slice(0, 4)
  }, [tareasIntegrante])

  const fechaHoy = formatoFechaES(new Date())

  return (
    <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 md:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

      <Panel className="p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-2 text-sm text-white/75 transition hover:border-white/10 hover:bg-white/[0.05]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Users className="h-3.5 w-3.5" />
                Detalle de integrante
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-white/65">
                {cicloSeleccionado ? nombreCiclo(cicloSeleccionado.mes, cicloSeleccionado.anio) : 'Ciclo activo'}
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-white/65">
                <Flame className="h-3.5 w-3.5" />
                {fechaHoy}
              </Badge>
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                {nombreIntegrante}
              </h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                Vista individual con foco en avance, riesgo y carga por tipo de trabajo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/10 bg-white/5 text-white/70">{tareasIntegrante.length} tareas</Badge>
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                {completadas + completadasAtraso} completadas
              </Badge>
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">
                {completadasAtraso + atrasadas} con atraso
              </Badge>
              <Badge className="border-red-500/20 bg-red-500/10 text-red-300">
                {sinCompletar} sin completar
              </Badge>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Avance</p>
                <p className={`mt-2 text-5xl font-bold ${pctColorClass(pct)}`}>{pct}%</p>
              </div>
              <Badge className="border-white/10 bg-white/5 text-white/65">
                <BarChart3 className="h-3.5 w-3.5" />
                Posición #{posicion ?? '—'}
              </Badge>
            </div>

            <div className="mt-4">
              <ProgressBar value={pct} height="h-4" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MemberMiniCard label="A tiempo" value={completadas} tone="text-emerald-300" />
              <MemberMiniCard label="Con atraso" value={completadasAtraso + atrasadas} tone="text-amber-300" />
              <MemberMiniCard label="Pendientes" value={pendientes} tone="text-white" />
              <MemberMiniCard label="Promedio equipo" value={`${promedioEquipo}%`} tone="text-indigo-300" />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total" value={tareasIntegrante.length} helper="tareas asignadas" />
        <StatCard label="Completadas" value={completadas + completadasAtraso} helper="terminadas a tiempo o con atraso" className="text-emerald-300" />
        <StatCard label="Pendientes" value={pendientes} helper="requieren seguimiento" className="text-amber-300" />
        <StatCard label="Sin completar" value={sinCompletar} helper="atrasadas + no completadas" className="text-red-300" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <Panel className="p-6">
          <SectionTitle
            eyebrow="Distribución del trabajo"
            title="Recurrentes y ciclo"
            subtitle="La lista está dividida en dos grupos para que el detalle sea más legible."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-300" />
                  <p className="font-medium text-white">Recurrentes</p>
                </div>
                <Badge className={getTypeClass('recurrente')}>{recurrentes.length}</Badge>
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
                          setTareaActiva(t)
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
                <Badge className={getTypeClass('ciclo')}>{ciclo.length}</Badge>
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
                          setTareaActiva(t)
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
            eyebrow="Lectura ejecutiva"
            title="Riesgo y señales"
            subtitle="Aquí resaltamos lo que necesita atención inmediata."
          />

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Problemas detectados</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <AlertTriangle className="h-4 w-4 text-red-300" />
                  {atrasadas > 0 ? `${atrasadas} tareas con atraso.` : 'No hay tareas atrasadas.'}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock3 className="h-4 w-4 text-amber-300" />
                  {pendientes > 0 ? `${pendientes} tareas todavía abiertas.` : 'No quedan tareas abiertas.'}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {pct >= 80 ? 'Nivel de cumplimiento alto.' : 'Todavía hay espacio para mejorar el cumplimiento.'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Mi progreso</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MemberMiniCard label="Avance" value={`${pct}%`} tone="text-emerald-300" />
                <MemberMiniCard label="Ranking" value={posicion ? `#${posicion}` : '—'} tone="text-indigo-300" />
                <MemberMiniCard label="Promedio equipo" value={`${promedioEquipo}%`} tone="text-white" />
                <MemberMiniCard label="Tareas urgentes" value={tareasUrgentes.length} tone="text-red-300" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Tareas urgentes</p>
              <div className="mt-3 space-y-2">
                {tareasUrgentes.length === 0 ? (
                  <p className="text-sm text-white/45">No hay urgencias inmediatas.</p>
                ) : (
                  tareasUrgentes.map(t => (
                    <TaskRow
                      key={t.id}
                      tarea={t}
                      onClick={() => {
                        if (esCompletada(t) || t.estado === 'no_completada') {
                          setTareaDetalle(t)
                        } else {
                          setTareaActiva(t)
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <SectionTitle
          eyebrow="Resumen rápido"
          title="Estado general"
          subtitle="Una lectura rápida para saber cuánta carga sigue abierta."
        />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Abiertas" value={tareasIntegrante.filter(t => !esCompletada(t)).length} helper="tareas no cerradas" />
          <StatCard label="Fuera de plazo" value={tareasIntegrante.filter(t => t.alerta === 'fuera_de_plazo' && !esCompletada(t)).length} helper="requieren revisión" className="text-red-300" />
          <StatCard label="Recurrentes" value={recurrentes.length} helper="trabajo repetitivo" className="text-blue-300" />
          <StatCard label="Ciclo" value={ciclo.length} helper="trabajo del periodo" className="text-indigo-300" />
        </div>
      </Panel>

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
