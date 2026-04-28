import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { CheckCircle2, Clock, AlertCircle, ListChecks, TrendingUp, User, Users, ChevronDown, ChevronUp, RefreshCw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import TaskModal from '../components/TaskModal'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DetalleTareaPanel from '../components/DetalleTareaPanel'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

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

function BarraProgreso({ label, completadas, total }) {
  const pct = total ? Math.round((completadas / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-gray-300 truncate">{label}</span>
        <span className={`text-xs font-bold ml-2 shrink-0 ${pct === 100 ? 'text-green-400' : pct > 50 ? 'text-amber-400' : 'text-red-400'}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 mt-1">{completadas} de {total} tareas</p>
    </div>
  )
}

function TareaRow({ tarea, onClick }) {
  const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
  const borderColor  = {
    ok:             'border-gray-800',
    por_vencer:     'border-amber-500',
    fuera_de_plazo: 'border-red-500',
  }[tarea.alerta] ?? 'border-gray-800'

  const badge = esFueraPlazo
    ? 'bg-orange-900 text-orange-300'
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
      className={`bg-gray-900 border ${borderColor} rounded-xl p-4 flex items-center justify-between gap-4 transition ${onClick ? 'cursor-pointer hover:bg-gray-800' : 'hover:bg-gray-800/50'}`}
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

// Badge de porcentaje con color según valor
function PctBadge({ pct }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">—</span>
  }
  const color = pct === 100
    ? 'bg-green-900 text-green-300'
    : pct >= 80
    ? 'bg-amber-900 text-amber-300'
    : pct >= 50
    ? 'bg-orange-900 text-orange-300'
    : 'bg-red-900 text-red-300'
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
      {pct}%
    </span>
  )
}

function TablaResponsabilidad({ tareas }) {
  // Agrupar tareas por responsable
  const porResponsable = tareas.reduce((acc, t) => {
    const nombre = t.responsable_nombre ?? 'Sin asignar'
    if (!acc[nombre]) acc[nombre] = []
    acc[nombre].push(t)
    return acc
  }, {})

  function getPct(tarea) {
    if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso') {
      return tarea.porcentaje_cumplimiento ?? 100
    }
    if (tarea.estado === 'no_completada') return 0
    if (tarea.estado === 'con_atraso')    return 0
    return null
  }

  function getBarColor(pct) {
    if (pct === null) return 'bg-gray-700'
    if (pct === 100)  return 'bg-green-500'
    if (pct >= 80)    return 'bg-amber-500'
    if (pct >= 50)    return 'bg-orange-500'
    return 'bg-red-500'
  }

  function getTextColor(pct) {
    if (pct === null) return 'text-gray-600'
    if (pct === 100)  return 'text-green-400'
    if (pct >= 80)    return 'text-amber-400'
    if (pct >= 50)    return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-400" />
        <h2 className="text-white font-semibold">% de responsabilidad por tarea</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(porResponsable)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([nombre, tareasPer]) => {
            const conDato  = tareasPer.filter(t => getPct(t) !== null)
            const promedio = conDato.length
              ? Math.round(conDato.reduce((s, t) => s + getPct(t), 0) / conDato.length)
              : null

            return (
              <div key={nombre} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Header tarjeta */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center shrink-0">
                      <span className="text-green-300 text-sm font-bold">
                        {nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{nombre}</p>
                      <p className="text-gray-500 text-xs">{tareasPer.length} tareas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getTextColor(promedio)}`}>
                      {promedio !== null ? `${promedio}%` : '—'}
                    </p>
                    <p className="text-gray-600 text-xs">promedio</p>
                  </div>
                </div>

                {/* Lista de tareas */}
                <div className="px-5 py-3 space-y-3">
                  {tareasPer
                    .sort((a, b) => {
                      const pA = getPct(a)
                      const pB = getPct(b)
                      if (pA === null && pB === null) return 0
                      if (pA === null) return 1
                      if (pB === null) return -1
                      return pA - pB
                    })
                    .map(tarea => {
                      const pct = getPct(tarea)
                      return (
                        <div key={tarea.id}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {tarea.template_id
                                ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                                : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                            <p className="text-gray-300 text-xs truncate" title={tarea.nombre_tarea}>
                                {tarea.nombre_tarea}
                            </p>
                        </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {tarea.dias_atraso > 0 && (
                                <span className="text-xs text-gray-600">
                                  +{tarea.dias_atraso}d
                                </span>
                              )}
                              <span className={`text-xs font-bold w-10 text-right ${getTextColor(pct)}`}>
                                {pct !== null ? `${pct}%` : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-700 ${getBarColor(pct)}`}
                              style={{ width: pct !== null ? `${pct}%` : '0%' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>

                {/* Footer con leyenda rápida */}
                {conDato.length < tareasPer.length && (
                  <div className="px-5 py-2 border-t border-gray-800/50">
                    <p className="text-xs text-gray-600">
                      {tareasPer.length - conDato.length} tarea{tareasPer.length - conDato.length > 1 ? 's' : ''} pendiente{tareasPer.length - conDato.length > 1 ? 's' : ''} sin resultado aún
                    </p>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">100% — A tiempo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-500">80-90% — Leve atraso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-xs text-gray-500">50-70% — Atraso moderado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500">0% — No completada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-700" />
          <span className="text-xs text-gray-500">— Pendiente</span>
        </div>
      </div>
    </div>
  )
}
function ModalListaTareas({ titulo, tareas, onClose, onClickTarea }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{titulo}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Lista */}
        <div className="overflow-y-auto p-4 space-y-2">
          {tareas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin tareas</p>
          ) : tareas.map(tarea => {
            const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
            const borde = {
              ok:             'border-gray-800',
              por_vencer:     'border-amber-500',
              fuera_de_plazo: 'border-red-500',
            }[tarea.alerta] ?? 'border-gray-800'
            return (
              <div
                key={tarea.id}
                onClick={() => { onClose(); onClickTarea(tarea) }}
                className={`bg-gray-800 border ${borde} rounded-xl p-3 flex items-center gap-3
                  cursor-pointer hover:bg-gray-700 transition`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {tarea.template_id
                      ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                      : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                    <p className="text-white text-sm font-medium truncate">{tarea.nombre_tarea}</p>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {tarea.responsable_nombre} · {tarea.area}
                  </p>
                </div>
                {(tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso') && (
                  <PctBadge pct={tarea.porcentaje_cumplimiento ?? 100} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ─── DASHBOARD ADMIN ──────────────────────────────────────────────────────────
function DashboardAdmin({ tareas, tituloCiclo, isLoading, profile }) {
  const [modalFiltro, setModalFiltro]     = useState(null) // 'completadas' | 'atraso' | 'sinCompletar'
  const [tareaDetalle, setTareaDetalle]   = useState(null)
  const [tareaActiva, setTareaActiva]     = useState(null)
  const queryClient = useQueryClient()
  const completadas   = tareas.filter(t => t.estado === 'completada').length
  const conAtraso     = tareas.filter(t => t.estado === 'completada_con_atraso').length
  const pendientes    = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const atrasadas     = tareas.filter(t => t.estado === 'con_atraso').length
  const noCompletadas = tareas.filter(t => t.estado === 'no_completada').length
  const pctAvance     = tareas.length
    ? Math.round(((completadas + conAtraso) / tareas.length) * 100)
    : 0

  const porResponsable = tareas.reduce((acc, t) => {
    const nombre = t.responsable_nombre ?? 'Sin asignar'
    if (!acc[nombre]) acc[nombre] = { total: 0, completadas: 0, atrasadas: 0, fueraPlazo: 0 }
    acc[nombre].total++
    if (t.estado === 'completada' || t.estado === 'completada_con_atraso') acc[nombre].completadas++
    if (t.estado === 'con_atraso') acc[nombre].atrasadas++
    if (t.alerta === 'fuera_de_plazo' && t.estado !== 'completada') acc[nombre].fueraPlazo++
    return acc
  }, {})

  const porArea = tareas.reduce((acc, t) => {
    const area = t.area ?? 'Sin área'
    if (!acc[area]) acc[area] = { total: 0, completadas: 0 }
    acc[area].total++
    if (t.estado === 'completada' || t.estado === 'completada_con_atraso') acc[area].completadas++
    return acc
  }, {})

  // Historial de cumplimiento mensual
  const { data: historial = [] } = useQuery({
    queryKey: ['historial-admin', profile?.departamento],
    queryFn: async () => {
      const { data: ciclosHist } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .order('anio', { ascending: true })
        .order('mes', { ascending: true })

      if (!ciclosHist?.length) return []

      const results = []
      for (const c of ciclosHist) {
        const { data: tareasHist } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado')
          .eq('ciclo_id', c.id)
          .eq('departamento', profile?.departamento)

        if (!tareasHist?.length) continue

        const completadas = tareasHist.filter(t =>
          t.estado === 'completada' || t.estado === 'completada_con_atraso'
        ).length
        const pct = Math.round((completadas / tareasHist.length) * 100)

        results.push({
          mes: `${MESES[c.mes - 1].slice(0, 3)} ${c.anio}`,
          pct,
          completadas,
          total: tareasHist.length,
        })
      }
      return results
    }
  })
  console.log('historial:', historial)
  console.log('profile departamento:', profile?.departamento)

  return (
    <div className="space-y-8">

      {/* Barra progreso global */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-white font-semibold">Avance general del equipo</h2>
            <p className="text-gray-500 text-sm mt-0.5">{tituloCiclo}</p>
          </div>
          <span className={`text-3xl font-bold ${pctAvance === 100 ? 'text-green-400' : pctAvance > 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {pctAvance}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${pctAvance === 100 ? 'bg-green-500' : pctAvance > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pctAvance}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completadas + conAtraso} de {tareas.length} tareas completadas
          {conAtraso > 0 && <span className="text-yellow-600 ml-2">({conAtraso} con atraso)</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ListChecks}   label="Total tareas"  value={tareas.length}  color="bg-blue-700"   sub="este mes" />
        <StatCard
          icon={CheckCircle2} label="Completadas" value={completadas} color="bg-green-700" sub="En fecha"
          onClick={() => setModalFiltro('completadas')}
        />
        <StatCard
          icon={Clock} label="Con atraso" value={conAtraso} color="bg-yellow-700" sub="Completadas tarde"
          onClick={() => setModalFiltro('atraso')}
        />
         <StatCard
          icon={AlertCircle} label="Sin completar" value={atrasadas + noCompletadas + pendientes} color="bg-red-700"
          sub={`${pendientes} pend. · ${atrasadas + noCompletadas} vencidas`}
          onClick={() => setModalFiltro('sinCompletar')}
        />
        </div>

      {/* Gráfico tendencia mensual */}
      {historial.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-white font-semibold">Tendencia de cumplimiento</h2>
            <span className="text-xs text-gray-500 ml-1">— últimos {historial.length} meses</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historial} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="mes"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
                        <p className="text-gray-400 text-xs mb-1">{label}</p>
                        <p className="text-white font-bold text-lg">{payload[0].value}%</p>
                        <p className="text-gray-500 text-xs">
                          {payload[0].payload.completadas}/{payload[0].payload.total} tareas
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#22C55E"
                strokeWidth={2}
                dot={{ fill: '#22C55E', r: 4 }}
                activeDot={{ r: 6, fill: '#16A34A' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cumplimiento por integrante */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Users className="w-5 h-5 text-green-400" />
          <h2 className="text-white font-semibold">Cumplimiento por integrante</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(porResponsable)
              .sort((a, b) => {
                const pctA = a[1].total ? (a[1].completadas / a[1].total) : 0
                const pctB = b[1].total ? (b[1].completadas / b[1].total) : 0
                return pctB - pctA
              })
              .map(([nombre, stats]) => (
                <div key={nombre}>
                  <BarraProgreso
                    label={nombre}
                    completadas={stats.completadas}
                    total={stats.total}
                  />
                  {(stats.atrasadas > 0 || stats.fueraPlazo > 0) && (
                    <div className="flex gap-3 mt-1.5">
                      {stats.atrasadas > 0 && (
                        <span className="text-xs text-red-400">⚠ {stats.atrasadas} atrasada{stats.atrasadas > 1 ? 's' : ''}</span>
                      )}
                      {stats.fueraPlazo > 0 && (
                        <span className="text-xs text-orange-400">⚠ {stats.fueraPlazo} fuera de plazo</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* TABLA DE RESPONSABILIDAD POR TAREA */}
      <TablaResponsabilidad tareas={tareas} />

{/* Avance por área */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h2 className="text-white font-semibold">Avance por área</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Object.entries(porArea)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([area, stats]) => (
              <BarraProgreso
                key={area}
                label={area}
                completadas={stats.completadas}
                total={stats.total}
              />
            ))}
        </div>
      </div>

      {/* Mis tareas pendientes — solo si el admin tiene tareas asignadas */}
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
               <TareaRow key={tarea.id} tarea={tarea} onClick={() => setTareaActiva(tarea)} />
              ))}
            </div>
          </div>
        )
      })()}
{/* Modal lista tareas filtradas */}
      {modalFiltro && (
        <ModalListaTareas
          titulo={
            modalFiltro === 'completadas'  ? `Completadas en fecha (${completadas})`
            : modalFiltro === 'atraso'     ? `Completadas con atraso (${conAtraso})`
            : `Sin completar (${atrasadas + noCompletadas + pendientes})`
          }
          tareas={tareas.filter(t =>
            modalFiltro === 'completadas'  ? t.estado === 'completada'
            : modalFiltro === 'atraso'     ? t.estado === 'completada_con_atraso'
            : ['con_atraso','no_completada','pendiente','en_progreso'].includes(t.estado)
          )}
          onClose={() => setModalFiltro(null)}
          onClickTarea={tarea => {
            if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada') {
              setTareaDetalle(tarea)
            } else {
              setTareaActiva(tarea)
            }
          }}
        />
      )}

      {/* Panel detalle */}
      {tareaDetalle && (
        <DetalleTareaPanel
          tarea={tareaDetalle}
          onClose={() => setTareaDetalle(null)}
        />
      )}

      {/* Modal completar */}
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
  const misTareas             = tareas.filter(t => t.responsable_nombre === profile?.nombre)
  const misCompletadas        = misTareas.filter(t => t.estado === 'completada').length
  const misCompletadasAtraso  = misTareas.filter(t => t.estado === 'completada_con_atraso').length
  const misPendientes         = misTareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const misAtrasadas          = misTareas.filter(t => t.estado === 'con_atraso').length
  const miPct                 = misTareas.length
    ? Math.round(((misCompletadas + misCompletadasAtraso) / misTareas.length) * 100)
    : 0

  const misPendientesActivas  = misTareas.filter(t =>
    t.estado !== 'completada' && t.estado !== 'completada_con_atraso' && t.estado !== 'no_completada'
  )

  const totalEquipo           = tareas.length
  const completadasEquipo     = tareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso'
  ).length
  const pctEquipo             = totalEquipo ? Math.round((completadasEquipo / totalEquipo) * 100) : 0

  // Calcular mi promedio de responsabilidad real
  const tareasConDato = misTareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso' || t.estado === 'no_completada' || t.estado === 'con_atraso'
  )
  const miPromedioResponsabilidad = tareasConDato.length
    ? Math.round(tareasConDato.reduce((s, t) => {
        if (t.estado === 'completada' || t.estado === 'completada_con_atraso') return s + (t.porcentaje_cumplimiento ?? 100)
        return s
      }, 0) / tareasConDato.length)
    : null

  return (
    <div className="space-y-8">

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
        <StatCard icon={ListChecks}   label="Mis tareas"          value={misTareas.length}                    color="bg-blue-700"   sub="este mes" />
        <StatCard icon={CheckCircle2} label="Completadas"         value={misCompletadas + misCompletadasAtraso} color="bg-green-700"  sub={`${miPct}% del total`} />
        <StatCard icon={Clock}        label="Pendientes"          value={misPendientes}                       color="bg-amber-600"  sub="Por completar" />
        <StatCard icon={AlertCircle}  label="Sin completar"       value={misAtrasadas}                        color="bg-red-700"    sub="Vencidas" />
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
              <p className="text-gray-500 text-sm">
                Promedio calculado sobre tareas con resultado en {tituloCiclo}
              </p>
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

          {/* Detalle por tarea */}
          <div className="mt-5 space-y-2">
            {tareasConDato.map(t => {
              const pct = t.estado === 'completada' || t.estado === 'completada_con_atraso'
                ? (t.porcentaje_cumplimiento ?? 100)
                : 0
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
                    {t.dias_atraso > 0 && (
                      <span className="text-xs text-gray-500">{t.dias_atraso}d atraso</span>
                    )}
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

      {/* Mis tareas completadas — clickeables para ver historial */}
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
          <TareaRow
            key={tarea.id}
            tarea={tarea}
            onClick={() => setTareaDetalle(tarea)}
          />
        ))}
      </div>
    </div>
  )
})()}

{/* Panel detalle usuario */}
{tareaDetalle && (
  <DetalleTareaPanel
    tarea={tareaDetalle}
    onClose={() => setTareaDetalle(null)}
  />
)}
      {/* Referencia del equipo */}
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


export default function Dashboard({ cicloSeleccionado }) {
  const { profile } = useAuth()

  console.log('cicloSeleccionado:', cicloSeleccionado?.id)
  console.log('profile:', profile)
  console.log('enabled:', !!cicloSeleccionado?.id && !!profile?.departamento)

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

  const tituloCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  const esAdmin = profile?.rol === 'admin'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-8 bg-green-500 rounded-full" />
          <h1 className="text-2xl font-bold text-white">
            Hola, {profile?.nombre?.split(' ')[0]} 👋
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-5">
          {esAdmin ? 'Vista de administrador' : 'Vista personal'} · {tituloCiclo}
          {cicloSeleccionado?.estado === 'cerrado' && (
            <span className="ml-2 text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
              ciclo cerrado
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : esAdmin ? (
        <DashboardAdmin
          tareas={tareas}
          tituloCiclo={tituloCiclo}
          isLoading={isLoading}
          profile={profile}
        />
      ) : (
        <DashboardUsuario
          tareas={tareas}
          profile={profile}
          tituloCiclo={tituloCiclo}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
