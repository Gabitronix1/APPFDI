import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProyectoCard from '../components/ProyectoCard'
import ProyectoModal from '../components/ProyectoModal'
import { Plus, FolderKanban } from 'lucide-react'

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

function calcularPonderado(entregables, campo) {
  const totalDias = entregables.reduce((s, d) => s + (d.duracion_dias || 1), 0)
  if (totalDias === 0) return 0
  const suma = entregables.reduce((s, d) => {
    const valor = campo === 'pct_plan'
      ? calcularPctPlan(d.fecha_inicio, d.fecha_fin)
      : (Number(d.pct_real) || 0)
    return s + valor * (d.duracion_dias || 1)
  }, 0)
  return Math.round(suma / totalDias)
}

export default function Proyectos() {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [modalProyecto, setModalProyecto] = useState(false)
  const [anio, setAnio] = useState(2026)

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

      // Filtrar por departamento (excepto gerente que ve todo)
      if (profile?.rol !== 'gerente' && profile?.departamento) {
        query = query.eq('departamento', profile.departamento)
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }
  })

  function onCambio() {
    queryClient.invalidateQueries({ queryKey: ['proyectos', anio, profile?.departamento] })
  }

  const { pctPlanGlobal, pctRealGlobal, totalEntregables } = useMemo(() => {
    const todosEntregables = proyectos.flatMap(p => p.project_deliverables ?? [])
    return {
      pctPlanGlobal:    calcularPonderado(todosEntregables, 'pct_plan'),
      pctRealGlobal:    calcularPonderado(todosEntregables, 'pct_real'),
      totalEntregables: todosEntregables.length,
    }
  }, [proyectos])

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

  // Color según cumplimiento
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
              <button
                key={a}
                onClick={() => setAnio(a)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition
                  ${anio === a ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {a}
              </button>
            ))}
          </div>
          {profile?.rol === 'admin' && (
            <button
              onClick={() => setModalProyecto(true)}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600
                         text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo proyecto</span>
            </button>
          )}
        </div>
      </div>

      {/* ── RESUMEN GLOBAL ───────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-8">

        {/* Fila superior: nombre depto + números protagonistas */}
        <div className="flex items-start justify-between gap-6 px-6 py-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-base">{nombreDepto}</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Avance global PO {anio} · {proyectos.length} proyectos · {totalEntregables} entregables
            </p>
          </div>

          {/* NÚMEROS GRANDES */}
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

        {/* Barra superpuesta */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="relative w-full bg-gray-800 rounded-full h-3">
            <div
              className="absolute top-0 left-0 h-3 rounded-full bg-gray-600/60 transition-all duration-700"
              style={{ width: `${pctPlanGlobal}%` }}
            />
            <div
              className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-700 ${colorBarraReal}`}
              style={{ width: `${pctRealGlobal}%` }}
            />
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

        {/* Mini stats: completados / en progreso / no iniciados */}
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
            <button
              onClick={() => setModalProyecto(true)}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition"
            >
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {proyectos.map(proyecto => (
            <ProyectoCard
              key={proyecto.id}
              proyecto={proyecto}
              onCambio={onCambio}
            />
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
