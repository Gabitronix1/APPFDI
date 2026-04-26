import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Users, CheckCircle2, Clock, AlertCircle, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import TaskModal from '../components/TaskModal'
import NuevaTareaModal from '../components/NuevaTareaModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const ESTADO_STYLES = {
  pendiente:             { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  en_progreso:           { badge: 'bg-blue-800 text-blue-300',     label: 'En progreso' },
  completada:            { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Completada con atraso' },
  con_atraso:            { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
  fuera_de_plazo:        { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' },
}

const ALERTA_BORDER = {
  ok:             'border-gray-800',
  por_vencer:     'border-amber-500',
  fuera_de_plazo: 'border-red-500',
}

export default function DetalleDepto() {
  const { depto }    = useParams()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const deptoNombre  = decodeURIComponent(depto)

  const [tareaActiva, setTareaActiva]     = useState(null)
  const [tareaDetalle, setTareaDetalle]   = useState(null)
  const [mostrarNueva, setMostrarNueva]   = useState(false)
  const [filtroPersona, setFiltroPersona] = useState('todas')

  // Ciclo activo
  const { data: cicloActivo } = useQuery({
    queryKey: ['ciclo-activo-depto', deptoNombre],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('estado', 'activo')
        .single()
      return data
    }
  })

  // Tareas del depto
  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas-depto', deptoNombre, cicloActivo?.id],
    enabled: !!cicloActivo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloActivo.id)
        .eq('departamento', deptoNombre)
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  // Usuarios del depto
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-depto', deptoNombre],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, nombre, cargo, rol')
        .eq('departamento', deptoNombre)
        .eq('activo', true)
        .order('nombre')
      return data ?? []
    }
  })

  const tareasFiltradas = tareas.filter(t =>
    filtroPersona === 'todas' || t.responsable_nombre === filtroPersona
  )

  const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const pendientes  = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const atrasadas   = tareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
  const pct         = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0

  function onCompletada() {
    queryClient.invalidateQueries({ queryKey: ['tareas-depto', deptoNombre, cicloActivo?.id] })
    queryClient.invalidateQueries({ queryKey: ['tareas-gerente'] })
    setTareaActiva(null)
  }

  const tituloCiclo = cicloActivo
    ? `${MESES[cicloActivo.mes - 1]} ${cicloActivo.anio}`
    : ''

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/gerente')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{deptoNombre}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {tituloCiclo} · {usuarios.length} integrantes · {tareas.length} tareas
          </p>
        </div>
        <button
          onClick={() => setMostrarNueva(true)}
          className="ml-auto flex items-center gap-2 bg-green-700 hover:bg-green-600
                     text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva tarea</span>
        </button>
      </div>

      {/* Resumen */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-semibold">Avance del departamento</h2>
          <span className={`text-2xl font-bold ${
            pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
          }`}>{pct}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-3">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-6">
          <span className="text-xs text-green-400">✓ {completadas} completadas</span>
          <span className="text-xs text-amber-400">⏳ {pendientes} pendientes</span>
          {atrasadas > 0 && <span className="text-xs text-red-400">⚠ {atrasadas} atrasadas</span>}
        </div>
      </div>

      {/* Integrantes */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-400" />
          <h2 className="text-white font-medium text-sm">Integrantes</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroPersona('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${filtroPersona === 'todas' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Todos
          </button>
          {usuarios.map(u => (
            <button
              key={u.id}
              onClick={() => setFiltroPersona(u.nombre)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filtroPersona === u.nombre ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {u.nombre.split(' ')[0]}
              {u.rol === 'admin' && <span className="ml-1 text-blue-300">★</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Lista tareas */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No hay tareas</div>
      ) : (
        <div className="space-y-3">
          {tareasFiltradas.map(tarea => {
            const esFueraPlazo = tarea.alerta === 'fuera_de_plazo' && tarea.estado !== 'completada'
            const estilos = esFueraPlazo
              ? ESTADO_STYLES.fuera_de_plazo
              : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente
            const borde = ALERTA_BORDER[tarea.alerta] ?? 'border-gray-800'
            const esCompletada = tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada'

            return (
              <div
                key={tarea.id}
                onClick={() => esCompletada ? setTareaDetalle(tarea) : setTareaActiva(tarea)}
                className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4
                  cursor-pointer hover:bg-gray-800 transition ${esCompletada ? 'opacity-70' : ''}`}
              >
                <div className="shrink-0">
                  {tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : esFueraPlazo
                    ? <AlertCircle className="w-5 h-5 text-orange-400" />
                    : tarea.estado === 'con_atraso'
                    ? <AlertCircle className="w-5 h-5 text-red-400" />
                    : <Clock className="w-5 h-5 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {tarea.template_id
                      ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                      : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                    <p className="text-white font-medium truncate">{tarea.nombre_tarea}</p>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {tarea.responsable_nombre} · {tarea.area} · Vence {tarea.fecha_termino}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tarea.total_evidencias > 0 && (
                    <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>
                    {estilos.label}
                  </span>
                </div>
              </div>
            )
          })}
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

      {mostrarNueva && cicloActivo && (
        <NuevaTareaModal
          cicloSeleccionado={cicloActivo}
          departamentoForzado={deptoNombre} 
          onClose={() => setMostrarNueva(false)}
          onCreada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas-depto', deptoNombre, cicloActivo?.id] })
            queryClient.invalidateQueries({ queryKey: ['tareas-gerente'] })
            setMostrarNueva(false)
          }}
        />
      )}
    </div>
  )
}
