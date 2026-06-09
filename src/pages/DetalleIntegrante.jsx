import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  CheckCircle2, Clock, AlertCircle, ListChecks, TrendingUp,
  RefreshCw, Sparkles, CalendarClock, ChevronLeft, ChevronRight, Lock
} from 'lucide-react'
import { useState } from 'react'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function nombreCiclo(mes, anio) {
  return `${MESES[mes - 1]} ${anio}`
}

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
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

const ESTADO_STYLES = {
  pendiente:             { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  en_progreso:           { badge: 'bg-blue-800 text-blue-300',     label: 'En progreso' },
  completada:            { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Completada con atraso' },
  con_atraso:            { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
  fuera_de_plazo:        { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' },
}

function CondicionBadge({ condicion, frecuencia }) {
  if (frecuencia === 'semanal' || frecuencia === 'quincenal') return null
  if (condicion === 'habil')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-900/50 text-blue-300">Día hábil</span>
  if (condicion === 'dia_real')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-800 text-gray-500">Día cal.</span>
  return null
}

function TareaItem({ tarea, onClick, esCicloCerrado }) {
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
    : esCicloCerrado ? 'border-gray-800'
    : { ok: 'border-gray-800', por_vencer: 'border-amber-500', fuera_de_plazo: 'border-red-500' }[tarea.alerta] ?? 'border-gray-800'

  const pct = tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
    ? (tarea.porcentaje_cumplimiento ?? 100) : null

  const icono = tarea.tipo === 'cierre'
    ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
    : tarea.tipo === 'recurrente_mes'
    ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
    : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />

  return (
    <div
      onClick={estaBloqueada ? undefined : onClick}
      className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4 transition
        ${estaBloqueada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800'}`}
    >
      <div className="shrink-0">
        {estaBloqueada
          ? <Lock className="w-5 h-5 text-gray-600" />
          : tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : esFueraPlazo
          ? <AlertCircle className="w-5 h-5 text-orange-400" />
          : tarea.estado === 'con_atraso'
          ? <AlertCircle className="w-5 h-5 text-red-400" />
          : <Clock className="w-5 h-5 text-gray-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {icono}
          <p className={`font-medium truncate text-sm ${estaBloqueada ? 'text-gray-500' : 'text-white'}`}>
            {tarea.nombre_tarea}
          </p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          {tarea.area} ·{' '}
          {estaBloqueada
            ? <span className="text-gray-600">Disponible desde {tarea.fecha_inicio}</span>
            : <>Vence {tarea.fecha_termino}</>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tarea.total_evidencias > 0 && !estaBloqueada && (
          <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
        )}
        <CondicionBadge condicion={tarea.condicion} frecuencia={tarea.frecuencia} />
        {!estaBloqueada && (
          pct !== null
            ? <PctBadge pct={pct} />
            : <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>{estilos.label}</span>
        )}
      </div>
    </div>
  )
}

function GrupoTareas({ titulo, icono, iconoColor, tareas, onClickTarea, esCicloCerrado }) {
  const [abierto, setAbierto] = useState(true)
  if (tareas.length === 0) return null
  const ordenadas = [...tareas].sort((a, b) => a.nombre_tarea.localeCompare(b.nombre_tarea, 'es'))
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/40 transition"
      >
        <div className="flex items-center gap-2">
          <span className={iconoColor}>{icono}</span>
          <span className="text-white font-semibold text-sm">{titulo}</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{tareas.length}</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${abierto ? 'rotate-90' : ''}`} />
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-2">
          {ordenadas.map(tarea => (
            <TareaItem
              key={tarea.id}
              tarea={tarea}
              esCicloCerrado={esCicloCerrado}
              onClick={() => {
                const esCompletada = tarea.estado === 'completada' ||
                  tarea.estado === 'completada_con_atraso' ||
                  tarea.estado === 'no_completada'
                onClickTarea(tarea, esCompletada)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DetalleIntegrante({ cicloSeleccionado: cicloExterno }) {
  const { nombre }    = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const nombreDecoded = decodeURIComponent(nombre)

  const [tareaActiva,      setTareaActiva]      = useState(null)
  const [tareaDetalle,     setTareaDetalle]      = useState(null)

  const ciclo          = cicloExterno
  const esCicloCerrado = ciclo?.estado === 'cerrado'
  const tituloCiclo    = ciclo ? nombreCiclo(ciclo.mes, ciclo.anio)  : ''
  const tituloCierre   = ciclo ? nombreCierre(ciclo.mes, ciclo.anio) : ''

  const { data: perfil } = useQuery({
    queryKey: ['perfil-integrante', nombreDecoded],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, nombre, cargo, departamento, rol')
        .eq('nombre', nombreDecoded)
        .single()
      return data
    }
  })

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas-integrante', nombreDecoded, ciclo?.id],
    enabled: !!ciclo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', ciclo.id)
        .eq('responsable_nombre', nombreDecoded)
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  const { data: historial = [] } = useQuery({
    queryKey: ['historial-integrante', nombreDecoded],
    queryFn: async () => {
      const { data: ciclosHist } = await supabase
        .from('monthly_cycles')
        .select('id, mes, anio')
        .order('anio', { ascending: true })
        .order('mes',  { ascending: true })
        .limit(12)
      if (!ciclosHist?.length) return []
      const results = []
      for (const c of ciclosHist) {
        const { data: t } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('estado, porcentaje_cumplimiento')
          .eq('ciclo_id', c.id)
          .eq('responsable_nombre', nombreDecoded)
        if (!t?.length) continue
        const comp   = t.filter(x => x.estado === 'completada' || x.estado === 'completada_con_atraso').length
        const conPct = t.filter(x => x.porcentaje_cumplimiento !== null)
        results.push({
          mes: nombreCiclo(c.mes, c.anio),
          pct: Math.round((comp / t.length) * 100),
          completadas: comp,
          total: t.length,
          pctCalidad: conPct.length
            ? Math.round(conPct.reduce((s, x) => s + x.porcentaje_cumplimiento, 0) / conPct.length)
            : Math.round((comp / t.length) * 100)
        })
      }
      return results
    }
  })

  // Stats del ciclo
  const completadas = tareas.filter(t => t.estado === 'completada').length
  const atraso      = tareas.filter(t => t.estado === 'completada_con_atraso').length
  const pendientes  = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const atrasadas   = tareas.filter(t => t.estado === 'con_atraso').length
  const noComp      = tareas.filter(t => t.estado === 'no_completada').length
  const pct         = tareas.length ? Math.round(((completadas + atraso) / tareas.length) * 100) : 0

  const conPctArr  = tareas.filter(t => t.porcentaje_cumplimiento !== null)
  const pctCalidad = conPctArr.length
    ? Math.round(conPctArr.reduce((s, t) => s + t.porcentaje_cumplimiento, 0) / conPctArr.length)
    : null

  // Grupos
  const tareasCierre      = tareas.filter(t => t.tipo === 'cierre')
  const tareasRecurrentes = tareas.filter(t => t.tipo === 'recurrente_mes')
  const tareasPuntuales   = tareas.filter(t => t.tipo === 'puntual' || (!t.tipo && !t.template_id))

  // Tareas con dato de calidad
  const tareasConDato = tareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso' ||
    t.estado === 'no_completada' || t.estado === 'con_atraso'
  )

  function handleClickTarea(tarea, esCompletada) {
    if (esCompletada) setTareaDetalle(tarea)
    else setTareaActiva(tarea)
  }

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas-integrante', nombreDecoded, ciclo?.id] })
    setTareaActiva(null)
  }

  const colorPct = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
  const colorBarra = pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
  const iniciales  = nombreDecoded.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center shrink-0">
          <span className="text-blue-300 font-bold text-sm">{iniciales}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{nombreDecoded}</h1>
          <p className="text-gray-400 text-sm">
            {perfil?.cargo ?? '—'} · {perfil?.departamento ?? '—'}
          </p>
        </div>
      </div>

      {/* Resumen del ciclo */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-semibold">Avance — {tituloCiclo}</h2>
          <span className={`text-2xl font-bold ${colorPct}`}>{pct}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-2">
          <div className={`h-3 rounded-full transition-all duration-700 ${colorBarra}`}
            style={{ width: `${pct}%` }} />
        </div>
        {pctCalidad !== null && (
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mb-2">
            <div className="h-1.5 rounded-full transition-all duration-700 bg-yellow-500"
              style={{ width: `${pctCalidad}%` }} />
          </div>
        )}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-green-500 inline-block rounded" />
            <span className="text-xs text-gray-600">Cumplimiento</span>
          </div>
          {pctCalidad !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-yellow-500 inline-block rounded" />
              <span className="text-xs text-gray-600">Calidad: <span className="text-yellow-400">{pctCalidad}%</span></span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',       value: tareas.length,           color: 'text-gray-300',  icon: <ListChecks className="w-4 h-4" /> },
            { label: 'Completadas', value: completadas + atraso,    color: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'Pendientes',  value: pendientes,              color: 'text-amber-400', icon: <Clock className="w-4 h-4" /> },
            { label: 'Vencidas',    value: atrasadas + noComp,      color: 'text-red-400',   icon: <AlertCircle className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className="text-gray-500 text-xs">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tareas del ciclo */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Sin tareas para este ciclo</div>
      ) : (
        <div className="space-y-4 mb-6">
          <GrupoTareas
            titulo={tituloCierre}
            icono={<RefreshCw className="w-4 h-4" />}
            iconoColor="text-blue-400"
            tareas={tareasCierre}
            onClickTarea={handleClickTarea}
            esCicloCerrado={esCicloCerrado}
          />
          <GrupoTareas
            titulo={`Recurrentes de ${tituloCiclo}`}
            icono={<CalendarClock className="w-4 h-4" />}
            iconoColor="text-purple-400"
            tareas={tareasRecurrentes}
            onClickTarea={handleClickTarea}
            esCicloCerrado={esCicloCerrado}
          />
          <GrupoTareas
            titulo={`Puntuales de ${tituloCiclo}`}
            icono={<Sparkles className="w-4 h-4" />}
            iconoColor="text-amber-400"
            tareas={tareasPuntuales}
            onClickTarea={handleClickTarea}
            esCicloCerrado={esCicloCerrado}
          />
        </div>
      )}

      {/* Mi % de calidad */}
      {tareasConDato.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Detalle de calidad</h2>
            {pctCalidad !== null && <PctBadge pct={pctCalidad} />}
          </div>
          <div className="space-y-2">
            {tareasConDato.map(t => {
              const p = t.estado === 'completada' || t.estado === 'completada_con_atraso'
                ? (t.porcentaje_cumplimiento ?? 100) : 0
              return (
                <div key={t.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-gray-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.tipo === 'cierre'
                        ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                        : t.tipo === 'recurrente_mes'
                        ? <CalendarClock className="w-3 h-3 text-purple-400 shrink-0" />
                        : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                      <p className="text-gray-300 text-sm truncate">{t.nombre_tarea}</p>
                    </div>
                    <p className="text-gray-600 text-xs">{t.area}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {t.dias_atraso > 0 && (
                      <span className="text-xs text-gray-500">{t.dias_atraso}d atraso</span>
                    )}
                    <PctBadge pct={p} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tendencia histórica */}
      {historial.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-white font-semibold">Tendencia histórica</h2>
            <span className="text-xs text-gray-500 ml-1">— últimos {historial.length} meses</span>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-green-500 inline-block" />
                <span className="text-xs text-gray-500">Cumplimiento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-yellow-500 inline-block" />
                <span className="text-xs text-gray-500">Calidad</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historial} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`} />
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
                dot={{ fill: '#22C55E', r: 4 }} activeDot={{ r: 6, fill: '#16A34A' }} name="Cumplimiento" />
              <Line type="monotone" dataKey="pctCalidad" stroke="#EAB308" strokeWidth={2}
                strokeDasharray="4 4" dot={{ fill: '#EAB308', r: 3 }} activeDot={{ r: 5, fill: '#CA8A04' }}
                name="Calidad" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modales */}
      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={onCompletada}
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
