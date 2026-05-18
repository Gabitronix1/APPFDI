import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import EntregableModal from './EntregableModal'
import ProyectoModal from './ProyectoModal'
import { ChevronDown, ChevronUp, Plus, Trash2, Pencil, Calendar } from 'lucide-react'
import { calcularPonderado, BadgePrioridad, factorP } from '../pages/Proyectos'
import CampoFecha from './CampoFecha'

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

function calcularPctDesdeSubtareas(subtareas) {
  if (subtareas.length === 0) return 0
  const totalPeso = subtareas.reduce((sum, s) => sum + (s.duracion_dias || 1) * factorP(s.prioridad), 0)
  if (totalPeso === 0) return 0
  const suma = subtareas.reduce((sum, s) => {
    if (s.estado !== 'completada') return sum
    return sum + (s.duracion_dias || 1) * factorP(s.prioridad) * 100
  }, 0)
  return Math.round(suma / totalPeso)
}

const PRIORIDADES_SUB = [
  { value: 'alta',  label: '↑ Alta'  },
  { value: 'media', label: '→ Media' },
  { value: 'baja',  label: '↓ Baja'  },
]

function calcularDuracion(inicio, fin) {
  if (!inicio || !fin) return null
  const diff = Math.round((new Date(fin + 'T00:00:00') - new Date(inicio + 'T00:00:00')) / 86_400_000)
  return diff > 0 ? diff : 1
}

