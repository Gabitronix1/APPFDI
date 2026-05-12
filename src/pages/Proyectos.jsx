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
  queryKey: ['proyectos', anio],
  queryFn: async () => {
    const { data, error } = await supabase
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
    if (error) throw error
    return data ?? []
  }
})

  function onCambio() {
    queryClient.invalidateQueries({ queryKey: ['proyectos', anio] })
  }

  // % global ponderado por duración de todos los entregables
  const { pctPlanGlobal, pctRealGlobal, totalEntregables } = useMemo(() => {
    const todosEntregables = proyectos.flatMap(p => p.project_deliverables ?? [])
    return {
      pctPlanGlobal:   calcularPonderado(todosEntregables, 'pct_plan'),
      pctRealGlobal:   calcularPonderado(todosEntregables, 'pct_real'),
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

  const colorTexto = pctRealGlobal === 100 ? 'text-green-400'
    : pctRealGlobal >= pctPlanGlobal ? 'text-blue-400'
    : pctRealGlobal > 0 ? 'text-amber-400'
    : 'text-gray-500'

  const colorBarra = pctRealGlobal === 100 ? 'bg-green-500'
    : pctRealGlobal >= pctPlanGlobal ? 'bg-blue-500'
    : pctRealGlobal > 0 ? 'bg-amber-500'
    : 'bg-gray-700'

  const ratio = pctPlanGlobal > 0
    ? Math.round((pctRealGlobal / pctPlanGlobal) * 100)
    : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
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

      {/* Resumen global */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-white font-semibold">Avance global PO {anio}</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {completados} completados · {enProgreso} en progreso · {totalEntregables - completados - enProgreso} no iniciados
            </p>
          </div>
          <div className="text-right">
            {ratio !== null && (
              <p className={`text-3xl font-bold ${
                ratio >= 100 ? 'text-green-400' : ratio >= 75 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {ratio >= 100 ? '✓' : '↓'} {ratio}%
              </p>
            )}
            <p className="text-gray-500 text-xs mt-0.5">vs plan</p>
            <p className="text-gray-600 text-xs mt-1">{pctRealGlobal}% real · {pctPlanGlobal}% plan</p>
          </div>
        </div> 

        {/* Barra superpuesta plan + real */}
        <div className="relative w-full bg-gray-800 rounded-full h-4">
          <div
            className="absolute top-0 left-0 h-4 rounded-full bg-gray-600/50 transition-all duration-700"
            style={{ width: `${pctPlanGlobal}%` }}
          />
          <div
            className={`absolute top-0 left-0 h-4 rounded-full transition-all duration-700 ${colorBarra}`}
            style={{ width: `${pctRealGlobal}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-gray-600/50 inline-block rounded" />
            <span className="text-xs text-gray-600">Plan {pctPlanGlobal}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-1 inline-block rounded ${colorBarra}`} />
            <span className="text-xs text-gray-500">Real {pctRealGlobal}%</span>
          </div>
        </div>
      </div>

      {/* Lista proyectos */}
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
          onClose={() => setModalProyecto(false)}
          onGuardado={() => { onCambio(); setModalProyecto(false) }}
        />
      )}
    </div>
  )
}
