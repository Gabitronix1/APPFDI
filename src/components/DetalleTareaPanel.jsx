import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { X, CheckCircle2, Clock, AlertCircle, Download, FileText, Image, FileSpreadsheet, File, RefreshCw, Sparkles, Pencil, Save, MessageSquare, Send, Trash2, Link2 } from 'lucide-react'

function getIconoArchivo(tipo) {
  switch (tipo) {
    case 'imagen': return <Image className="w-4 h-4 text-blue-400" />
    case 'pdf':    return <FileText className="w-4 h-4 text-red-400" />
    case 'excel':  return <FileSpreadsheet className="w-4 h-4 text-green-400" />
    default:       return <File className="w-4 h-4 text-gray-400" />
  }
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const ESTADO_CONFIG = {
  completada:            { color: 'text-green-400',  bg: 'bg-green-900/30 border-green-800',   icono: CheckCircle2, label: 'Completada' },
  completada_con_atraso: { color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800', icono: Clock,        label: 'Entregada' },
  con_atraso:            { color: 'text-red-400',    bg: 'bg-red-900/30 border-red-800',       icono: AlertCircle,  label: 'Atrasada' },
  no_completada:         { color: 'text-gray-500',   bg: 'bg-gray-800/50 border-gray-700',     icono: AlertCircle,  label: 'No completada' },
  pendiente:             { color: 'text-gray-400',   bg: 'bg-gray-800/50 border-gray-700',     icono: Clock,        label: 'Pendiente' },
}

function CondicionBadge({ condicion, frecuencia }) {
  if (frecuencia === 'semanal' || frecuencia === 'quincenal') return null
  if (condicion === 'habil')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-900/50 text-blue-300">Día hábil</span>
  if (condicion === 'dia_real')
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-800 text-gray-500">Día cal.</span>
  return null
}

// ─── COMPONENTE DE AJUSTE DE CALIFICACIÓN ─────────────────────────────────────
function AjusteCalificacion({ comp, tareaId, onGuardado }) {
  const { user } = useAuth()
  const [abierto, setAbierto]         = useState(false)
  const [nuevoPct, setNuevoPct]       = useState(comp.porcentaje_cumplimiento ?? 100)
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando]     = useState(false)
  const [exito, setExito]             = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('task_completions')
        .update({
          porcentaje_cumplimiento: nuevoPct,
          ajustado_por:            user.id,
          ajustado_at:             new Date().toISOString(),
          observacion_ajuste:      observacion.trim() || null,
        })
        .eq('id', comp.id)

      if (error) throw error

      const nuevoEstado = nuevoPct === 100 ? 'completada' : 'completada_con_atraso'
      await supabase
        .from('tasks')
        .update({ estado: nuevoEstado })
        .eq('id', tareaId)
      setExito(true)
      setAbierto(false)
      setTimeout(() => { setExito(false); onGuardado() }, 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition mt-2"
        title="Ajustar calificación"
      >
        <Pencil className="w-3 h-3" />
        {exito ? <span className="text-green-400">¡Guardado!</span> : 'Ajustar calificación'}
        {comp.ajustado_at && !exito && (
          <span className="text-gray-600 ml-1">· ajustado anteriormente</span>
        )}
      </button>
    )
  }

  return (
    <div className="mt-3 bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 space-y-3">
      <p className="text-amber-300 text-xs font-medium">Ajustar calificación</p>

      {/* Selector % */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">Nuevo %</span>
          <span className={`text-sm font-bold ${
            nuevoPct === 100 ? 'text-green-400'
            : nuevoPct >= 80  ? 'text-amber-400'
            : nuevoPct >= 50  ? 'text-orange-400'
            : 'text-red-400'
          }`}>{nuevoPct}%</span>
        </div>
        <input
          type="range"
          min="0" max="100" step="5"
          value={nuevoPct}
          onChange={e => setNuevoPct(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs text-gray-700 mt-0.5">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* Observación opcional */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Observación <span className="text-gray-600">(opcional)</span>
        </label>
        <textarea
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          rows={2}
          placeholder="Ej: Entrega incompleta, faltó adjuntar el informe..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2
                     text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setAbierto(false)}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                     py-2 rounded-lg text-xs transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="flex-1 flex items-center justify-center gap-1.5 bg-amber-700
                     hover:bg-amber-600 text-white py-2 rounded-lg text-xs
                     font-semibold transition disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {guardando ? 'Guardando...' : 'Guardar ajuste'}
        </button>
      </div>
    </div>
  )
}

// ─── PANEL PRINCIPAL ───────────────────────────────────────────────────────────
export default function DetalleTareaPanel({ tarea, onClose }) {
  const { profile, deptosAsignados }  = useAuth()
  const queryClient  = useQueryClient()
  const esAdminOGerente = profile?.rol === 'admin' || profile?.rol === 'gerente' ||
    (profile?.rol === 'subgerente' && deptosAsignados.includes(tarea.departamento))

  const { data: completaciones = [], isLoading: loadingComp } = useQuery({
    queryKey: ['completaciones', tarea.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('task_id', tarea.id)
        .order('fecha_completado', { ascending: false })
      if (error) throw error

      const ids = [...new Set(data.map(c => c.completado_por).filter(Boolean))]
      if (ids.length === 0) return data

      const { data: usuarios } = await supabase
        .from('users').select('id, nombre').in('id', ids)

      return data.map(c => ({
        ...c,
        completado_por_user: usuarios?.find(u => u.id === c.completado_por) ?? null
      }))
    }
  })

  const { data: evidencias = [], isLoading: loadingEv } = useQuery({
    queryKey: ['evidencias', tarea.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidencias').select('*')
        .eq('task_id', tarea.id)
        .order('subido_at', { ascending: false })
      if (error) throw error

      const ids = [...new Set(data.map(e => e.subido_por).filter(Boolean))]
      if (ids.length === 0) return data

      const { data: usuarios } = await supabase
        .from('users').select('id, nombre').in('id', ids)

      return data.map(e => ({
        ...e,
        subido_por_user: usuarios?.find(u => u.id === e.subido_por) ?? null
      }))
    }
  })

  const cfg   = ESTADO_CONFIG[tarea.estado] ?? ESTADO_CONFIG.con_atraso
  const Icono = cfg.icono

  function onAjusteGuardado() {
    queryClient.invalidateQueries({ queryKey: ['completaciones', tarea.id] })
    queryClient.invalidateQueries({ queryKey: ['tareas', tarea.ciclo_id] })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {tarea.template_id
                ? <RefreshCw className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                : <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span className="text-xs text-gray-500">
                {tarea.template_id ? 'Tarea recurrente' : 'Tarea del ciclo'}
              </span>
            </div>
            <h2 className="text-white font-semibold text-lg leading-tight">
              {tarea.nombre_tarea}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {tarea.area} · {tarea.responsable_nombre}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Estado */}
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${cfg.bg}`}>
            <Icono className={`w-5 h-5 ${cfg.color} shrink-0`} />
            <div>
              <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-gray-500 text-xs">Fecha límite: {tarea.fecha_termino}</p>
                <CondicionBadge condicion={tarea.condicion} frecuencia={tarea.frecuencia} />
              </div>
            </div>
          </div>

          {/* Historial */}
          <div>
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Historial de completación
            </h3>

            {loadingComp ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : completaciones.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-sm">Sin registros de completación</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completaciones.map(comp => (
                  <div key={comp.id} className="bg-gray-800/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-900 flex items-center justify-center shrink-0">
                          <span className="text-green-300 text-xs font-bold">
                            {comp.completado_por_user?.nombre?.split(' ').map(n => n.charAt(0)).join('').slice(0,2) ?? '?'}
                          </span>
                        </div>
                        <span className="text-gray-300 text-sm font-medium">
                          {comp.completado_por_user?.nombre ?? 'Usuario'}
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        comp.porcentaje_cumplimiento === 100 ? 'bg-green-900 text-green-300'
                        : comp.porcentaje_cumplimiento >= 80  ? 'bg-amber-900 text-amber-300'
                        : comp.porcentaje_cumplimiento >= 50  ? 'bg-orange-900 text-orange-300'
                        : 'bg-red-900 text-red-300'
                      }`}>
                        {comp.porcentaje_cumplimiento}%
                      </span>
                    </div>

                    <p className="text-gray-400 text-xs mb-2">{formatFecha(comp.fecha_completado)}</p>

                    {comp.comentario && (
                      <div className="bg-gray-900/60 rounded-lg px-3 py-2 mb-2">
                        <p className="text-gray-300 text-sm italic">"{comp.comentario}"</p>
                      </div>
                    )}

                    {/* Observación de ajuste si existe */}
                    {comp.observacion_ajuste && (
                      <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2 mb-2">
                        <p className="text-amber-400 text-xs font-medium mb-0.5">Ajuste de calificación</p>
                        <p className="text-amber-200 text-xs">{comp.observacion_ajuste}</p>
                      </div>
                    )}

                    {/* Botón ajustar — solo admin/gerente y si la tarea está completada */}
                    {esAdminOGerente && (
                      tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
                    ) && (
                      <AjusteCalificacion
                        comp={comp}
                        tareaId={tarea.id}
                        onGuardado={onAjusteGuardado}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidencias */}
          <div>
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <File className="w-4 h-4 text-blue-400" />
              Evidencias
              {evidencias.length > 0 && (
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {evidencias.length}
                </span>
              )}
            </h3>

            {loadingEv ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : evidencias.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-sm">Sin evidencias adjuntas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {evidencias.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-3">
                    <div className="shrink-0">{getIconoArchivo(ev.tipo_archivo)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm truncate">{ev.nombre_archivo}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {ev.subido_por_user?.nombre ?? 'Usuario'} · {formatBytes(ev.tamanio_bytes)}
                      </p>
                    </div>
                    <a
                      href={ev.url_storage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones de la tarea */}
          {tarea.observaciones && (
            <div>
              <h3 className="text-white font-medium text-sm mb-2">Observaciones</h3>
              <p className="text-gray-400 text-sm bg-gray-800/50 rounded-xl px-4 py-3">
                {tarea.observaciones}
              </p>
            </div>
          )}

          {/* ── COMENTARIOS ──────────────────────────────────────── */}
          <SeccionComentarios tareaId={tarea.id} profile={profile} esAdmin={esAdminOGerente} />

          {/* ── DEPENDENCIAS ─────────────────────────────────────── */}
          <SeccionDependencias tarea={tarea} />

        </div>
      </div>
    </>
  )
}

// ─── SECCIÓN COMENTARIOS ───────────────────────────────────────────────────────
function SeccionComentarios({ tareaId, profile, esAdmin }) {
  const queryClient  = useQueryClient()
  const [texto, setTexto]       = useState('')
  const [enviando, setEnviando] = useState(false)

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey: ['comentarios', tareaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*, autor:users(id, nombre)')
        .eq('task_id', tareaId)
        .order('creado_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    await supabase.from('task_comments').insert({
      task_id: tareaId,
      user_id: profile.id,
      texto:   t,
    })
    setTexto('')
    setEnviando(false)
    queryClient.invalidateQueries({ queryKey: ['comentarios', tareaId] })
  }

  async function eliminar(comentarioId) {
    await supabase.from('task_comments').delete().eq('id', comentarioId)
    queryClient.invalidateQueries({ queryKey: ['comentarios', tareaId] })
  }

  function iniciales(nombre) {
    if (!nombre) return '?'
    return nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-400" />
        Comentarios
        {comentarios.length > 0 && (
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
            {comentarios.length}
          </span>
        )}
      </h3>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comentarios.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-center mb-3">
          <p className="text-gray-500 text-sm">Sin comentarios aún</p>
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {comentarios.map(c => {
            const esMio    = c.user_id === profile?.id
            const puedeEliminar = esMio || esAdmin
            return (
              <div key={c.id} className="flex items-start gap-2.5 group">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-300">
                    {iniciales(c.autor?.nombre)}
                  </span>
                </div>

                {/* Burbuja */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-medium text-gray-300 truncate">
                      {c.autor?.nombre ?? 'Usuario'}
                    </span>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(c.creado_at).toLocaleDateString('es-CL', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2">
                    <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">{c.texto}</p>
                  </div>
                </div>

                {/* Eliminar */}
                {puedeEliminar && (
                  <button
                    onClick={() => eliminar(c.id)}
                    className="shrink-0 mt-1 p-1 text-gray-700 hover:text-red-400 transition
                               opacity-0 group-hover:opacity-100"
                    title="Eliminar comentario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Input nuevo comentario */}
      <div className="flex items-end gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mb-0.5">
          <span className="text-[10px] font-bold text-gray-300">
            {iniciales(profile?.nombre)}
          </span>
        </div>
        <div className="flex-1 flex items-end gap-2 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2
                        focus-within:border-blue-600 transition">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
            }}
            placeholder="Escribe un comentario… (Enter para enviar)"
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600
                       focus:outline-none resize-none leading-5"
            style={{ maxHeight: '96px', overflowY: 'auto' }}
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className="shrink-0 p-1 text-blue-500 hover:text-blue-400 disabled:text-gray-700 transition"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SECCIÓN DEPENDENCIAS ──────────────────────────────────────────────────────
function iconoEstadoDep(estado) {
  if (estado === 'completada' || estado === 'completada_con_atraso')
    return <span className="text-green-400" title="Completada">✅</span>
  if (estado === 'con_atraso')
    return <span className="text-red-400" title="Atrasada">🔴</span>
  return <span className="text-gray-400" title="Pendiente">⏳</span>
}

function labelEstadoDep(estado) {
  if (estado === 'completada')             return 'Completada'
  if (estado === 'completada_con_atraso')  return 'Entregada'
  if (estado === 'con_atraso')             return 'Atrasada'
  if (estado === 'no_completada')          return 'No completada'
  return 'Pendiente'
}

function SeccionDependencias({ tarea }) {
  const { data: misDepends = [], isLoading: loadingMisDep } = useQuery({
    queryKey: ['task-deps-mis', tarea.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          id, tipo, impacto_atraso,
          depends_on:depends_on_id(
            id, nombre_tarea, estado, departamento, fecha_termino
          )
        `)
        .eq('task_id', tarea.id)
      if (error) throw error
      return data ?? []
    }
  })

  const { data: dependenDeEsta = [], isLoading: loadingDeEsta } = useQuery({
    queryKey: ['task-deps-de-esta', tarea.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          id, tipo,
          tarea:task_id(id, nombre_tarea, estado, departamento)
        `)
        .eq('depends_on_id', tarea.id)
      if (error) throw error
      return data ?? []
    }
  })

  const loading = loadingMisDep || loadingDeEsta
  if (loading) return null
  if (misDepends.length === 0 && dependenDeEsta.length === 0) return null

  return (
    <div>
      <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-green-400" />
        Dependencias
      </h3>

      {misDepends.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">🔗 Esta tarea hace referencia a:</p>
          <div className="space-y-2">
            {misDepends.map(d => {
              const dep = d.depends_on
              if (!dep) return null
              const completada = dep.estado === 'completada' || dep.estado === 'completada_con_atraso'
              const pendiente  = dep.estado === 'pendiente' || dep.estado === 'con_atraso'
              return (
                <div
                  key={d.id}
                  className="bg-gray-800/50 border border-gray-800 rounded-xl p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">{iconoEstadoDep(dep.estado)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{dep.nombre_tarea}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                          {dep.departamento}
                        </span>
                        {dep.fecha_termino && (
                          <span className="text-xs text-gray-600">📅 {dep.fecha_termino}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {completada && d.impacto_atraso > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-900/60 text-amber-300">
                            ⚠️ Completada con {d.impacto_atraso}d de atraso
                          </span>
                        )}
                        {pendiente && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-900/60 text-blue-300">
                            ⏳ {labelEstadoDep(dep.estado)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dependenDeEsta.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">📌 Tareas que usan esta como referencia:</p>
          <div className="space-y-1">
            {dependenDeEsta.map(d => {
              const t = d.tarea
              if (!t) return null
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-2 bg-gray-800/40 border border-gray-800 rounded-lg px-3 py-2"
                >
                  <span className="text-sm leading-none">{iconoEstadoDep(t.estado)}</span>
                  <span className="text-sm text-gray-200 truncate flex-1">{t.nombre_tarea}</span>
                  <span className="text-xs text-gray-500 shrink-0">·</span>
                  <span className="text-xs text-gray-400 shrink-0">{t.departamento}</span>
                  <span className="text-xs text-gray-500 shrink-0">·</span>
                  <span className="text-xs text-gray-400 shrink-0">{labelEstadoDep(t.estado)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