// ─── ENTREGABLE ROW ───────────────────────────────────────────────────────────
function EntregableRow({ entregable, onActualizar, onEditar, onEliminar, esAdmin }) {
  const queryClient = useQueryClient()
  const [pctLocal, setPctLocal]   = useState(Number(entregable.pct_real) || 0)
  const [guardando, setGuardando] = useState(false)
  const [showAddForm,        setShowAddForm]        = useState(false)
  const [nuevoNombre,        setNuevoNombre]        = useState('')
  const [nuevaPrioridad,     setNuevaPrioridad]     = useState('media')
  const [nuevoResponsableId, setNuevoResponsableId] = useState('')
  const [nuevaFechaInicio,   setNuevaFechaInicio]   = useState('')
  const [nuevaFechaFin,      setNuevaFechaFin]      = useState('')
  const [guardandoSub,       setGuardandoSub]       = useState(false)
  const [errorSub,           setErrorSub]           = useState('')

  const { data: subtareas = [] } = useQuery({
    queryKey: ['subtareas', entregable.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('task_subtasks')
        .select('*, responsable:users(id, nombre)')
        .eq('deliverable_id', entregable.id)
        .order('orden')
      return data ?? []
    },
    staleTime: 30_000,
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-cdg'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users').select('id, nombre').eq('activo', true).order('nombre')
      return data ?? []
    },
    enabled: esAdmin,
    staleTime: 300_000,
  })

  const tieneSubtareas = subtareas.length > 0

  const pctCalculado = useMemo(() => {
    if (!tieneSubtareas) return null
    return calcularPctDesdeSubtareas(subtareas)
  }, [subtareas, tieneSubtareas])

  // Valor efectivo: calculado desde subtareas si las hay, slider manual si no
  const pctEfectivo = tieneSubtareas ? (pctCalculado ?? 0) : pctLocal

  const pctPlan     = calcularPctPlan(entregable.fecha_inicio, entregable.fecha_fin)
  const estado      = pctEfectivo === 100 ? 'completado' : pctEfectivo > 0 ? 'en_progreso' : 'no_iniciado'
  const cumplEntregable = pctPlan > 0 ? Math.round((pctEfectivo / pctPlan) * 100) : null

  const colorBadge = estado === 'completado'  ? 'bg-green-900/50 text-green-300'
    : estado === 'en_progreso' ? 'bg-blue-900/50 text-blue-300'
    : 'bg-gray-800 text-gray-500'
  const labelBadge = estado === 'completado'  ? 'Completado'
    : estado === 'en_progreso' ? 'En progreso' : 'No iniciado'

  const colorBarraReal = pctEfectivo === 100 ? 'bg-green-500'
    : pctEfectivo >= pctPlan ? 'bg-blue-500'
    : pctEfectivo > 0 ? 'bg-amber-500'
    : 'bg-gray-700'

  const colorTextoReal = pctEfectivo === 100 ? 'text-green-400'
    : pctEfectivo >= pctPlan ? 'text-blue-400'
    : pctEfectivo > 0 ? 'text-amber-400'
    : 'text-gray-500'

  const colorCumpl = cumplEntregable === null ? 'text-gray-500'
    : cumplEntregable >= 100 ? 'text-green-400'
    : cumplEntregable >= 75  ? 'text-amber-400'
    : 'text-red-400'

  const bgEstado = estado === 'completado'  ? 'bg-green-900/[0.07]'
    : estado === 'en_progreso' ? 'bg-blue-900/[0.07]'
    : 'bg-white/[0.02]'

  async function guardar(nuevoVal) {
    setGuardando(true)
    const nuevoEstado = nuevoVal === 100 ? 'completado' : nuevoVal > 0 ? 'en_progreso' : 'no_iniciado'
    await supabase
      .from('project_deliverables')
      .update({ pct_real: nuevoVal, estado: nuevoEstado })
      .eq('id', entregable.id)
    onActualizar()
    setGuardando(false)
  }

  async function toggleSubtarea(subtarea) {
    const nuevoEstado   = subtarea.estado === 'completada' ? 'pendiente' : 'completada'
    const completado_at = nuevoEstado === 'completada' ? new Date().toISOString() : null

    await supabase
      .from('task_subtasks')
      .update({ estado: nuevoEstado, completado_at, actualizado_at: new Date().toISOString() })
      .eq('id', subtarea.id)

    // Recalcular pct_real con el nuevo estado de esta subtarea
    const actualizadas = subtareas.map(s =>
      s.id === subtarea.id ? { ...s, estado: nuevoEstado } : s
    )
    const nuevoPct = calcularPctDesdeSubtareas(actualizadas)
    const nuevoEstadoEntregable = nuevoPct === 100 ? 'completado'
      : nuevoPct > 0 ? 'en_progreso' : 'no_iniciado'

    await supabase
      .from('project_deliverables')
      .update({ pct_real: nuevoPct, estado: nuevoEstadoEntregable })
      .eq('id', entregable.id)

    queryClient.invalidateQueries({ queryKey: ['subtareas', entregable.id] })
    onActualizar()
  }

  async function eliminarSubtarea(subtareaId) {
    await supabase.from('task_subtasks').delete().eq('id', subtareaId)

    const restantes = subtareas.filter(s => s.id !== subtareaId)
    const nuevoPct  = calcularPctDesdeSubtareas(restantes)
    const nuevoEst  = nuevoPct === 100 ? 'completado' : nuevoPct > 0 ? 'en_progreso' : 'no_iniciado'

    await supabase
      .from('project_deliverables')
      .update({ pct_real: nuevoPct, estado: nuevoEst })
      .eq('id', entregable.id)

    queryClient.invalidateQueries({ queryKey: ['subtareas', entregable.id] })
    onActualizar()
  }

  async function crearSubtarea() {
    if (!nuevoNombre.trim()) return
    setErrorSub('')

    if (nuevaFechaInicio && entregable.fecha_inicio && nuevaFechaInicio < entregable.fecha_inicio) {
      setErrorSub(`La fecha de inicio no puede ser anterior al ${entregable.fecha_inicio}`)
      return
    }
    if (nuevaFechaFin && entregable.fecha_fin && nuevaFechaFin > entregable.fecha_fin) {
      setErrorSub(`La fecha de fin no puede ser posterior al ${entregable.fecha_fin}`)
      return
    }
    if (nuevaFechaInicio && nuevaFechaFin && nuevaFechaFin < nuevaFechaInicio) {
      setErrorSub('La fecha de fin no puede ser anterior a la de inicio')
      return
    }

    setGuardandoSub(true)

    const dias = calcularDuracion(nuevaFechaInicio, nuevaFechaFin) ?? 1
    await supabase.from('task_subtasks').insert({
      deliverable_id: entregable.id,
      nombre:         nuevoNombre.trim(),
      responsable_id: nuevoResponsableId || null,
      fecha_inicio:   nuevaFechaInicio   || null,
      fecha_fin:      nuevaFechaFin      || null,
      duracion_dias:  dias,
      prioridad:      nuevaPrioridad,
      estado:         'pendiente',
      orden:          subtareas.length,
    })

    // pct_real con la nueva subtarea pendiente
    const con = [...subtareas, { duracion_dias: dias, prioridad: nuevaPrioridad, estado: 'pendiente' }]
    const nuevoPct = calcularPctDesdeSubtareas(con)
    const nuevoEst = nuevoPct === 100 ? 'completado' : nuevoPct > 0 ? 'en_progreso' : 'no_iniciado'
    await supabase
      .from('project_deliverables')
      .update({ pct_real: nuevoPct, estado: nuevoEst })
      .eq('id', entregable.id)

    setNuevoNombre('')
    setNuevaPrioridad('media')
    setNuevoResponsableId('')
    setNuevaFechaInicio('')
    setNuevaFechaFin('')
    setShowAddForm(false)
    setGuardandoSub(false)

    queryClient.invalidateQueries({ queryKey: ['subtareas', entregable.id] })
    onActualizar()
  }

  return (
    <div className={`mx-3 my-1.5 rounded-xl px-4 py-3.5 transition group
      ${bgEstado}
      ${estado === 'no_iniciado' ? 'opacity-60' : ''}
      hover:brightness-110`}>

      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">

          {/* Nombre + badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-gray-600 font-mono shrink-0">{entregable.edt}</span>
            <p className={`text-sm font-medium truncate ${
              estado === 'completado' ? 'text-gray-500 line-through' : 'text-gray-200'
            }`}>
              {entregable.nombre}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${colorBadge}`}>
              {labelBadge}
            </span>
            <BadgePrioridad prioridad={entregable.prioridad} size="xs" />
          </div>

          {/* Fechas */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-gray-600">
              {new Date(entregable.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(entregable.fecha_fin + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
            </span>
            {entregable.duracion_dias && (
              <span className="text-xs text-gray-700">{entregable.duracion_dias}d</span>
            )}
          </div>

          {/* Responsables */}
          {entregable.project_deliverable_responsables?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {entregable.project_deliverable_responsables.map(r => (
                <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full ${
                  r.rol === 'principal'
                    ? 'bg-blue-900/40 text-blue-300'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {r.user.nombre.split(' ')[0]} · {r.rol === 'principal' ? 'Principal' : 'Apoyo'}
                </span>
              ))}
            </div>
          )}

          {/* Barra doble plan + real */}
          <div className="relative w-full bg-gray-800/80 rounded-full h-1.5 mb-1">
            <div className="absolute top-0 left-0 h-1.5 rounded-full bg-gray-600/50 transition-all duration-500"
              style={{ width: `${pctPlan}%` }} />
            <div className={`absolute top-0 left-0 h-1.5 rounded-full transition-all duration-500 ${colorBarraReal}`}
              style={{ width: `${pctEfectivo}%` }} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Plan {pctPlan}%</span>
            <span className={`text-xs font-medium ${colorTextoReal}`}>Real {pctEfectivo}%</span>
          </div>

          {/* Slider (solo cuando NO hay subtareas) o indicador calculado */}
          {tieneSubtareas ? (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-600 italic">
                % calculado desde {subtareas.length} subtarea{subtareas.length !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="100" step="5"
                value={pctLocal} disabled={guardando}
                onChange={e => setPctLocal(Number(e.target.value))}
                onMouseUp={e  => guardar(Number(e.target.value))}
                onTouchEnd={e => guardar(Number(e.target.value))}
                className="flex-1 disabled:opacity-50"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: `linear-gradient(to right, #3b82f6 ${pctLocal}%, #374151 ${pctLocal}%)`,
                  height: '4px',
                  borderRadius: '9999px',
                  outline: 'none',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  accentColor: '#3b82f6',
                }}
              />
              {esAdmin && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button onClick={onEditar}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onEliminar}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Botones editar/eliminar cuando hay subtareas (fuera del slider row) */}
          {tieneSubtareas && esAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition mb-2">
              <button onClick={onEditar}
                className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onEliminar}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── LISTA DE SUBTAREAS ─────────────────────────────────── */}
          {tieneSubtareas && (
            <div className="mt-2 space-y-1">
              {subtareas.map(sub => {
                const completada = sub.estado === 'completada'
                return (
                  <div
                    key={sub.id}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition
                      ${completada
                        ? 'bg-green-900/10 border border-green-900/20'
                        : 'bg-gray-800/50 border border-gray-800'}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={completada}
                      onChange={() => toggleSubtarea(sub)}
                      className="w-3.5 h-3.5 rounded accent-green-500 shrink-0 cursor-pointer"
                      style={{ accentColor: '#22c55e' }}
                    />

                    {/* Nombre */}
                    <span className={`flex-1 text-xs min-w-0 truncate ${
                      completada ? 'line-through text-gray-600' : 'text-gray-300'
                    }`}>
                      {sub.nombre}
                    </span>

                    {/* Responsable (iniciales) */}
                    {sub.responsable && (
                      <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0"
                        title={sub.responsable.nombre}>
                        {sub.responsable.nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}

                    {/* Badge prioridad */}
                    <BadgePrioridad prioridad={sub.prioridad} size="xs" />

                    {/* Fechas */}
                    {sub.fecha_inicio && sub.fecha_fin && (
                      <span className="text-[10px] text-gray-600 shrink-0 hidden sm:block">
                        {new Date(sub.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(sub.fecha_fin    + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                      </span>
                    )}

                    {/* Eliminar subtarea */}
                    {esAdmin && (
                      <button
                        onClick={() => eliminarSubtarea(sub.id)}
                        className="shrink-0 p-0.5 text-gray-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                        title="Eliminar subtarea"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}

            </div>
          )}

          {/* ── BOTÓN + FORMULARIO AGREGAR SUBTAREA ───────────────── */}
          {esAdmin && (
            <div className={`${tieneSubtareas ? 'mt-2' : 'mt-1'}`}>
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-blue-400
                             transition opacity-0 group-hover:opacity-100"
                >
                  <Plus className="w-3 h-3" />
                  Agregar subtarea
                </button>
              ) : (
                <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-3 space-y-2">
                  {/* Nombre */}
                  <input
                    autoFocus
                    type="text"
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') crearSubtarea(); if (e.key === 'Escape') setShowAddForm(false) }}
                    placeholder="Nombre de la subtarea"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2
                               text-white text-sm focus:outline-none focus:border-blue-500"
                  />

                  {/* Responsable */}
                  <select
                    value={nuevoResponsableId}
                    onChange={e => setNuevoResponsableId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-300 rounded-lg
                               px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sin responsable</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Inicio</label>
                      <CampoFecha
                        value={nuevaFechaInicio}
                        onChange={v => setNuevaFechaInicio(v)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Fin</label>
                      <CampoFecha
                        value={nuevaFechaFin}
                        onChange={v => setNuevaFechaFin(v)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  {nuevaFechaInicio && nuevaFechaFin && (
                    <p className="text-[10px] text-gray-600">
                      Duración: <span className="text-gray-400">{calcularDuracion(nuevaFechaInicio, nuevaFechaFin)} días</span>
                    </p>
                  )}

                  {/* Prioridad */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRIORIDADES_SUB.map(p => {
                      const activa = nuevaPrioridad === p.value
                      const cls = p.value === 'alta'  ? 'bg-red-900/40 border-red-700 text-red-300'
                                : p.value === 'media' ? 'bg-amber-900/40 border-amber-700 text-amber-300'
                                :                       'bg-gray-800 border-gray-600 text-gray-400'
                      return (
                        <button
                          key={p.value} type="button"
                          onClick={() => setNuevaPrioridad(p.value)}
                          className={`py-1.5 rounded-lg border text-xs font-semibold transition
                            ${activa ? cls : 'bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-600'}`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Error de validación de fechas */}
                  {errorSub && (
                    <p className="text-red-400 text-xs">{errorSub}</p>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={crearSubtarea}
                      disabled={!nuevoNombre.trim() || guardandoSub}
                      className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40
                                 text-white text-xs font-semibold py-2 rounded-lg transition"
                    >
                      {guardandoSub ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setNuevoNombre(''); setNuevaPrioridad('media'); setNuevoResponsableId(''); setNuevaFechaInicio(''); setNuevaFechaFin(''); setErrorSub('') }}
                      className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Números protagonistas */}
        <div className="flex flex-col items-end gap-1 shrink-0 min-w-[72px] pt-0.5">
          <span className={`text-2xl font-bold leading-none ${colorTextoReal}`}>
            {guardando ? '…' : `${pctEfectivo}%`}
          </span>
          <span className="text-xs text-gray-600">real</span>
          {cumplEntregable !== null && estado !== 'no_iniciado' && (
            <>
              <span className={`text-sm font-semibold leading-none mt-1 ${colorCumpl}`}>
                {cumplEntregable}%
              </span>
              <span className="text-xs text-gray-600">cumpl.</span>
            </>
          )}
        </div>
      </div>

      {entregable.comentarios && (
        <p className="text-xs text-gray-600 mt-2">{entregable.comentarios}</p>
      )}
    </div>
  )
}

// ─── PROYECTO CARD ────────────────────────────────────────────────────────────
export default function ProyectoCard({ proyecto, onCambio }) {
  const { profile }  = useAuth()
  const [expandido,            setExpandido]            = useState(true)
  const [modalEntregable,      setModalEntregable]      = useState(false)
  const [editandoEntregable,   setEditandoEntregable]   = useState(null)
  const [editandoProyecto,     setEditandoProyecto]     = useState(false)
  const [eliminandoProyecto,   setEliminandoProyecto]   = useState(false)
  const [eliminandoEntregable, setEliminandoEntregable] = useState(null)

  const entregables     = proyecto.project_deliverables ?? []
  const pctPlanProyecto = useMemo(() => calcularPonderado(entregables, 'pct_plan'), [entregables])
  const pctRealProyecto = useMemo(() => calcularPonderado(entregables, 'pct_real'), [entregables])
  const pctTiempo       = calcularPctPlan(proyecto.fecha_inicio, proyecto.fecha_fin)

  const cumplProyecto = pctPlanProyecto > 0
    ? Math.round((pctRealProyecto / pctPlanProyecto) * 100)
    : null

  const colorReal = pctRealProyecto === 100 ? 'text-green-400'
    : pctRealProyecto >= pctPlanProyecto ? 'text-blue-400'
    : pctRealProyecto > 0 ? 'text-amber-400'
    : 'text-gray-500'

  const colorBarraReal = pctRealProyecto === 100 ? 'bg-green-500'
    : pctRealProyecto >= pctPlanProyecto ? 'bg-blue-500'
    : pctRealProyecto > 0 ? 'bg-amber-500'
    : 'bg-gray-700'

  const colorCumpl = cumplProyecto === null ? 'text-gray-500'
    : cumplProyecto >= 100 ? 'text-green-400'
    : cumplProyecto >= 75  ? 'text-amber-400'
    : 'text-red-400'

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

      {/* ── HEADER PROYECTO ─────────────────────────────────────── */}
      <div className="px-6 py-5 cursor-pointer hover:bg-gray-800/40 transition"
        onClick={() => setExpandido(!expandido)}>

        <div className="flex items-start justify-between gap-6 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs text-gray-600 font-mono bg-gray-800 px-2 py-0.5 rounded">
                EDT {proyecto.edt}
              </span>
              <BadgePrioridad prioridad={proyecto.prioridad} />
              {proyecto.responsable && (
                <span className="text-xs text-gray-500">{proyecto.responsable.nombre}</span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base leading-snug mb-1.5">{proyecto.nombre}</h3>
            {proyecto.descripcion && (
              <p className="text-gray-500 text-sm mb-1.5 truncate">{proyecto.descripcion}</p>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500">
                {new Date(proyecto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                {' → '}
                {new Date(proyecto.fecha_fin + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-xs text-gray-600">· {pctTiempo}% del tiempo</span>
            </div>
          </div>

          {/* NÚMEROS PROTAGONISTAS */}
          <div className="flex items-end gap-4 shrink-0">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Real</p>
              <p className={`text-3xl font-bold leading-none ${colorReal}`}>{pctRealProyecto}%</p>
            </div>
            <div className="text-xl text-gray-700 pb-0.5">/</div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Plan</p>
              <p className="text-3xl font-bold leading-none text-gray-400">{pctPlanProyecto}%</p>
            </div>
            {cumplProyecto !== null && (
              <>
                <div className="w-px h-8 bg-gray-800 self-center" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Cumpl. plan</p>
                  <p className={`text-3xl font-bold leading-none ${colorCumpl}`}>{cumplProyecto}%</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Barra */}
        <div className="relative w-full bg-gray-800 rounded-full h-2.5">
          <div className="absolute top-0 left-0 h-2.5 rounded-full bg-gray-600/60 transition-all duration-700"
            style={{ width: `${pctPlanProyecto}%` }} />
          <div className={`absolute top-0 left-0 h-2.5 rounded-full transition-all duration-700 ${colorBarraReal}`}
            style={{ width: `${pctRealProyecto}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-gray-600/60 inline-block rounded" />
              <span className="text-xs text-gray-600">Plan {pctPlanProyecto}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3 h-1 inline-block rounded ${colorBarraReal}`} />
              <span className="text-xs text-gray-500">Real {pctRealProyecto}%</span>
            </div>
          </div>
          {expandido
            ? <ChevronUp className="w-4 h-4 text-gray-600" />
            : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {/* ── ENTREGABLES ─────────────────────────────────────────── */}
      {expandido && (
        <div className="border-t border-gray-800">
          {entregables.length === 0 ? (
            <div className="px-6 py-6 text-center text-gray-600 text-sm">Sin entregables aún</div>
          ) : (
            <div className="py-2">
              {[...entregables]
                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                
                .map(entregable => (
                  <EntregableRow
                    key={entregable.id}
                    entregable={entregable}
                    onActualizar={onCambio}
                    onEditar={() => setEditandoEntregable(entregable)}
                    onEliminar={() => setEliminandoEntregable(entregable)}
                    esAdmin={profile?.rol === 'admin'}
                  />
                ))}
            </div>
          )}

          {profile?.rol === 'admin' && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={e => { e.stopPropagation(); setModalEntregable(true) }}
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition">
                <Plus className="w-4 h-4" />
                Agregar entregable
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={e => { e.stopPropagation(); setEditandoProyecto(true) }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition">
                  <Pencil className="w-3.5 h-3.5" />
                  Editar proyecto
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEliminandoProyecto(true) }}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODALES ─────────────────────────────────────────────── */}
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
