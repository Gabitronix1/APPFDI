import { useState, useMemo  } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import EntregableModal from './EntregableModal'
import ProyectoModal from './ProyectoModal'
import {
  ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  CheckCircle2, Circle, Clock, Calendar
} from 'lucide-react'

const ESTADO_CONFIG = {
  completado:  { label: 'Completado',  badge: 'bg-green-900 text-green-300',  icono: CheckCircle2, peso: 100 },
  en_progreso: { label: 'En progreso', badge: 'bg-blue-900 text-blue-300',    icono: Clock,        peso: 50  },
  no_iniciado: { label: 'No iniciado', badge: 'bg-gray-800 text-gray-500',    icono: Circle,       peso: 0   },
}

function calcularTiempoTranscurrido(fechaInicio, fechaFin) {
  const hoy   = new Date()
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin    = new Date(fechaFin + 'T00:00:00')
  if (hoy < inicio) return 0
  if (hoy > fin)    return 100
  const total  = fin.getTime() - inicio.getTime()
  const pasado = hoy.getTime() - inicio.getTime()
  return Math.round((pasado / total) * 100)
}

export default function ProyectoCard({ proyecto, onCambio }) {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()
  const [expandido, setExpandido]           = useState(true)
  const [modalEntregable, setModalEntregable] = useState(false)
  const [editandoEntregable, setEditandoEntregable] = useState(null)
  const [editandoProyecto, setEditandoProyecto]     = useState(false)
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false)
  const [eliminandoEntregable, setEliminandoEntregable] = useState(null)
  const [loadingEstado, setLoadingEstado]   = useState(null)

  const entregables    = proyecto.project_deliverables ?? []
  const completados    = entregables.filter(d => d.estado === 'completado').length
  const enProgreso     = entregables.filter(d => d.estado === 'en_progreso').length
  const pctAvance      = entregables.length
    ? Math.round(entregables.reduce((s, d) => s + ESTADO_CONFIG[d.estado].peso, 0) / entregables.length)
    : 0
  const tiempoTransc = useMemo(
    () => calcularTiempoTranscurrido(proyecto.fecha_inicio, proyecto.fecha_fin),
    [proyecto.fecha_inicio, proyecto.fecha_fin]
    )   

  async function cambiarEstado(entregable) {
    const ciclo = {
      no_iniciado: 'en_progreso',
      en_progreso: 'completado',
      completado:  'no_iniciado',
    }
    const nuevoEstado = ciclo[entregable.estado]
    setLoadingEstado(entregable.id)
    await supabase
      .from('project_deliverables')
      .update({ estado: nuevoEstado })
      .eq('id', entregable.id)
    onCambio()
    setLoadingEstado(null)
  }

  async function eliminarProyecto() {
    await supabase.from('projects').delete().eq('id', proyecto.id)
    onCambio()
    setEliminandoProyecto(false)
  }

  async function eliminarEntregable() {
    await supabase.from('project_deliverables').delete().eq('id', eliminandoEntregable.id)
    onCambio()
    setEliminandoEntregable(null)
  }

  const colorAvance = pctAvance === 100 ? 'bg-green-500'
    : pctAvance > 50 ? 'bg-blue-500'
    : pctAvance > 0  ? 'bg-amber-500'
    : 'bg-gray-700'

  const colorTexto = pctAvance === 100 ? 'text-green-400'
    : pctAvance > 50 ? 'text-blue-400'
    : pctAvance > 0  ? 'text-amber-400'
    : 'text-gray-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

      {/* Header del proyecto */}
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
                <span className="text-xs text-gray-500">
                  {proyecto.responsable.nombre}
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-lg leading-tight">
              {proyecto.nombre}
            </h3>
            {proyecto.descripcion && (
              <p className="text-gray-500 text-sm mt-1 truncate">{proyecto.descripcion}</p>
            )}

            {/* Fechas */}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500">
                {new Date(proyecto.fecha_inicio).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                {' → '}
                {new Date(proyecto.fecha_fin).toLocaleDateString('es-CL', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* % avance */}
            <div className="text-right">
              <p className={`text-2xl font-bold ${colorTexto}`}>{pctAvance}%</p>
              <p className="text-gray-600 text-xs">{completados}/{entregables.length} completos</p>
            </div>
            {expandido
              ? <ChevronUp className="w-5 h-5 text-gray-500" />
              : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </div>
        </div>

        {/* Barras de progreso */}
        <div className="mt-4 space-y-1.5">
          {/* Avance real */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-16 shrink-0">Avance</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${colorAvance}`}
                style={{ width: `${pctAvance}%` }}
              />
            </div>
            <span className={`text-xs font-medium w-8 text-right ${colorTexto}`}>{pctAvance}%</span>
          </div>
          {/* Tiempo transcurrido */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-16 shrink-0">Tiempo</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-700 bg-gray-600"
                style={{ width: `${tiempoTransc}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{tiempoTransc}%</span>
          </div>
        </div>
      </div>

      {/* Entregables */}
      {expandido && (
        <div className="border-t border-gray-800">
          {entregables.length === 0 ? (
            <div className="px-6 py-6 text-center text-gray-600 text-sm">
              Sin entregables aún
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {entregables
                .sort((a, b) => a.orden - b.orden)
                .map(entregable => {
                  const cfg   = ESTADO_CONFIG[entregable.estado]
                  const Icono = cfg.icono
                  const cargando = loadingEstado === entregable.id

                  return (
                    <div
                      key={entregable.id}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-gray-800/30 transition group"
                    >
                      {/* Botón cambiar estado */}
                      <button
                        onClick={() => cambiarEstado(entregable)}
                        disabled={cargando}
                        className="shrink-0 hover:scale-110 transition-transform disabled:opacity-50"
                        title={`Cambiar estado (actual: ${cfg.label})`}
                      >
                        {cargando
                          ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          : <Icono className={`w-5 h-5 ${
                              entregable.estado === 'completado'  ? 'text-green-500' :
                              entregable.estado === 'en_progreso' ? 'text-blue-400'  :
                              'text-gray-600'
                            }`} />}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-mono shrink-0">
                            {entregable.edt}
                          </span>
                          <p className={`text-sm truncate ${
                            entregable.estado === 'completado' ? 'text-gray-500 line-through' : 'text-gray-200'
                          }`}>
                            {entregable.nombre}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-600">
                            {new Date(entregable.fecha_inicio).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                            {' → '}
                            {new Date(entregable.fecha_fin).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                          </span>
                          {entregable.duracion_dias && (
                            <span className="text-xs text-gray-700">{entregable.duracion_dias}d</span>
                          )}
                        </div>
                        {entregable.comentarios && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{entregable.comentarios}</p>
                        )}
                      </div>

                      {/* Badge estado */}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${cfg.badge}`}>
                        {cfg.label}
                      </span>

                      {/* Acciones admin */}
                      {profile?.rol === 'admin' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
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
                  )
                })}
            </div>
          )}

          {/* Footer acciones admin */}
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

      {/* Modal nuevo/editar entregable */}
      {(modalEntregable || editandoEntregable) && (
        <EntregableModal
          proyectoId={proyecto.id}
          entregable={editandoEntregable}
          onClose={() => { setModalEntregable(false); setEditandoEntregable(null) }}
          onGuardado={() => { onCambio(); setModalEntregable(false); setEditandoEntregable(null) }}
        />
      )}

      {/* Modal editar proyecto */}
      {editandoProyecto && (
        <ProyectoModal
          proyecto={proyecto}
          anio={proyecto.anio}
          onClose={() => setEditandoProyecto(false)}
          onGuardado={() => { onCambio(); setEditandoProyecto(false) }}
        />
      )}

      {/* Confirmar eliminar proyecto */}
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
              <button
                onClick={() => setEliminandoProyecto(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarProyecto}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar entregable */}
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
              <button
                onClick={() => setEliminandoEntregable(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarEntregable}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}