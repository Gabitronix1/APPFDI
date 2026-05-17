import { useState, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProyectoCard from '../components/ProyectoCard'
import ProyectoModal from '../components/ProyectoModal'
import { Plus, FolderKanban, Camera, ChevronDown, ChevronUp, TrendingUp, Trash2 } from 'lucide-react'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Factor de prioridad ───────────────────────────────────────────────────────
export const FACTOR_PRIORIDAD = { alta: 3, media: 2, baja: 1 }

export function factorP(prioridad) {
  return FACTOR_PRIORIDAD[prioridad] ?? 1
}

function calcularPctPlan(fechaInicio, fechaFin) {
  const hoy    = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin    = new Date(fechaFin    + 'T00:00:00')
  if (hoy < inicio) return 0
  if (hoy > fin)    return 100
  const total  = fin.getTime() - inicio.getTime()
  const pasado = hoy.getTime() - inicio.getTime()
  return Math.round((pasado / total) * 100)
}

// Ponderación por días × factor de prioridad del entregable
export function calcularPonderado(entregables, campo) {
  const totalPeso = entregables.reduce((s, d) =>
    s + (d.duracion_dias || 1) * factorP(d.prioridad), 0)
  if (totalPeso === 0) return 0
  const suma = entregables.reduce((s, d) => {
    const valor = campo === 'pct_plan'
      ? calcularPctPlan(d.fecha_inicio, d.fecha_fin)
      : (Number(d.pct_real) || 0)
    return s + valor * (d.duracion_dias || 1) * factorP(d.prioridad)
  }, 0)
  return Math.round(suma / totalPeso)
}

// Ponderación global por proyectos — días × prioridad entregable × prioridad proyecto
export function calcularPonderadoGlobal(proyectos, campo) {
  const totalPeso = proyectos.reduce((s, p) => {
    const fp = factorP(p.prioridad)
    return s + (p.project_deliverables ?? []).reduce((sd, d) =>
      sd + (d.duracion_dias || 1) * factorP(d.prioridad) * fp, 0)
  }, 0)
  if (totalPeso === 0) return 0
  const suma = proyectos.reduce((s, p) => {
    const fp = factorP(p.prioridad)
    return s + (p.project_deliverables ?? []).reduce((sd, d) => {
      const valor = campo === 'pct_plan'
        ? calcularPctPlan(d.fecha_inicio, d.fecha_fin)
        : (Number(d.pct_real) || 0)
      return sd + valor * (d.duracion_dias || 1) * factorP(d.prioridad) * fp
    }, 0)
  }, 0)
  return Math.round(suma / totalPeso)
}

// ─── BADGE PRIORIDAD ──────────────────────────────────────────────────────────
export function BadgePrioridad({ prioridad, size = 'sm' }) {
  const cfg = {
    alta:  { label: '↑ Alta',  cls: 'bg-red-900/50 text-red-300 border-red-800'       },
    media: { label: '→ Media', cls: 'bg-amber-900/50 text-amber-300 border-amber-800'  },
    baja:  { label: '↓ Baja',  cls: 'bg-gray-800 text-gray-400 border-gray-700'        },
  }
  const { label, cls } = cfg[prioridad] ?? cfg.media
  return (
    <span className={`inline-flex items-center border rounded-full font-medium
      ${size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}
      ${cls}`}>
      {label}
    </span>
  )
}

// ─── RING SVG ─────────────────────────────────────────────────────────────────
function Ring({ pct, color, size = 56 }) {
  const r      = 22
  const circum = 2 * Math.PI * r
  const offset = circum - (pct / 100) * circum
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 56 56"
        style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="28" cy="28" r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circum}
          strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, color,
      }}>
        {pct}%
      </div>
    </div>
  )
}

