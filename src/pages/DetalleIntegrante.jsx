import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  ListChecks,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'

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

function esCompletada(t) {
  return t.estado === 'completada' || t.estado === 'completada_con_atraso'
}

function esPendiente(t) {
  return t.estado === 'pendiente' || t.estado === 'en_progreso'
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

function getTipoClass(tipo) {
  if (tipo === 'cierre') return 'bg-emerald-900/60 text-emerald-300 border-emerald-800'
  if (tipo === 'recurrente') return 'bg-blue-900/60 text-blue-300 border-blue-800'
  return 'bg-gray-800 text-gray-300 border-gray-700'
}

function getEstadoClass(t) {
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

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
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

function TaskRow({ tarea, onClick }) {
  const tipo = getTipoTarea(tarea)
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
              <Badge className={getTipoClass(tipo)}>{getTipoLabel(tarea)}</Badge>
              <Badge className={getEstadoClass(tarea)}>{String(tarea.estado ?? 'pendiente').replace(/_/g, ' ')}</Badge>
            </div>
            {pct !== null && <span className={`text-xs font-semibold ${pctColorClass(pct)}`}>{pct}%</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function StateCard({ label, value, className }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${className}`}>{value}</p>
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
  const cierre = tareasIntegrante.filter(t => getTipoTarea(t) === 'cierre')
  const ciclo = tareasIntegrante.filter(t => getTipoTarea(t) === 'ciclo')

  function tituloSeccion(lista, tipo) {
    const completadasSeccion = lista.filter(esCompletada).length
    return `${tipo} · ${completadasSeccion}/${lista.length}`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <Panel className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Detalle de integrante</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{nombreIntegrante}</h1>
              <Badge className="bg-emerald-900/70 text-emerald-300 border-emerald-800">Vista detallada</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                {cicloSeleccionado ? nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio) : 'Ciclo activo'}
              </Badge>
              <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                {formatoFechaES(new Date())}
              </Badge>
              <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                {tareasIntegrante.length} tareas
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Avance</p>
            <p className={`text-4xl font-bold mt-1 ${pctColorClass(pct)}`}>{pct}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {completadas + completadasAtraso} de {tareasIntegrante.length} completadas
            </p>
          </div>
        </div>

        <div className="mt-6">
          <ProgressBar value={pct} height="h-3.5" />
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <StateCard label="Total" value={tareasIntegrante.length} className="text-white" />
          <StateCard label="Completadas" value={completadas} className="text-green-400" />
          <StateCard label="Con atraso" value={completadasAtraso + atrasadas} className="text-yellow-400" />
          <StateCard label="Sin completar" value={sinCompletar} className="text-red-400" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StateCard label="Recurrentes" value={recurrentes.length} className="text-blue-400" />
        <StateCard label="De cierre" value={cierre.length} className="text-emerald-400" />
        <StateCard label="De ciclo" value={ciclo.length} className="text-gray-200" />
      </div>

      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Responsabilidad</p>
            <h2 className="text-white font-semibold">Detalle por tipo de tarea</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            ['recurrentes', recurrentes, 'recurrente'],
            ['cierre', cierre, 'cierre'],
            ['ciclo', ciclo, 'ciclo'],
          ].map(([titulo, lista, tipo]) => (
            <div key={tipo} className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${tipo === 'cierre' ? 'bg-emerald-400' : tipo === 'recurrente' ? 'bg-blue-400' : 'bg-gray-400'}`} />
                  <p className="text-white font-medium capitalize">{tituloSeccion(lista, titulo)}</p>
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
                          setTareaActiva(t)
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
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Estado general</p>
            <h2 className="text-white font-semibold">Resumen rápido</h2>
          </div>
          <Badge className="bg-gray-800 text-gray-300 border-gray-700">
            {isLoading ? 'Cargando...' : 'Actualizado'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Pendientes activas</p>
              <p className="text-2xl font-bold text-white mt-1">
                {tareasIntegrante.filter(t => !esCompletada(t) && t.estado !== 'no_completada').length}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Con atraso</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{completadasAtraso + atrasadas}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Sin completar</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{sinCompletar}</p>
            </div>
          </div>
        )}
      </Panel>

      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-5 h-5 text-green-400" />
          <h2 className="text-white font-semibold">Tareas pendientes</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tareasIntegrante.filter(t => !esCompletada(t) && t.estado !== 'no_completada').length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/30 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">¡Todo al día!</p>
            <p className="text-gray-500 text-sm">No hay tareas pendientes para este integrante</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tareasIntegrante
              .filter(t => !esCompletada(t) && t.estado !== 'no_completada')
              .map(tarea => (
                <TaskRow key={tarea.id} tarea={tarea} onClick={() => setTareaActiva(tarea)} />
              ))}
          </div>
        )}
      </Panel>

      {tareaDetalle && (
        <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />
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
