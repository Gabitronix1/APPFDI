import { useState, useMemo } from 'react'
import { TrendingUp, BarChart2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  const r     = 20
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ
  const color = pct === 100 ? '#22c55e' : pct >= 75 ? '#f59e0b' : pct >= 50 ? '#f97316' : '#ef4444'

  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#374151" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>
        {pct}%
      </text>
    </svg>
  )
}

export default function PanelRendimiento({ tareas, historial }) {
  const [tab, setTab] = useState('areas')

  // Agrupar tareas por área
  const kpisPorArea = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const mapa = {}
    for (const t of tareas) {
      if (!t.area) continue
      if (!mapa[t.area]) mapa[t.area] = {
        area: t.area,
        total: 0,
        completadas: 0,
        atrasadas: 0,
        pendientes: 0,
        pctCalidad: [],
      }
      const m = mapa[t.area]

      // Excluir bloqueadas del total
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
        pct: m.total ? Math.round((m.completadas / m.total) * 100) : 0,
        calidad: m.pctCalidad.length
          ? Math.round(m.pctCalidad.reduce((s, v) => s + v, 0) / m.pctCalidad.length)
          : null,
        color: COLORES_AREA[i % COLORES_AREA.length],
      }))
      .sort((a, b) => a.pct - b.pct)
  }, [tareas])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header con tabs */}
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

      {/* Tab KPIs por área */}
      {tab === 'areas' && (
        <div className="p-5">
          {kpisPorArea.length === 0 ? (
            <p className="text-center text-gray-600 py-8">Sin datos por área</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {kpisPorArea.map(kpi => (
                <div
                  key={kpi.area}
                  className={`rounded-xl border p-4 flex flex-col items-center gap-2 ${kpi.color}`}
                >
                  <p className="text-xs font-semibold text-center leading-tight">{kpi.area}</p>
                  <PctRing pct={kpi.pct} />
                  <div className="w-full space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="opacity-70">Completadas</span>
                      <span className="font-medium">{kpi.completadas}/{kpi.total}</span>
                    </div>
                    {kpi.calidad !== null && (
                      <div className="flex justify-between text-xs">
                        <span className="opacity-70">Calidad</span>
                        <span className="font-medium">{kpi.calidad}%</span>
                      </div>
                    )}
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
          )}
        </div>
      )}

      {/* Tab Tendencia */}
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
  )
}
