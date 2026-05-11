import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import EntregableModal from './EntregableModal'
import ProyectoModal from './ProyectoModal'
import {
  ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  CheckCircle2, Circle, Clock, Calendar, TrendingUp
} from 'lucide-react'

function calcularPctPlan(fechaInicio, fechaFin) {
  const hoy    = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin    = new Date(fechaFin + 'T00:00:00')
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

export default function ProyectoCard({ proyecto, onCambio }) {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [expandido, setExpandido]                       = useState(true)
  const [modalEntregable, setModalEntregable]           = useState(false)
  const [editandoEntregable, setEditandoEntregable]     = useState(null)
  const [editandoProyecto, setEditandoProyecto]         = useState(false)
  const [eliminandoProyecto, setEliminandoProyecto]     = useState(false)
  const [eliminandoEntregable, setEliminandoEntregable] = useState(null)

  const entregables = proyecto.project_deliverables ?? []

  // Calcular % plan y real del proyecto (ponderado por duración)
  const pctPlanProyecto = useMemo(() => calcularPonderado(entregables, 'pct_plan'), [entregables])
  const pctRealProyecto = useMemo(() => calcularPonderado(entregables, 'pct_real'), [entregables])
  const pctPlanGlobal   = calcularPctPlan(proyecto.fecha_inicio, proyecto.fecha_fin)

  // Ratio real/plan
  const ratio = pctPlanProyecto > 0
    ? Math.round((pctRealProyecto / pctPlanProyecto) * 100)
    : null

  const colorReal = pctRealProyecto === 100 ? 'bg-green-500'
    : pctRealProyecto >= pctPlanProyecto ? 'bg-blue-500'
    : pctRealProyecto > 0 ? 'bg-amber-500'
    : 'bg-gray-700'

  const colorTextoReal = pctRealProyecto === 100 ? 'text-green-400'
    : pctRealProyecto >= pctPlanProyecto ? 'text-blue-400'
    : pctRealProyecto > 0 ? 'text-amber-400'
    : 'text-gray-500'

  async function eliminarProyecto() {
    await supabase.from('project_deliverables').delete().eq('project_id', proyecto.id)
    await supabase.from('projects').delete().eq('id', proyecto.id)
    onCambio()
    setEliminandoProyecto(false)
  }

  async function eliminarEntregable() {
    await supabase.from('project_deliverables').delete().eq('id', eliminandoEntregable.id)
    onCambio()
    setEliminandoEntregable(null)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

      {/* Header */}
      <div
        className="px-6 py-5 cursor-pointer hover:bg-gray-800/40 transition"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-600 font-mono bg-gray-800 px-2 py-0.5 rounded">
                EDT {proyecto.edt}
              </span>
              {proyecto.responsable && (
                <span className="text-xs text-gray-500">{proyecto.responsable.nombre}</span>
              )}
            </div>
            <h3 className="text-white font-semibold text-lg leading-tight">{proyecto.nombre}</h3>
            {proyecto.descripcion && (
              <p className="text-gray-500 text-sm mt-1 truncate">{proyecto.descripcion}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500">
                {new Date(proyecto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                {' → '}
                {new Date(proyecto.fecha_fin + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className={`text-2xl font-bold ${colorTextoReal}`}>{pctRealProyecto}%</p>
              <p className="text-gray-600 text-xs">real · plan {pctPlanProyecto}%</p>
              {ratio !== null && (
                <p className={`text-xs font-medium mt-0.5 ${
                  ratio >= 100 ? 'text-green-400' : ratio >= 75 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {ratio >= 100 ? '✓' : '↓'} {ratio}% vs plan
                </p>
              )}
            </div>
            {expandido
              ? <ChevronUp className="w-5 h-5 text-gray-500" />
              : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </div>
        </div>

        {/* Barras plan vs real */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-10 shrink-0">Plan</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2 relative">
              <div
                className="h-2 rounded-full transition-all duration-700 bg-gray-500"
                style={{ width: `${pctPlanProyecto}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{pctPlanProyecto}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-10 shrink-0">Real</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${colorReal}`}
                style={{ width: `${pctRealProyecto}%` }}
              />
            </div>
            <span className={`text-xs font-medium w-8 text-right ${colorTextoReal}`}>{pctRealProyecto}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-10 shrink-0">Tiempo</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-700 bg-gray-700"
                style={{ width: `${pctPlanGlobal}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-8 text-right">{pctPlanGlobal}%</span>
          </div>
        </div>
      </div>

      {/* Entregables */}
      {expandido && (
        <div className="border-t border-gray-800">
          {entregables.length === 0 ? (
            <div className="px-6 py-6 text-center text-gray-600 text-sm">Sin entregables aún</div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {[...entregables]
                .sort((a, b) => a.orden - b.orden)
                .map(entregable => {
                  const pctPlan = calcularPctPlan(entregable.fecha_inicio, entregable.fecha_fin)
                  const pctReal = Number(entregable.pct_real) || 0
                  const estado  = pctReal === 100 ? 'completado'
                    : pctReal > 0 ? 'en_progreso' : 'no_iniciado'

                  const colorBadge = estado === 'completado'  ? 'bg-green-900 text-green-300'
                    : estado === 'en_progreso' ? 'bg-blue-900 text-blue-300'
                    : 'bg-gray-800 text-gray-500'
                  const labelBadge = estado === 'completado'  ? 'Completado'
                    : estado === 'en_progreso' ? 'En progreso' : 'No iniciado'

                  const colorBarraReal = pctReal === 100 ? 'bg-green-500'
                    : pctReal >= pctPlan ? 'bg-blue-500'
                    : 'bg-amber-500'

                  return (
                    <div key={entregable.id} className="px-6 py-4 hover:bg-gray-800/30 transition group">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-gray-600 font-mono shrink-0">{entregable.edt}</span>
                            <p className={`text-sm font-medium truncate ${
                              estado === 'completado' ? 'text-gray-500 line-through' : 'text-gray-200'
                            }`}>
                              {entregable.nombre}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-600">
                              {new Date(entregable.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                              {' → '}
                              {new Date(entregable.fecha_fin + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                            </span>
                            {entregable.duracion_dias && (
                              <span className="text-xs text-gray-700">{entregable.duracion_dias}d</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorBadge}`}>
                            {labelBadge}
                          </span>
                          <span className={`text-sm font-bold ${
                            pctReal === 100 ? 'text-green-400'
                            : pctReal >= pctPlan ? 'text-blue-400'
                            : pctReal > 0 ? 'text-amber-400'
                            : 'text-gray-600'
                          }`}>{pctReal}%</span>
                          {profile?.rol === 'admin' && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => setEditandoEntregable(entregable)}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEliminandoEntregable(entregable)}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Barras plan vs real por entregable */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 w-8 shrink-0">Plan</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-gray-600 transition-all duration-500"
                              style={{ width: `${pctPlan}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-7 text-right">{pctPlan}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 w-8 shrink-0">Real</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${colorBarraReal}`}
                              style={{ width: `${pctReal}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-7 text-right">{pctReal}%</span>
                        </div>
                      </div>

                      {entregable.comentarios && (
                        <p className="text-xs text-gray-600 mt-2">{entregable.comentarios}</p>
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          {/* Footer admin */}
          {profile?.rol === 'admin' && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={() => setModalEntregable(true)}
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="w-4 h-4" />
                Agregar entregable
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditandoProyecto(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar proyecto
                </button>
                <button
                  onClick={() => setEliminandoProyecto(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {(modalEntregable || editandoEntregable) && (
        <EntregableModal
          proyectoId={proyecto.id}
          entregable={editandoEntregable}
          onClose={() => { setModalEntregable(false); setEditandoEntregable(null) }}
          onGuardado={() => { onCambio(); setModalEntregable(false); setEditandoEntregable(null) }}
        />
      )}
      {editandoProyecto && (
        <ProyectoModal
          proyecto={proyecto}
          anio={proyecto.anio}
          onClose={() => setEditandoProyecto(false)}
          onGuardado={() => { onCambio(); setEditandoProyecto(false) }}
        />
      )}
      {eliminandoProyecto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-900/40 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white font-semibold">¿Eliminar proyecto?</h3>
            </div>
            <p className="text-white text-sm font-medium bg-gray-800 rounded-lg px-3 py-2 mb-4">
              {proyecto.nombre}
            </p>
            <p className="text-gray-500 text-xs mb-6">
              Se eliminarán todos sus entregables. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setEliminandoProyecto(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition">
                Cancelar
              </button>
              <button onClick={eliminarProyecto}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600
                           text-white py-2.5 rounded-xl text-sm font-semibold transition">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {eliminandoEntregable && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-900/40 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white font-semibold">¿Eliminar entregable?</h3>
            </div>
            <p className="text-white text-sm font-medium bg-gray-800 rounded-lg px-3 py-2 mb-6">
              {eliminandoEntregable.nombre}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setEliminandoEntregable(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition">
                Cancelar
              </button>
              <button onClick={eliminarEntregable}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600
                           text-white py-2.5 rounded-xl text-sm font-semibold transition">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
