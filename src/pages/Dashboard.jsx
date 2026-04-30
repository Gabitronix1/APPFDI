import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ListChecks,
  RefreshCw,
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
  if (!mes || !anio) return ''
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
  const diff = Math.ceil((finMes.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function esCompletada(t) {
  return t.estado === 'completada' || t.estado === 'completada_con_atraso'
}

function esPendiente(t) {
  return t.estado === 'pendiente' || t.estado === 'en_progreso'
}

function esSinCompletar(t) {
  return t.estado === 'con_atraso' || t.estado === 'no_completada' || esPendiente(t)
}

function getTipoTarea(t) {
  const raw = String(t?.tipo_tarea ?? t?.tipo ?? t?.categoria ?? t?.clase ?? t?.origen ?? '').toLowerCase()

  if (raw.includes('cierre')) return 'cierre'
  if (raw.includes('ciclo')) return 'ciclo'
  if (raw.includes('recurrent')) return 'recurrente'
  if (t?.template_id) return 'recurrente'
  return 'ciclo'
}

function getTipoLabel(t) {
  const tipo = getTipoTarea(t)
  if (tipo === 'cierre') return 'Cierre'
  if (tipo === 'recurrente') return 'Recurrente'
  return 'Ciclo'
}

function getEstadoLabel(t) {
  if (t.alerta === 'fuera_de_plazo' && !esCompletada(t)) return 'Fuera de plazo'
  return String(t.estado ?? 'pendiente').replace(/_/g, ' ')
}

function getEstadoChipClass(t) {
  if (t.alerta === 'fuera_de_plazo' && !esCompletada(t)) return 'bg-orange-900/70 text-orange-300 border-orange-800'
  switch (t.estado) {
    case 'completada':
      return 'bg-green-900/70 text-green-300 border-green-800'
    case 'completada_con_atraso':
      return 'bg-yellow-900/70 text-yellow-300 border-yellow-800'
    case 'con_atraso':
      return 'bg-red-900/70 text-red-300 border-red-800'
    case 'en_progreso':
      return 'bg-blue-900/70 text-blue-300 border-blue-800'
    case 'pendiente':
      return 'bg-gray-800 text-gray-300 border-gray-700'
    case 'no_completada':
      return 'bg-gray-900 text-gray-500 border-gray-800'
    default:
      return 'bg-gray-800 text-gray-300 border-gray-700'
  }
}

function getTypeChipClass(tipo) {
  if (tipo === 'cierre') return 'bg-emerald-900/60 text-emerald-300 border-emerald-800'
  if (tipo === 'recurrente') return 'bg-blue-900/60 text-blue-300 border-blue-800'
  return 'bg-gray-800 text-gray-300 border-gray-700'
}

function pctColorClass(pct) {
  if (pct === null || pct === undefined) return 'text-gray-500'
  if (pct === 100) return 'text-green-400'
  if (pct >= 80) return 'text-amber-400'
  if (pct >= 50) return 'text-orange-400'
  return 'text-red-400'
}

function pctBarClass(pct) {
  if (pct === null || pct === undefined) return 'bg-gray-700'
  if (pct === 100) return 'bg-green-500'
  if (pct >= 80) return 'bg-amber-500'
  if (pct >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${className}`}>
      {children}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent = 'bg-gray-800', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <Panel className="p-5 h-full hover:border-gray-700 transition">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${accent}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
        </div>
      </Panel>
    </button>
  )
}

function ProgressBar({ value = 0, height = 'h-3' }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`w-full bg-gray-800 rounded-full overflow-hidden ${height}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${pctBarClass(pct)}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function MemberRow({ nombre, stats, onClick }) {
  const pct = stats.total
    ? Math.round(((stats.completadas + stats.completadasAtraso) / stats.total) * 100)
    : 0
  const restantes = Math.max(0, stats.total - stats.completadas - stats.completadasAtraso)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group"
    >
      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 hover:border-gray-700 hover:bg-gray-800/60 transition">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-900 flex items-center justify-center shrink-0">
                <span className="text-emerald-300 text-sm font-bold">
                  {nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{nombre}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.total} tarea{stats.total === 1 ? '' : 's'} · {restantes} pendiente{restantes === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`text-right ${pctColorClass(pct)}`}>
              <p className="text-xl font-bold">{pct}%</p>
              <p className="text-[11px] text-gray-500">avance</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition" />
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar value={pct} height="h-2.5" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-green-900/60 text-green-300 border-green-800">
            {stats.completadas + stats.completadasAtraso} completadas
          </Badge>
          {stats.atrasadas > 0 && (
            <Badge className="bg-red-900/60 text-red-300 border-red-800">
              {stats.atrasadas} con atraso
            </Badge>
          )}
          {stats.pendientes > 0 && (
            <Badge className="bg-gray-800 text-gray-300 border-gray-700">
              {stats.pendientes} sin completar
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

function TaskTypePill({ tarea }) {
  return (
    <Badge className={getTypeChipClass(getTipoTarea(tarea))}>
      {getTipoLabel(tarea)}
    </Badge>
  )
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
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 hover:bg-gray-800/70 hover:border-gray-700 transition">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {tipo === 'cierre'
                ? <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <RefreshCw className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              }
              <p className="text-white text-sm font-medium truncate">{tarea.nombre_tarea}</p>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {tarea.area || 'Sin área'} · vence {tarea.fecha_termino || 'sin fecha'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap gap-2 justify-end">
              <TaskTypePill tarea={tarea} />
              <Badge className={getEstadoChipClass(tarea)}>
                {getEstadoLabel(tarea)}
              </Badge>
            </div>
            {pct !== null && (
              <span className={`text-xs font-semibold ${pctColorClass(pct)}`}>
                {pct}%
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function StateBreakdown({ completadas, conAtraso, sinCompletar, total }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div className="rounded-2xl bg-gray-950/50 border border-gray-800 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Total</p>
        <p className="text-2xl font-bold text-white mt-1">{total}</p>
      </div>
      <div className="rounded-2xl bg-gray-950/50 border border-gray-800 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Completadas</p>
        <p className="text-2xl font-bold text-green-400 mt-1">{completadas}</p>
      </div>
      <div className="rounded-2xl bg-gray-950/50 border border-gray-800 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Con atraso</p>
        <p className="text-2xl font-bold text-yellow-400 mt-1">{conAtraso}</p>
      </div>
      <div className="rounded-2xl bg-gray-950/50 border border-gray-800 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Sin completar</p>
        <p className="text-2xl font-bold text-red-400 mt-1">{sinCompletar}</p>
      </div>
    </div>
  )
}

function DashboardAdmin({ tareas, cicloSeleccionado, profile, isLoading }) {
  const navigate = useNavigate()
  const [tareaActiva, setTareaActiva] = useState(null)
  const [tareaDetalle, setTareaDetalle] = useState(null)
  const queryClient = useQueryClient()

  const tituloCiclo = useMemo(
    () => (cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : 'Cierre activo'),
    [cicloSeleccionado]
  )

  const diasRestantes = getDiasRestantes(cicloSeleccionado)
  const fechaHoy = formatoFechaES(new Date())

  const completadas = tareas.filter(t => t.estado === 'completada').length
  const conAtraso = tareas.filter(t => t.estado === 'completada_con_atraso').length
  const pendientes = tareas.filter(esPendiente).length
  const atrasadas = tareas.filter(t => t.estado === 'con_atraso').length
  const noCompletadas = tareas.filter(t => t.estado === 'no_completada').length
  const sinCompletar = pendientes + atrasadas + noCompletadas
  const pctCierre = tareas.length ? Math.round(((completadas + conAtraso) / tareas.length) * 100) : 0

  const tareasAdicionales = tareas.filter(t => getTipoTarea(t) !== 'cierre')
  const tareasAdicionalesCompletadas = tareasAdicionales.filter(esCompletada).length
  const tareasAdicionalesPendientes = tareasAdicionales.length - tareasAdicionalesCompletadas

  const teamStats = Object.entries(
    tareas.reduce((acc, tarea) => {
      const nombre = tarea.responsable_nombre ?? 'Sin asignar'
      if (!acc[nombre]) {
        acc[nombre] = {
          total: 0,
          completadas: 0,
          completadasAtraso: 0,
          atrasadas: 0,
          pendientes: 0,
          tareas: [],
        }
      }
      acc[nombre].total += 1
      acc[nombre].tareas.push(tarea)
      if (tarea.estado === 'completada') acc[nombre].completadas += 1
      if (tarea.estado === 'completada_con_atraso') acc[nombre].completadasAtraso += 1
      if (tarea.estado === 'con_atraso') acc[nombre].atrasadas += 1
      if (esPendiente(tarea) || tarea.estado === 'no_completada') acc[nombre].pendientes += 1
      return acc
    }, {})
  )
    .map(([nombre, stats]) => {
      const pct = stats.total
        ? Math.round(((stats.completadas + stats.completadasAtraso) / stats.total) * 100)
        : 0
      return { nombre, ...stats, pct }
    })
    .sort((a, b) => a.pct - b.pct || b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre))

  const tareasCierre = tareas.filter(t => getTipoTarea(t) === 'cierre')
  const tareasRecurrentes = tareas.filter(t => getTipoTarea(t) === 'recurrente')
  const tareasCiclo = tareas.filter(t => getTipoTarea(t) === 'ciclo')

  const { data: historial = [] } = useQuery({
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

  function abrirIntegrante(nombre) {
    navigate(`/integrantes/${slugify(nombre)}`, {
      state: {
        nombre,
        departamento: profile?.departamento,
        cicloId: cicloSeleccionado?.id,
      },
    })
  }

  return (
    <div className="space-y-8">
      <Panel className="p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Hola, {profile?.nombre?.split(' ')[0] ?? 'Gabriel'} 👋
              </h1>
              <Badge className="bg-emerald-900/70 text-emerald-300 border-emerald-800">
                Cierre activo
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span className="text-gray-300 font-medium">{tituloCiclo}</span>
              <span className="text-gray-600">•</span>
              <span>Hoy: {fechaHoy}</span>
              {diasRestantes !== null && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className={diasRestantes >= 0 ? 'text-gray-300' : 'text-red-400'}>
                    {diasRestantes >= 0 ? `${diasRestantes} días restantes` : `${Math.abs(diasRestantes)} días de atraso`}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className="bg-gray-800 text-gray-300 border-gray-700">Total: {tareas.length}</Badge>
              <Badge className="bg-green-900/60 text-green-300 border-green-800">Completadas: {completadas}</Badge>
              <Badge className="bg-yellow-900/60 text-yellow-300 border-yellow-800">Con atraso: {conAtraso}</Badge>
              <Badge className="bg-red-900/60 text-red-300 border-red-800">Sin completar: {sinCompletar}</Badge>
            </div>
          </div>

          <div className="w-full lg:w-[320px]">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Estado del cierre</p>
                  <p className="text-white text-sm mt-1">{completadas + conAtraso} de {tareas.length} tareas completadas</p>
                </div>
                <div className={`text-4xl font-bold ${pctColorClass(pctCierre)}`}>
                  {pctCierre}%
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar value={pctCierre} height="h-3.5" />
              </div>
              <div className="mt-4">
                <StateBreakdown
                  total={tareas.length}
                  completadas={completadas}
                  conAtraso={conAtraso}
                  sinCompletar={sinCompletar}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={ListChecks}
          label="Total tareas"
          value={tareas.length}
          sub="del cierre actual"
          accent="bg-blue-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completadas"
          value={completadas}
          sub={`${tareas.length ? Math.round((completadas / tareas.length) * 100) : 0}% del total`}
          accent="bg-green-700"
        />
        <StatCard
          icon={Clock}
          label="Con atraso"
          value={conAtraso}
          sub="terminadas fuera de plazo"
          accent="bg-yellow-700"
        />
      </div>

      <Panel className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Tareas del mes</p>
            <h2 className="text-xl font-semibold text-white mt-1">Tareas adicionales fuera del cierre</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-800">
              {tareasAdicionalesCompletadas} completadas
            </Badge>
            <Badge className="bg-gray-800 text-gray-300 border-gray-700">
              {tareasAdicionalesPendientes} pendientes
            </Badge>
            <Badge className="bg-blue-900/60 text-blue-300 border-blue-800">
              {tareasRecurrentes.length} recurrentes
            </Badge>
            <Badge className="bg-gray-800 text-gray-300 border-gray-700">
              {tareasCiclo.length} de ciclo
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tareasAdicionales.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-700 bg-gray-950/30 p-8 text-center">
              <p className="text-gray-400">No hay tareas adicionales para mostrar en este mes.</p>
            </div>
          ) : (
            tareasAdicionales
              .slice()
              .sort((a, b) => {
                const typeA = getTipoTarea(a)
                const typeB = getTipoTarea(b)
                if (typeA !== typeB) return typeA.localeCompare(typeB)
                return String(a.nombre_tarea).localeCompare(String(b.nombre_tarea))
              })
              .map(tarea => (
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Mi equipo hoy</p>
            <h2 className="text-xl font-semibold text-white mt-1">Los más atrasados aparecen primero</h2>
          </div>
          <Badge className="bg-gray-800 text-gray-300 border-gray-700">
            {teamStats.length} integrantes
          </Badge>
        </div>

        <div className="mt-5 space-y-3">
          {teamStats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/30 p-8 text-center">
              <p className="text-gray-400">No hay integrantes para mostrar.</p>
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
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Tendencia</p>
              <h2 className="text-white font-semibold">Cumplimiento últimos 12 meses</h2>
            </div>
          </div>

          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historial} margin={{ top: 5, right: 12, left: -18, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 shadow-xl">
                        <p className="text-gray-400 text-xs mb-1">{label}</p>
                        <p className="text-white font-bold text-lg">{payload[0].value}%</p>
                        <p className="text-gray-500 text-xs">
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
                  strokeWidth={2}
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
  const misSinCompletar = misTareas.filter(esSinCompletar).length
  const miPct = misTareas.length ? Math.round(((misCompletadas + misCompletadasAtraso) / misTareas.length) * 100) : 0

  const tareasCierre = misTareas.filter(t => getTipoTarea(t) === 'cierre')
  const tareasCiclo = misTareas.filter(t => getTipoTarea(t) === 'ciclo')
  const tareasRecurrentes = misTareas.filter(t => getTipoTarea(t) === 'recurrente')

  return (
    <div className="space-y-8">
      <Panel className="p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Hola, {profile?.nombre?.split(' ')[0] ?? 'Gabriel'} 👋
              </h1>
              <Badge className="bg-emerald-900/70 text-emerald-300 border-emerald-800">
                Mi panel
              </Badge>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : 'Ciclo activo'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Mi avance</p>
            <p className={`text-4xl font-bold mt-1 ${pctColorClass(miPct)}`}>{miPct}%</p>
          </div>
        </div>

        <div className="mt-5">
          <ProgressBar value={miPct} height="h-3.5" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-gray-800 text-gray-300 border-gray-700">Mis tareas: {misTareas.length}</Badge>
          <Badge className="bg-green-900/60 text-green-300 border-green-800">Completadas: {misCompletadas + misCompletadasAtraso}</Badge>
          <Badge className="bg-yellow-900/60 text-yellow-300 border-yellow-800">Pendientes: {misPendientes}</Badge>
          <Badge className="bg-red-900/60 text-red-300 border-red-800">Sin completar: {misSinCompletar}</Badge>
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={ListChecks} label="Mis tareas" value={misTareas.length} accent="bg-blue-700" />
        <StatCard icon={CheckCircle2} label="Completadas" value={misCompletadas + misCompletadasAtraso} accent="bg-green-700" />
        <StatCard icon={Clock} label="Pendientes" value={misPendientes} accent="bg-amber-600" />
        <StatCard icon={AlertCircle} label="Sin completar" value={misSinCompletar} accent="bg-red-700" />
      </div>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Mis tareas por tipo</p>
            <h2 className="text-white font-semibold mt-1">Recurrentes, cierre y ciclo</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-900/60 text-blue-300 border-blue-800">{tareasRecurrentes.length} recurrentes</Badge>
            <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-800">{tareasCierre.length} de cierre</Badge>
            <Badge className="bg-gray-800 text-gray-300 border-gray-700">{tareasCiclo.length} de ciclo</Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            ['recurrente', tareasRecurrentes],
            ['cierre', tareasCierre],
            ['ciclo', tareasCiclo],
          ].map(([tipo, lista]) => (
            <div key={tipo} className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${tipo === 'cierre' ? 'bg-emerald-400' : tipo === 'recurrente' ? 'bg-blue-400' : 'bg-gray-400'}`} />
                  <p className="text-white font-medium capitalize">{tipo}</p>
                </div>
                <span className="text-xs text-gray-500">{lista.length}</span>
              </div>

              <div className="space-y-2">
                {lista.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin tareas</p>
                ) : (
                  lista.map(t => (
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
          ))}
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-green-400" />
          <h2 className="text-white font-semibold">Mis tareas pendientes</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {misTareas.filter(t => !esCompletada(t) && t.estado !== 'no_completada').length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/30 p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-gray-300 font-medium">¡Todo al día!</p>
                <p className="text-gray-500 text-sm">No tienes tareas pendientes para este ciclo</p>
              </div>
            ) : (
              misTareas
                .filter(t => !esCompletada(t) && t.estado !== 'no_completada')
                .map(tarea => (
                  <TaskRow key={tarea.id} tarea={tarea} onClick={() => onClickTarea(tarea)} />
                ))
            )}
          </div>
        )}
      </Panel>

      {tareaDetalle && (
        <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />
      )}
    </div>
  )
}

export default function Dashboard({ cicloSeleccionado }) {
  const { profile } = useAuth()
  const [tareaActiva, setTareaActiva] = useState(null)
  const queryClient = useQueryClient()

  const { data: tareas = [], isLoading } = useQuery({
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

  const esAdmin = profile?.rol === 'admin' || profile?.rol === 'gerente'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : esAdmin ? (
        <DashboardAdmin
          tareas={tareas}
          cicloSeleccionado={cicloSeleccionado}
          profile={profile}
          isLoading={isLoading}
        />
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
            queryClient.invalidateQueries({ queryKey: ['tareas', cicloSeleccionado?.id] })
            setTareaActiva(null)
          }}
        />
      )}
    </div>
  )
}