// ─── HISTORIAL PROYECTO ───────────────────────────────────────────────────────
function HistorialProyecto({ proyectoId, isAdmin }) {
  const queryClient = useQueryClient()
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [eliminando,    setEliminando]    = useState(false)

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['snapshots', proyectoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_snapshots')
        .select(`
          *,
          project_deliverable_snapshots(*)
        `)
        .eq('project_id', proyectoId)
        .order('anio', { ascending: true })
        .order('mes',  { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  async function eliminarSnapshot(snapId) {
    setEliminando(true)
    const { error } = await supabase
      .from('project_snapshots')
      .delete()
      .eq('id', snapId)
    setEliminando(false)
    setConfirmandoId(null)
    if (!error) queryClient.invalidateQueries({ queryKey: ['snapshots', proyectoId] })
  }

  if (isLoading) return (
    <div className="px-5 py-4 text-center">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  if (snapshots.length === 0) return (
    <div className="px-5 py-6 text-center">
      <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
      <p className="text-gray-600 text-sm">Sin historial aún</p>
      <p className="text-gray-700 text-xs mt-1">Guarda un snapshot para comenzar la trazabilidad</p>
    </div>
  )

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs text-gray-400 font-medium uppercase tracking-widest">Historial de avance</span>
      </div>

      {/* Línea de tiempo */}
      <div className="space-y-3">
        {snapshots.map((snap, i) => {
          const colorReal = snap.pct_real === 100 ? 'text-green-400'
            : snap.pct_real >= snap.pct_plan ? 'text-blue-400'
            : snap.pct_real > 0 ? 'text-amber-400'
            : 'text-gray-500'
          const colorBarraReal = snap.pct_real === 100 ? 'bg-green-500'
            : snap.pct_real >= snap.pct_plan ? 'bg-blue-500'
            : snap.pct_real > 0 ? 'bg-amber-500'
            : 'bg-gray-700'
          const colorCumpl = snap.cumplimiento === null ? 'text-gray-500'
            : snap.cumplimiento >= 100 ? 'text-green-400'
            : snap.cumplimiento >= 75  ? 'text-amber-400'
            : 'text-red-400'

          // Delta vs snapshot anterior
          const prev      = i > 0 ? snapshots[i - 1] : null
          const deltaReal = prev ? Math.round(snap.pct_real - prev.pct_real) : null

          return (
            <div key={snap.id} className="bg-gray-800/50 rounded-xl px-4 py-3">
              {/* Confirmación inline */}
              {confirmandoId === snap.id ? (
                <div className="flex items-center justify-between mb-2 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-300">¿Eliminar este snapshot?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmandoId(null)}
                      className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded"
                    >Cancelar</button>
                    <button
                      onClick={() => eliminarSnapshot(snap.id)}
                      disabled={eliminando}
                      className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-0.5 rounded"
                    >{eliminando ? '…' : 'Eliminar'}</button>
                  </div>
                </div>
              ) : null}

              {/* Header fila */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    {MESES_CORTO[(snap.mes ?? 1) - 1]} {snap.anio}
                  </span>
                  {deltaReal !== null && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      deltaReal > 0 ? 'bg-green-900/50 text-green-400'
                      : deltaReal < 0 ? 'bg-red-900/50 text-red-400'
                      : 'bg-gray-800 text-gray-500'
                    }`}>
                      {deltaReal > 0 ? `+${deltaReal}%` : deltaReal < 0 ? `${deltaReal}%` : '='}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${colorReal}`}>{Math.round(snap.pct_real)}%</span>
                  <span className="text-gray-700 text-xs">/</span>
                  <span className="text-sm text-gray-500">{Math.round(snap.pct_plan)}%</span>
                  {snap.cumplimiento !== null && (
                    <>
                      <span className="w-px h-3 bg-gray-700" />
                      <span className={`text-xs font-semibold ${colorCumpl}`}>
                        {Math.round(snap.cumplimiento)}% cumpl.
                      </span>
                    </>
                  )}
                  {isAdmin && confirmandoId !== snap.id && (
                    <button
                      onClick={() => setConfirmandoId(snap.id)}
                      className="ml-1 p-1 rounded hover:bg-red-900/40 text-gray-700 hover:text-red-400 transition-colors"
                      title="Eliminar snapshot"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Barra */}
              <div className="relative w-full bg-gray-700 rounded-full h-1.5">
                <div className="absolute top-0 left-0 h-1.5 rounded-full bg-gray-600/60"
                  style={{ width: `${snap.pct_plan}%` }} />
                <div className={`absolute top-0 left-0 h-1.5 rounded-full ${colorBarraReal}`}
                  style={{ width: `${snap.pct_real}%` }} />
              </div>

              {/* Entregables del snapshot */}
              {snap.project_deliverable_snapshots?.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  {snap.project_deliverable_snapshots.map(ds => (
                    <div key={ds.id} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 truncate flex-1 mr-2">{ds.nombre}</span>
                      <span className={`text-[10px] font-medium shrink-0 ${
                        ds.pct_real === 100 ? 'text-green-400'
                        : ds.pct_real > 0   ? 'text-blue-400'
                        : 'text-gray-600'
                      }`}>{Math.round(ds.pct_real)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Fecha snapshot */}
              <p className="text-[10px] text-gray-700 mt-2">
                Guardado {new Date(snap.snapshot_at).toLocaleDateString('es-CL', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PANEL HISTORIAL (acordeón por proyecto) ──────────────────────────────────
function PanelHistorial({ proyectos, isAdmin }) {
  const [expandido, setExpandido] = useState(null)

  if (proyectos.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h2 className="text-white font-semibold text-sm">Historial de trazabilidad</h2>
      </div>
      <div className="divide-y divide-gray-800/50">
        {proyectos.map(p => (
          <div key={p.id}>
            <button
              onClick={() => setExpandido(expandido === p.id ? null : p.id)}
              className="w-full flex items-center justify-between px-5 py-3
                hover:bg-gray-800/30 transition text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-mono">EDT {p.edt}</span>
                <span className="text-sm text-gray-300 font-medium truncate">{p.nombre}</span>
                <BadgePrioridad prioridad={p.prioridad} size="xs" />
              </div>
              {expandido === p.id
                ? <ChevronUp className="w-4 h-4 text-gray-600 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-600 shrink-0" />}
            </button>
            {expandido === p.id && (
              <div className="border-t border-gray-800/50">
                <HistorialProyecto proyectoId={p.id} isAdmin={isAdmin} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PANEL EJECUTIVO ──────────────────────────────────────────────────────────
function PanelEjecutivo({ proyectos, onClickProyecto }) {
  if (proyectos.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
        <h2 className="text-white font-semibold text-sm">Resumen por proyecto</h2>
        <p className="text-xs text-gray-500">{proyectos.length} proyectos · click para ir al detalle</p>
      </div>

      <div className="p-4 grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {proyectos.map(proyecto => {
          const entregables = proyecto.project_deliverables ?? []
          const pctReal     = calcularPonderado(entregables, 'pct_real')
          const pctPlan     = calcularPonderado(entregables, 'pct_plan')
          const cumpl       = pctPlan > 0 ? Math.round((pctReal / pctPlan) * 100) : null
          const completados = entregables.filter(d => Number(d.pct_real) === 100).length
          const enProgreso  = entregables.filter(d => Number(d.pct_real) > 0 && Number(d.pct_real) < 100).length
          const noIniciados = entregables.length - completados - enProgreso

          const colorReal = pctReal === 100 ? '#22c55e'
            : pctReal >= pctPlan ? '#3b82f6'
            : pctReal > 0 ? '#f59e0b'
            : '#6b7280'

          const colorCumpl = cumpl === null ? '#6b7280'
            : cumpl >= 100 ? '#22c55e'
            : cumpl >= 75  ? '#f59e0b'
            : '#ef4444'

          const colorBarraReal = pctReal === 100 ? 'bg-green-500'
            : pctReal >= pctPlan ? 'bg-blue-500'
            : pctReal > 0 ? 'bg-amber-500'
            : 'bg-gray-700'

          return (
            <button
              key={proyecto.id}
              onClick={() => onClickProyecto(proyecto.id)}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-3.5 text-left
                hover:bg-gray-800 hover:border-gray-600 transition-all group w-full"
            >
              {/* EDT + nombre + ring */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs text-gray-600 font-mono">{proyecto.edt}</span>
                    <BadgePrioridad prioridad={proyecto.prioridad} size="xs" />
                  </div>
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                    {proyecto.nombre}
                  </p>
                </div>
                <Ring pct={pctReal} color={colorReal} />
              </div>

              {/* Barra doble plan + real */}
              <div className="relative w-full bg-gray-700 rounded-full h-1.5 mb-1">
                <div className="absolute top-0 left-0 h-1.5 rounded-full bg-gray-500/60"
                  style={{ width: `${pctPlan}%` }} />
                <div className={`absolute top-0 left-0 h-1.5 rounded-full ${colorBarraReal}`}
                  style={{ width: `${pctReal}%` }} />
              </div>
              <div className="flex justify-between mb-3">
                <span className="text-xs text-gray-600">Plan {pctPlan}%</span>
                <span className="text-xs font-medium" style={{ color: colorReal }}>Real {pctReal}%</span>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-1 mb-3">
                {[
                  { val: completados, color: 'text-green-400', label: 'OK'    },
                  { val: enProgreso,  color: 'text-amber-400', label: 'Prog.' },
                  { val: noIniciados, color: 'text-gray-500',  label: 'Pend.' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-900/60 rounded-lg py-1.5 text-center">
                    <p className={`text-sm font-bold leading-none ${s.color}`}>{s.val}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Cumpl. plan footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-gray-700">
                <span className="text-xs text-gray-500">Cumpl. plan</span>
                <span className="text-sm font-bold" style={{ color: colorCumpl }}>
                  {cumpl !== null ? `${cumpl}%` : '—'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPAL ───────────────────────────────────────────────────────────
export default function Proyectos() {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [modalProyecto,  setModalProyecto]  = useState(false)
  const [verHistorial,   setVerHistorial]   = useState(false)
  const [guardandoSnap,  setGuardandoSnap]  = useState(false)
  const [snapMsg,        setSnapMsg]        = useState('')
  const [anio, setAnio] = useState(2026)

  const proyectoRefs = useRef({})

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ['proyectos', anio, profile?.departamento],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          responsable:users!projects_responsable_id_fkey(id, nombre, cargo),
          project_deliverables(
            *,
            project_deliverable_responsables(
              id, rol,
              user:users(id, nombre, cargo)
            )
          )
        `)
        .eq('anio', anio)
        .eq('activo', true)
        .order('edt')

      if (profile?.rol !== 'gerente' && profile?.departamento)
        query = query.eq('departamento', profile.departamento)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  function onCambio() {
    queryClient.invalidateQueries({ queryKey: ['proyectos', anio, profile?.departamento] })
  }

  function scrollAProyecto(proyectoId) {
    const el = proyectoRefs.current[proyectoId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Guardar snapshot manual ────────────────────────────────
  async function guardarSnapshot() {
    if (proyectos.length === 0) return
    setGuardandoSnap(true)
    setSnapMsg('')

    const ahora = new Date()
    const mes   = ahora.getMonth() + 1
    const anioSnap = ahora.getFullYear()

    try {
      for (const proyecto of proyectos) {
        const entregables = proyecto.project_deliverables ?? []
        const pctReal     = calcularPonderado(entregables, 'pct_real')
        const pctPlan     = calcularPonderado(entregables, 'pct_plan')
        const cumplimiento = pctPlan > 0 ? Math.round((pctReal / pctPlan) * 100) : null

        const { data: snap, error: errSnap } = await supabase
          .from('project_snapshots')
          .insert({
            project_id:   proyecto.id,
            departamento: proyecto.departamento,
            mes,
            anio:         anioSnap,
            pct_real:     pctReal,
            pct_plan:     pctPlan,
            cumplimiento,
            prioridad:    proyecto.prioridad,
            creado_por:   profile?.id ?? null,
          })
          .select()
          .single()
        if (errSnap) throw errSnap

        // Snapshot por entregable
        if (entregables.length > 0) {
          const detalles = entregables.map(d => ({
            snapshot_id:    snap.id,
            deliverable_id: d.id,
            nombre:         d.nombre,
            pct_real:       Number(d.pct_real) || 0,
            pct_plan:       calcularPctPlan(d.fecha_inicio, d.fecha_fin),
            prioridad:      d.prioridad,
          }))
          const { error: errDet } = await supabase
            .from('project_deliverable_snapshots')
            .insert(detalles)
          if (errDet) throw errDet
        }
      }

      // Invalidar caché de snapshots
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      setSnapMsg(`✓ Snapshot guardado — ${MESES_CORTO[mes - 1]} ${anioSnap}`)
      setTimeout(() => setSnapMsg(''), 4000)
    } catch (err) {
      console.error(err)
      setSnapMsg('Error al guardar snapshot')
      setTimeout(() => setSnapMsg(''), 4000)
    } finally {
      setGuardandoSnap(false)
    }
  }

  // % global ponderado
  const { pctPlanGlobal, pctRealGlobal, totalEntregables } = useMemo(() => ({
    pctPlanGlobal:    calcularPonderadoGlobal(proyectos, 'pct_plan'),
    pctRealGlobal:    calcularPonderadoGlobal(proyectos, 'pct_real'),
    totalEntregables: proyectos.reduce((s, p) => s + (p.project_deliverables ?? []).length, 0),
  }), [proyectos])

  const completados = useMemo(() =>
    proyectos.reduce((s, p) =>
      s + (p.project_deliverables ?? []).filter(d => Number(d.pct_real) === 100).length, 0
    ), [proyectos])

  const enProgreso = useMemo(() =>
    proyectos.reduce((s, p) =>
      s + (p.project_deliverables ?? []).filter(d => Number(d.pct_real) > 0 && Number(d.pct_real) < 100).length, 0
    ), [proyectos])

  const noIniciados = totalEntregables - completados - enProgreso

  const cumplimientoPlan = pctPlanGlobal > 0
    ? Math.round((pctRealGlobal / pctPlanGlobal) * 100)
    : null

  const colorReal = pctRealGlobal === 100 ? 'text-green-400'
    : pctRealGlobal >= pctPlanGlobal ? 'text-blue-400'
    : pctRealGlobal > 0 ? 'text-amber-400'
    : 'text-gray-500'

  const colorBarraReal = pctRealGlobal === 100 ? 'bg-green-500'
    : pctRealGlobal >= pctPlanGlobal ? 'bg-blue-500'
    : pctRealGlobal > 0 ? 'bg-amber-500'
    : 'bg-gray-700'

  const colorCumpl = cumplimientoPlan === null ? 'text-gray-500'
    : cumplimientoPlan >= 100 ? 'text-green-400'
    : cumplimientoPlan >= 75  ? 'text-amber-400'
    : 'text-red-400'

  const nombreDepto = profile?.departamento ?? 'Proyectos'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 bg-blue-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">Proyectos {anio}</h1>
          </div>
          <p className="text-gray-400 text-sm ml-5">
            {proyectos.length} proyectos · {totalEntregables} entregables
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector año */}
          <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {[2024, 2025, 2026].map(a => (
              <button key={a} onClick={() => setAnio(a)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition
                  ${anio === a ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {a}
              </button>
            ))}
          </div>

          {/* Botón historial */}
          <button
            onClick={() => setVerHistorial(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition
              ${verHistorial
                ? 'bg-blue-800 text-blue-200'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Historial
          </button>

          {/* Botón snapshot — solo admin */}
          {profile?.rol === 'admin' && (
            <button
              onClick={guardarSnapshot}
              disabled={guardandoSnap || proyectos.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                         bg-gray-800 border border-gray-700 text-gray-400 hover:text-white
                         transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Camera className="w-3.5 h-3.5" />
              {guardandoSnap ? 'Guardando…' : 'Snapshot'}
            </button>
          )}

          {/* Botón nuevo proyecto — solo admin */}
          {profile?.rol === 'admin' && (
            <button onClick={() => setModalProyecto(true)}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600
                         text-white text-sm font-medium px-4 py-2 rounded-lg transition">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo proyecto</span>
            </button>
          )}
        </div>
      </div>

      {/* Mensaje snapshot */}
      {snapMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
          snapMsg.startsWith('✓')
            ? 'bg-green-900/30 border border-green-800 text-green-300'
            : 'bg-red-900/30 border border-red-800 text-red-300'
        }`}>
          {snapMsg}
        </div>
      )}

      {/* ── RESUMEN GLOBAL ───────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        <div className="flex items-start justify-between gap-6 px-6 py-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-base">{nombreDepto}</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Avance global PO {anio} · {proyectos.length} proyectos · {totalEntregables} entregables
            </p>
            <p className="text-gray-600 text-xs mt-1">Ponderado por duración × prioridad</p>
          </div>
          <div className="flex items-end gap-5 shrink-0">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Real</p>
              <p className={`text-4xl font-bold leading-none ${colorReal}`}>{pctRealGlobal}%</p>
            </div>
            <div className="text-2xl text-gray-700 pb-1">/</div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Plan</p>
              <p className="text-4xl font-bold leading-none text-gray-400">{pctPlanGlobal}%</p>
            </div>
            {cumplimientoPlan !== null && (
              <>
                <div className="w-px h-10 bg-gray-800 self-center" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Cumpl. plan</p>
                  <p className={`text-4xl font-bold leading-none ${colorCumpl}`}>{cumplimientoPlan}%</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-800">
          <div className="relative w-full bg-gray-800 rounded-full h-3">
            <div className="absolute top-0 left-0 h-3 rounded-full bg-gray-600/60 transition-all duration-700"
              style={{ width: `${pctPlanGlobal}%` }} />
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-700 ${colorBarraReal}`}
              style={{ width: `${pctRealGlobal}%` }} />
          </div>
          <div className="flex items-center gap-5 mt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 bg-gray-600/60 inline-block rounded" />
              <span className="text-xs text-gray-600">Plan {pctPlanGlobal}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-4 h-1 inline-block rounded ${colorBarraReal}`} />
              <span className="text-xs text-gray-500">Real {pctRealGlobal}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-800">
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-bold text-green-400">{completados}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">Completados</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-bold text-blue-400">{enProgreso}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">En progreso</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-bold text-gray-500">{noIniciados}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">No iniciados</p>
          </div>
        </div>
      </div>

      {/* ── PANEL HISTORIAL ──────────────────────────────────────── */}
      {verHistorial && !isLoading && proyectos.length > 0 && (
        <PanelHistorial proyectos={proyectos} isAdmin={profile?.rol === 'admin'} />
      )}

      {/* ── PANEL EJECUTIVO ──────────────────────────────────────── */}
      {!isLoading && proyectos.length > 0 && (
        <PanelEjecutivo proyectos={proyectos} onClickProyecto={scrollAProyecto} />
      )}

      {/* ── LISTA PROYECTOS ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proyectos.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No hay proyectos para {anio}</p>
          {profile?.rol === 'admin' && (
            <button onClick={() => setModalProyecto(true)}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition">
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {proyectos.map(proyecto => (
            <div key={proyecto.id}
              ref={el => { proyectoRefs.current[proyecto.id] = el }}
              className="scroll-mt-6">
              <ProyectoCard proyecto={proyecto} onCambio={onCambio} />
            </div>
          ))}
        </div>
      )}

      {modalProyecto && (
        <ProyectoModal
          anio={anio}
          departamento={profile?.departamento}
          onClose={() => setModalProyecto(false)}
          onGuardado={() => { onCambio(); setModalProyecto(false) }}
        />
      )}
    </div>
  )
}
