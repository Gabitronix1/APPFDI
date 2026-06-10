import { useState, useMemo } from 'react'
import { TrendingUp, BarChart2, X, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const COLORES_AREA = [
  'bg-blue-900/50 border-blue-700 text-blue-300',
  'bg-purple-900/50 border-purple-700 text-purple-300',
  'bg-green-900/50 border-green-700 text-green-300',
  'bg-amber-900/50 border-amber-700 text-amber-300',
  'bg-red-900/50 border-red-700 text-red-300',
  'bg-cyan-900/50 border-cyan-700 text-cyan-300',
  'bg-pink-900/50 border-pink-700 text-pink-300',
  'bg-orange-900/50 border-orange-700 text-orange-300',
]

function PctRing({ pct, size = 56 }) {
  const r    = 20
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct === 100 ? '#22c55e' : pct >= 75 ? '#f59e0b' : pct >= 50 ? '#f97316' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#374151" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>
        {pct}%
      </text>
    </svg>
  )
}

function ModalHistorialArea({ area, departamento, onClose }) {
  const { data: tareasHistorial = [], isLoading } = useQuery({
    queryKey: ['historial-area', area, departamento],
    queryFn: async () => {
      const { data: ciclos } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .order('anio', { ascending: false })
        .order('mes',  { ascending: false })
        .limit(24)
      if (!ciclos?.length) return []

      const results = []
      for (const c of ciclos) {
        const { data: tareas } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('nombre_tarea, estado, porcentaje_cumplimiento, responsable_nombre, fecha_termino')
          .eq('ciclo_id', c.id)
          .eq('area', area)
          .eq('departamento', departamento)
        if (!tareas?.length) continue
        const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
        const conPct = tareas.filter(t => t.porcentaje_cumplimiento !== null)
        results.push({
          mes:         `${MESES[c.mes - 1]} ${c.anio}`,
          mesNum:      c.mes,
          anio:        c.anio,
          pct:         Math.round((completadas / tareas.length) * 100),
          calidad:     conPct.length ? Math.round(conPct.reduce((s, t) => s + t.porcentaje_cumplimiento, 0) / conPct.length) : null,
          completadas,
          total:       tareas.length,
          tareas,
        })
      }
      return results.reverse()
    }
  })

  const grafico = tareasHistorial.map(h => ({
    mes:     h.mes,
    pct:     h.pct,
    calidad: h.calidad ?? h.pct,
    completadas: h.completadas,
    total:   h.total,
  }))

  const todasLasTareas = tareasHistorial.flatMap(h =>
    h.tareas.map(t => ({ ...t, mesLabel: h.mes }))
  ).reverse()

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-semibold">{area}</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {tareasHistorial.length} meses
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 scroll-dark">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Gráfico histórico */}
              {grafico.length > 1 && (
                <div className="px-6 py-5 border-b border-gray-800">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-green-500 inline-block rounded" />
                      <span className="text-xs text-gray-500">Cumplimiento</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-yellow-500 inline-block rounded" />
                      <span className="text-xs text-gray-500">Calidad</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={grafico} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload?.length) {
                            return (
                              <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
                                <p className="text-gray-400 text-xs mb-2">{label}</p>
                                {payload.map((p, i) => (
                                  <div key={i} className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                                    <span className="text-gray-400 text-xs">{p.name}:</span>
                                    <span className="text-white font-bold text-sm">{p.value}%</span>
                                  </div>
                                ))}
                                <p className="text-gray-600 text-xs mt-1 border-t border-gray-700 pt-1">
                                  {payload[0]?.payload.completadas}/{payload[0]?.payload.total} tareas
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Line type="monotone" dataKey="pct" stroke="#22C55E" strokeWidth={2}
                        dot={{ fill: '#22C55E', r: 3 }} activeDot={{ r: 5 }} name="Cumplimiento" />
                      <Line type="monotone" dataKey="calidad" stroke="#EAB308" strokeWidth={2}
                        strokeDasharray="4 4" dot={{ fill: '#EAB308', r: 3 }} activeDot={{ r: 5 }} name="Calidad" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Historial de tareas */}
              <div className="px-6 py-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  Historial de completaciones
                </p>
                <div className="space-y-2">
                  {todasLasTareas.map((t, i) => {
                    const esCompletada = t.estado === 'completada' || t.estado === 'completada_con_atraso'
                    const esAtrasada   = t.estado === 'con_atraso' || t.estado === 'no_completada'
                    const pct = esCompletada ? (t.porcentaje_cumplimiento ?? 100) : null

                    return (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
                        <div className="shrink-0">
                          {esCompletada
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : esAtrasada
                            ? <AlertCircle className="w-4 h-4 text-red-400" />
                            : <Clock className="w-4 h-4 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{t.nombre_tarea}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{t.mesLabel}</span>
                            <span className="text-xs text-gray-600">·</span>
                            <span className="text-xs text-gray-500">{t.responsable_nombre}</span>
                          </div>
                        </div>
                        {pct !== null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            pct === 100 ? 'bg-green-900 text-green-300'
                            : pct >= 80  ? 'bg-amber-900 text-amber-300'
                            : 'bg-red-900 text-red-300'
                          }`}>{pct}%</span>
                        )}
                        {!esCompletada && (
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            esAtrasada ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-500'
                          }`}>
                            {esAtrasada ? 'No completada' : 'Pendiente'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PanelRendimiento({ tareas, historial, departamento }) {
  const [tab,          setTab]          = useState('areas')
  const [areaSeleccionada, setAreaSeleccionada] = useState(null)

  const kpisPorArea = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const mapa = {}
    for (const t of tareas) {
      if (!t.area) continue
      if (!mapa[t.area]) mapa[t.area] = {
        area: t.area, total: 0, completadas: 0, atrasadas: 0, pendientes: 0, pctCalidad: [],
      }
      const m = mapa[t.area]
      const estaBloqueada = t.serie_id && t.fecha_inicio &&
        new Date(t.fecha_inicio + 'T00:00:00') > hoy
      if (estaBloqueada) continue
      m.total++
      if (t.estado === 'completada' || t.estado === 'completada_con_atraso') {
        m.completadas++
        if (t.porcentaje_cumplimiento !== null) m.pctCalidad.push(t.porcentaje_cumplimiento)
      }
      if (t.estado === 'con_atraso' || t.alerta === 'fuera_de_plazo') m.atrasadas++
      if (t.estado === 'pendiente' || t.estado === 'en_progreso') m.pendientes++
    }

    return Object.values(mapa)
      .filter(m => m.total > 0)
      .map((m, i) => ({
        ...m,
        pct:     m.total ? Math.round((m.completadas / m.total) * 100) : 0,
        calidad: m.pctCalidad.length
          ? Math.round(m.pctCalidad.reduce((s, v) => s + v, 0) / m.pctCalidad.length)
          : null,
        color: COLORES_AREA[i % COLORES_AREA.length],
      }))
      .sort((a, b) => a.pct - b.pct)
  }, [tareas])

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-white font-semibold">Panel de rendimiento</h2>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTab('areas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition
                ${tab === 'areas' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              KPIs por área
            </button>
            <button
              onClick={() => setTab('tendencia')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition
                ${tab === 'tendencia' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Tendencia
            </button>
          </div>
        </div>

        {/* KPIs por área */}
        {tab === 'areas' && (
          <div className="p-5">
            {kpisPorArea.length === 0 ? (
              <p className="text-center text-gray-600 py-8">Sin datos por área</p>
            ) : (
              <>
                <p className="text-xs text-gray-600 mb-3">Click en un área para ver su historial</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {kpisPorArea.map(kpi => (
                    <div
                      key={kpi.area}
                      onClick={() => setAreaSeleccionada(kpi.area)}
                      className={`rounded-xl border p-4 flex flex-col items-center gap-2 cursor-pointer
                        hover:brightness-125 transition-all duration-150 hover:scale-[1.02] ${kpi.color}`}
                    >
                      <p className="text-xs font-semibold text-center leading-tight">{kpi.area}</p>
                      <div className="flex flex-col items-center gap-0.5">
                        <PctRing pct={kpi.calidad ?? kpi.pct} />
                        <p className="text-xs opacity-60 leading-none">
                          {kpi.calidad !== null ? 'Calidad' : 'Cumplimiento'}
                        </p>
                      </div>
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="opacity-70">Completadas</span>
                          <span className="font-medium">{kpi.completadas}/{kpi.total}</span>
                        </div>
                        {kpi.atrasadas > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="opacity-70">Atrasadas</span>
                            <span className="font-medium text-red-300">{kpi.atrasadas}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tendencia */}
        {tab === 'tendencia' && (
          <div className="p-6">
            {historial.length <= 1 ? (
              <p className="text-center text-gray-600 py-8">Sin historial suficiente</p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4 ml-auto w-fit">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-green-500 inline-block" />
                    <span className="text-xs text-gray-500">Tareas completadas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-yellow-500 inline-block" />
                    <span className="text-xs text-gray-500">Calidad promedio</span>
                  </div>
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
                              <p className="text-gray-400 text-xs mb-2">{label}</p>
                              {payload.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                                  <span className="text-gray-400 text-xs">{p.name}:</span>
                                  <span className="text-white font-bold text-sm">{p.value}%</span>
                                </div>
                              ))}
                              <p className="text-gray-600 text-xs mt-1 border-t border-gray-700 pt-1">
                                {payload[0]?.payload.completadas}/{payload[0]?.payload.total} tareas
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#22C55E" strokeWidth={2}
                      dot={{ fill: '#22C55E', r: 4 }} activeDot={{ r: 6, fill: '#16A34A' }} name="% Completadas" />
                    <Line type="monotone" dataKey="pctPromedio" stroke="#EAB308" strokeWidth={2}
                      strokeDasharray="4 4" dot={{ fill: '#EAB308', r: 3 }} activeDot={{ r: 5, fill: '#CA8A04' }}
                      name="Calidad promedio" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal historial área */}
      {areaSeleccionada && (
        <ModalHistorialArea
          area={areaSeleccionada}
          departamento={departamento}
          onClose={() => setAreaSeleccionada(null)}
        />
      )}
    </>
  )
}
