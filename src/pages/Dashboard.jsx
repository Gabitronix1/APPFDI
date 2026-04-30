import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Clock, AlertCircle, ListChecks, TrendingUp,
  User, Users, RefreshCw, Sparkles, X, Calendar, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import TaskModal from '../components/TaskModal'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DetalleTareaPanel from '../components/DetalleTareaPanel'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

function formatFechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`
}

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">—</span>
  }
  const color = pct === 100 ? 'bg-green-900 text-green-300'
    : pct >= 80 ? 'bg-amber-900 text-amber-300'
    : pct >= 50 ? 'bg-orange-900 text-orange-300'
    : 'bg-red-900 text-red-300'
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{pct}%</span>
}

function StatCard({ icon: Icon, label, value, color, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4
        hover:border-gray-700 transition ${onClick ? 'cursor-pointer hover:bg-gray-800/50' : ''}`}
    >
      <div className={`p-3 rounded-xl ${color} shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function TareaRow({ tarea, onClick }) {
  const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
  const borderColor = {
    ok:             'border-gray-800',
    por_vencer:     'border-amber-500',
    fuera_de_plazo: 'border-red-500',
  }[tarea.alerta] ?? 'border-gray-800'

  const badge = esFueraPlazo ? 'bg-orange-900 text-orange-300'
    : {
        pendiente:             'bg-gray-800 text-gray-300',
        en_progreso:           'bg-blue-900 text-blue-300',
        con_atraso:            'bg-red-900 text-red-300',
        completada_con_atraso: 'bg-yellow-900 text-yellow-300',
        no_completada:         'bg-gray-900 text-gray-600',
      }[tarea.estado] ?? 'bg-gray-800 text-gray-300'

  const label = esFueraPlazo ? 'Fuera de plazo' : tarea.estado.replace(/_/g, ' ')

  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border ${borderColor} rounded-xl p-4 flex items-center
        justify-between gap-4 transition ${onClick ? 'cursor-pointer hover:bg-gray-800' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {tarea.template_id
            ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
            : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
          <p className="text-white text-sm font-medium truncate">{tarea.nombre_tarea}</p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">{tarea.area} · Vence {tarea.fecha_termino}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${badge}`}>
        {label}
      </span>
    </div>
  )
}

function ModalListaTareas({ titulo, tareas, onClose, onClickTarea }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{titulo}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {tareas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin tareas</p>
          ) : tareas.map(tarea => (
            <div
              key={tarea.id}
              onClick={() => { onClose(); onClickTarea(tarea) }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center
                gap-3 cursor-pointer hover:bg-gray-700 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {tarea.template_id
                    ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
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
}

// ─── DASHBOARD ADMIN ──────────────────────────────────────────────────────────
function DashboardAdmin({ tareas, tituloCiclo, cicloSeleccionado, isLoading, profile, esCicloCerrado }) {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [modalFiltro, setModalFiltro]   = useState(null)
  const [tareaDetalle, setTareaDetalle] = useState(null)
  const [tareaActiva, setTareaActiva]   = useState(null)

  // Separar tareas por tipo
  const tareasCierre     = tareas.filter(t => t.tipo_tarea === 'cierre' || t.template_id)
  const tareasAdicionales = tareas.filter(t => t.tipo_tarea === 'adicional' && !t.template_id)

  // Métricas del cierre
  const cierreCompletadas = tareasCierre.filter(t => t.estado === 'completada').length
  const cierreAtraso      = tareasCierre.filter(t => t.estado === 'completada_con_atraso').length
  const cierrePendientes  = tareasCierre.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const cierreAtrasadas   = tareasCierre.filter(t => t.estado === 'con_atraso').length
  const cierreNoComp      = tareasCierre.filter(t => t.estado === 'no_completada').length
  const cierrePct         = tareasCierre.length
    ? Math.round(((cierreCompletadas + cierreAtraso) / tareasCierre.length) * 100) : 0

  // Métricas adicionales
  const adicCompletadas = tareasAdicionales.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const adicPendientes  = tareasAdicionales.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const adicPct         = tareasAdicionales.length
    ? Math.round((adicCompletadas / tareasAdicionales.length) * 100) : 0

  // Mi equipo — por integrante
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

  // Historial 12 meses
  const { data: historial = [] } = useQuery({
    queryKey: ['historial-admin', profile?.departamento],
    queryFn: async () => {
      const { data: ciclosHist } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .order('anio', { ascending: true })
        .order('mes', { ascending: true })
        .limit(12)
      if (!ciclosHist?.length) return []
      const results = []
      for (const c of ciclosHist) {
        const { data: tareasHist } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado')
          .eq('ciclo_id', c.id)
          .eq('departamento', profile?.departamento)
        if (!tareasHist?.length) continue
        const comp = tareasHist.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
        results.push({
          mes: nombreCierre(c.mes, c.anio).replace('Cierre de ', ''),
          pct: Math.round((comp / tareasHist.length) * 100),
          completadas: comp,
          total: tareasHist.length,
        })
      }
      return results
    }
  })

  function handleClickTarea(tarea) {
    if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada') {
      setTareaDetalle(tarea)
    } else {
      setTareaActiva(tarea)
    }
  }

  const colorCierre = cierrePct === 100 ? 'bg-green-500' : cierrePct > 60 ? 'bg-amber-500' : 'bg-red-500'
  const textoCierre = cierrePct === 100 ? 'text-green-400' : cierrePct > 60 ? 'text-amber-400' : 'text-red-400'
  const colorAdic   = adicPct === 100 ? 'bg-green-500' : adicPct > 60 ? 'bg-amber-500' : 'bg-red-500'
  const textoAdic   = adicPct === 100 ? 'text-green-400' : adicPct > 60 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-6">

      {/* ── BLOQUE CIERRE ─────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Header cierre */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/30">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold">{tituloCiclo}</h2>
            {esCicloCerrado
              ? <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">🔒 cerrado</span>
              : <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">● activo</span>}
          </div>
          <span className={`text-2xl font-bold ${textoCierre}`}>{cierrePct}%</span>
        </div>

        {/* Barra progreso cierre */}
        <div className="px-6 py-4">
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-3">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${colorCierre}`}
              style={{ width: `${cierrePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {cierreCompletadas + cierreAtraso} de {tareasCierre.length} tareas completadas
            {cierreAtraso > 0 && <span className="text-yellow-600 ml-2">({cierreAtraso} con atraso)</span>}
          </p>

          {/* 4 stats del cierre */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={ListChecks} label="Total" value={tareasCierre.length} color="bg-blue-700" sub="tareas del cierre" />
            <StatCard
              icon={CheckCircle2} label="Completadas" value={cierreCompletadas} color="bg-green-700" sub="En fecha"
              onClick={!esCicloCerrado ? () => setModalFiltro('completadas') : undefined}
            />
            <StatCard
              icon={Clock} label="Con atraso" value={cierreAtraso} color="bg-yellow-700" sub="Completadas tarde"
              onClick={!esCicloCerrado ? () => setModalFiltro('atraso') : undefined}
            />
            <StatCard
              icon={AlertCircle} label="Sin completar" value={cierrePendientes + cierreAtrasadas + cierreNoComp}
              color="bg-red-700" sub={`${cierrePendientes} pend. · ${cierreAtrasadas + cierreNoComp} vencidas`}
              onClick={!esCicloCerrado ? () => setModalFiltro('sinCompletar') : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── BLOQUE ADICIONALES ────────────────────────────────── */}
      {tareasAdicionales.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold">
                Tareas de {MESES[new Date().getMonth()]} {new Date().getFullYear()}
              </h2>
            </div>
            <span className={`text-2xl font-bold ${textoAdic}`}>{adicPct}%</span>
          </div>
          <div className="px-6 py-4">
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${colorAdic}`}
                style={{ width: `${adicPct}%` }}
              />
            </div>
            <div className="flex gap-4">
              <span className="text-xs text-green-400">✓ {adicCompletadas} completadas</span>
              <span className="text-xs text-amber-400">⏳ {adicPendientes} pendientes</span>
              <span className="text-xs text-gray-500">{tareasAdicionales.length} total</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MI EQUIPO HOY ─────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <Users className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-semibold">Mi equipo hoy</h2>
        </div>
        <div className="divide-y divide-gray-800/50">
          {Object.entries(porIntegrante)
            .sort((a, b) => {
              const pctA = a[1].total ? (a[1].completadas / a[1].total) : 0
              const pctB = b[1].total ? (b[1].completadas / b[1].total) : 0
              return pctA - pctB // menor primero
            })
            .map(([nombre, stats]) => {
              const pct   = stats.total ? Math.round((stats.completadas / stats.total) * 100) : 0
              const color = pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
              const texto = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
              const iniciales = nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)

              return (
                <div
                  key={nombre}
                  onClick={() => navigate(`/integrante/${encodeURIComponent(nombre)}`, {
                    state: { cicloId: cicloSeleccionado?.id }
                  })}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/40 cursor-pointer transition group"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center shrink-0">
                    <span className="text-blue-300 text-sm font-bold">{iniciales}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-white text-sm font-medium">{nombre.split(' ')[0]} {nombre.split(' ')[1]}</p>
                      <span className={`text-sm font-bold ${texto}`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {stats.pendientes > 0 && (
                        <span className="text-xs text-amber-500">⏳ {stats.pendientes} pendiente{stats.pendientes > 1 ? 's' : ''}</span>
                      )}
                      {stats.fueraPlazo > 0 && (
                        <span className="text-xs text-red-400">🔴 {stats.fueraPlazo} vencida{stats.fueraPlazo > 1 ? 's' : ''}</span>
                      )}
                      {pct === 100 && (
                        <span className="text-xs text-green-400">✅ Al día</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition shrink-0" />
                </div>
              )
            })}
        </div>
      </div>

      {/* ── TENDENCIA 12 MESES ────────────────────────────────── */}
      {historial.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-white font-semibold">Tendencia de cumplimiento</h2>
            <span className="text-xs text-gray-500 ml-1">— últimos {historial.length} cierres</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historial} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
                        <p className="text-gray-400 text-xs mb-1">{label}</p>
                        <p className="text-white font-bold text-lg">{payload[0].value}%</p>
                        <p className="text-gray-500 text-xs">{payload[0].payload.completadas}/{payload[0].payload.total} tareas</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line type="monotone" dataKey="pct" stroke="#22C55E" strokeWidth={2}
                dot={{ fill: '#22C55E', r: 4 }} activeDot={{ r: 6, fill: '#16A34A' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── MIS TAREAS PENDIENTES (si el admin tiene) ─────────── */}
      {(() => {
        const misTareasPendientes = tareas.filter(t =>
          t.responsable_nombre === profile?.nombre &&
          !['completada', 'completada_con_atraso', 'no_completada'].includes(t.estado)
        )
        if (misTareasPendientes.length === 0) return null
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5 text-green-400" />
              <h2 className="text-white font-semibold">Mis tareas pendientes</h2>
              <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                {misTareasPendientes.length}
              </span>
            </div>
            <div className="space-y-3">
              {misTareasPendientes.map(tarea => (
                <TareaRow key={tarea.id} tarea={tarea}
                  onClick={() => !esCicloCerrado && handleClickTarea(tarea)} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Modales */}
      {modalFiltro && (
        <ModalListaTareas
          titulo={
            modalFiltro === 'completadas'  ? `Completadas en fecha (${cierreCompletadas})`
            : modalFiltro === 'atraso'     ? `Completadas con atraso (${cierreAtraso})`
            : `Sin completar (${cierrePendientes + cierreAtrasadas + cierreNoComp})`
          }
          tareas={tareasCierre.filter(t =>
            modalFiltro === 'completadas'  ? t.estado === 'completada'
            : modalFiltro === 'atraso'     ? t.estado === 'completada_con_atraso'
            : ['con_atraso','no_completada','pendiente','en_progreso'].includes(t.estado)
          )}
          onClose={() => setModalFiltro(null)}
          onClickTarea={handleClickTarea}
        />
      )}
      {tareaDetalle && <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />}
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

  const misPendientesActivas = misTareas.filter(t =>
    t.estado !== 'completada' && t.estado !== 'completada_con_atraso' && t.estado !== 'no_completada'
  )

  const totalEquipo       = tareas.length
  const completadasEquipo = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const pctEquipo         = totalEquipo ? Math.round((completadasEquipo / totalEquipo) * 100) : 0

  const tareasConDato = misTareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso' ||
    t.estado === 'no_completada' || t.estado === 'con_atraso'
  )
  const miPromedioResponsabilidad = tareasConDato.length
    ? Math.round(tareasConDato.reduce((s, t) => {
        if (t.estado === 'completada' || t.estado === 'completada_con_atraso') return s + (t.porcentaje_cumplimiento ?? 100)
        return s
      }, 0) / tareasConDato.length)
    : null

  return (
    <div className="space-y-6">

      {/* Barra progreso personal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-white font-semibold">Mi avance</h2>
            <p className="text-gray-500 text-sm mt-0.5">{tituloCiclo}</p>
          </div>
          <span className={`text-3xl font-bold ${miPct === 100 ? 'text-green-400' : miPct > 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {miPct}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${miPct === 100 ? 'bg-green-500' : miPct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${miPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            {misCompletadas + misCompletadasAtraso} de {misTareas.length} tareas completadas
          </p>
          <p className="text-xs text-gray-500">
            Equipo: <span className="text-gray-400">{pctEquipo}%</span>
          </p>
        </div>
      </div>

      {/* Stats personales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ListChecks}   label="Mis tareas"    value={misTareas.length}                      color="bg-blue-700"  sub="este cierre" />
        <StatCard icon={CheckCircle2} label="Completadas"   value={misCompletadas + misCompletadasAtraso}  color="bg-green-700" sub={`${miPct}% del total`} />
        <StatCard icon={Clock}        label="Pendientes"    value={misPendientes}                         color="bg-amber-600" sub="Por completar" />
        <StatCard icon={AlertCircle}  label="Sin completar" value={misAtrasadas}                          color="bg-red-700"   sub="Vencidas" />
      </div>

      {/* Mi % de responsabilidad */}
      {miPromedioResponsabilidad !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-white font-semibold">Mi % de responsabilidad</h2>
              </div>
              <p className="text-gray-500 text-sm">Promedio sobre tareas con resultado</p>
            </div>
            <div className={`text-4xl font-bold ${
              miPromedioResponsabilidad === 100 ? 'text-green-400'
              : miPromedioResponsabilidad >= 80  ? 'text-amber-400'
              : miPromedioResponsabilidad >= 50  ? 'text-orange-400'
              : 'text-red-400'
            }`}>
              {miPromedioResponsabilidad}%
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {tareasConDato.map(t => {
              const pct = t.estado === 'completada' || t.estado === 'completada_con_atraso'
                ? (t.porcentaje_cumplimiento ?? 100) : 0
              return (
                <div key={t.id} className="flex items-center justify-between gap-4 py-2 border-b border-gray-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.template_id
                        ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                        : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                      <p className="text-gray-300 text-sm truncate">{t.nombre_tarea}</p>
                    </div>
                    <p className="text-gray-600 text-xs">{t.area}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {t.dias_atraso > 0 && <span className="text-xs text-gray-500">{t.dias_atraso}d atraso</span>}
                    <PctBadge pct={pct} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mis tareas pendientes */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-green-400" />
          <h2 className="text-white font-semibold">Mis tareas pendientes</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : misPendientesActivas.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">¡Todo al día!</p>
            <p className="text-gray-500 text-sm">No tienes tareas pendientes este ciclo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {misPendientesActivas.map(tarea => (
              <TareaRow key={tarea.id} tarea={tarea} onClick={() => onClickTarea(tarea)} />
            ))}
          </div>
        )}
      </div>

      {/* Mis tareas completadas */}
      {(() => {
        const misCompletadasAll = misTareas.filter(t =>
          t.estado === 'completada' || t.estado === 'completada_con_atraso' || t.estado === 'no_completada'
        )
        if (misCompletadasAll.length === 0) return null
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <h2 className="text-white font-semibold">Mis tareas completadas</h2>
              <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
                {misCompletadasAll.length}
              </span>
            </div>
            <div className="space-y-3">
              {misCompletadasAll.map(tarea => (
                <TareaRow key={tarea.id} tarea={tarea} onClick={() => setTareaDetalle(tarea)} />
              ))}
            </div>
          </div>
        )
      })()}

      {tareaDetalle && <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />}

      {/* Avance del equipo */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="text-gray-400 font-medium text-sm">Avance del equipo</h2>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${pctEquipo === 100 ? 'bg-green-500' : pctEquipo > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pctEquipo}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completadasEquipo} de {totalEquipo} tareas completadas · {pctEquipo}%
        </p>
      </div>
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

  const tituloCiclo    = cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : ''
  const esCicloCerrado = cicloSeleccionado?.estado === 'cerrado'
  const esAdmin        = profile?.rol === 'admin'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
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
        {/* Fecha de hoy */}
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
          tareas={tareas}
          tituloCiclo={tituloCiclo}
          cicloSeleccionado={cicloSeleccionado}
          isLoading={isLoading}
          profile={profile}
          esCicloCerrado={esCicloCerrado}
        />
      ) : (
        <DashboardUsuario
          tareas={tareas}
          profile={profile}
          tituloCiclo={tituloCiclo}
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
