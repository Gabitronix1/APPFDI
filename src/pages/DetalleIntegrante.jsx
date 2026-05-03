import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, CheckCircle2, Clock, AlertCircle, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import TaskModal from '../components/TaskModal'
import DetalleTareaPanel from '../components/DetalleTareaPanel'
import { useQueryClient } from '@tanstack/react-query'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

const ESTADO_STYLES = {
  pendiente:             { badge: 'bg-gray-700 text-gray-300',     label: 'Pendiente' },
  con_atraso:            { badge: 'bg-red-900 text-red-300',       label: 'Atrasada' },
  completada:            { badge: 'bg-green-800 text-green-300',   label: 'Completada' },
  completada_con_atraso: { badge: 'bg-yellow-900 text-yellow-300', label: 'Entregada' },
  no_completada:         { badge: 'bg-gray-800 text-gray-500',     label: 'No completada' },
}

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const color = pct === 100 ? 'bg-green-900 text-green-300'
    : pct >= 80 ? 'bg-amber-900 text-amber-300'
    : pct >= 50 ? 'bg-orange-900 text-orange-300'
    : 'bg-red-900 text-red-300'
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{pct}%</span>
}

function TareaItem({ tarea, onClick, esCicloCerrado }) {
  const esFueraPlazo = !esCicloCerrado &&
    tarea.alerta === 'fuera_de_plazo' &&
    tarea.estado !== 'completada' &&
    tarea.estado !== 'completada_con_atraso'
  const estilos = esFueraPlazo
    ? { badge: 'bg-orange-900 text-orange-300', label: 'Fuera de plazo' }
    : ESTADO_STYLES[tarea.estado] ?? ESTADO_STYLES.pendiente
  const borde = esCicloCerrado
    ? 'border-gray-800'
    : {
    ok:             'border-gray-800',
    por_vencer:     'border-amber-500',
    fuera_de_plazo: 'border-red-500',
  }[tarea.alerta] ?? 'border-gray-800'

  const pct = tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
    ? (tarea.porcentaje_cumplimiento ?? 100) : null

  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border ${borde} rounded-xl p-4 flex items-center gap-4
        cursor-pointer hover:bg-gray-800 transition`}
    >
      <div className="shrink-0">
        {tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso'
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : tarea.estado === 'con_atraso' && !esCicloCerrado
          ? <AlertCircle className="w-5 h-5 text-red-400" />
          : tarea.estado === 'no_completada' || tarea.estado === 'con_atraso'
          ? <AlertCircle className="w-5 h-5 text-gray-500" />
          : <Clock className="w-5 h-5 text-gray-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {tarea.template_id
            ? <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
            : <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
          <p className="text-white text-sm font-medium truncate">{tarea.nombre_tarea}</p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">{tarea.area} · Vence {tarea.fecha_termino}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tarea.total_evidencias > 0 && (
          <span className="text-xs text-gray-500">{tarea.total_evidencias} 📎</span>
        )}
        {pct !== null
          ? <PctBadge pct={pct} />
          : <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estilos.badge}`}>{estilos.label}</span>
        }
      </div>
    </div>
  )
}

export default function DetalleIntegrante() {
  const { nombre }   = useParams()
  const navigate     = useNavigate()
  const location     = useLocation()
  const queryClient  = useQueryClient()
  const { profile }  = useAuth()
  const nombreReal   = decodeURIComponent(nombre)
  const cicloId      = location.state?.cicloId

  const [tareaActiva, setTareaActiva]   = useState(null)
  const [tareaDetalle, setTareaDetalle] = useState(null)

  // Ciclo activo
  const { data: ciclo } = useQuery({
    queryKey: ['ciclo-activo'],
    queryFn: async () => {
      if (cicloId) {
        const { data } = await supabase
          .from('monthly_cycles').select('*').eq('id', cicloId).single()
        return data
      }
      const { data } = await supabase
        .from('monthly_cycles').select('*').eq('estado', 'activo').single()
      return data
    }
  })

  // Tareas del integrante
  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas-integrante', nombreReal, ciclo?.id],
    enabled: !!ciclo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', ciclo.id)
        .eq('responsable_nombre', nombreReal)
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  const tareasCierre      = tareas.filter(t => t.template_id)
  const tareasAdicionales = tareas.filter(t => !t.template_id)

  const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const pct         = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0

  // Promedio de responsabilidad
  const tareasConDato = tareas.filter(t =>
    t.estado === 'completada' || t.estado === 'completada_con_atraso' ||
    t.estado === 'no_completada' || t.estado === 'con_atraso'
  )
  const promedio = tareasConDato.length
    ? Math.round(tareasConDato.reduce((s, t) => {
        if (t.estado === 'completada' || t.estado === 'completada_con_atraso')
          return s + (t.porcentaje_cumplimiento ?? 100)
        return s
      }, 0) / tareasConDato.length)
    : null

  const tituloCiclo = ciclo ? nombreCierre(ciclo.mes, ciclo.anio) : ''
  const iniciales   = nombreReal.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)
  const colorPct    = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
  const colorBarra  = pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'

  function handleClickTarea(tarea) {
    if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso' || tarea.estado === 'no_completada' || tarea.estado === 'con_atraso') {
      setTareaDetalle(tarea)
    } else {
      setTareaActiva(tarea)
    }
  }

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

        {/* Avatar + nombre */}
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center shrink-0">
            <span className="text-blue-300 text-lg font-bold">{iniciales}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{nombreReal}</h1>
            <p className="text-gray-400 text-sm">{tituloCiclo} · {tareas.length} tareas</p>
          </div>
        </div>

        {/* % promedio responsabilidad */}
        {promedio !== null && (
          <div className="text-right shrink-0">
            <p className={`text-3xl font-bold ${colorPct}`}>{promedio}%</p>
            <p className="text-gray-600 text-xs">responsabilidad</p>
          </div>
        )}
      </div>

      {/* Barra progreso */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-semibold">Avance general</h2>
          <span className={`text-2xl font-bold ${colorPct}`}>{pct}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-2">
          <div className={`h-3 rounded-full transition-all duration-700 ${colorBarra}`}
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          {completadas} de {tareas.length} tareas completadas
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Tareas del cierre */}
          {tareasCierre.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-semibold text-sm">Tareas recurrentes</h3>
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {tareasCierre.length}
                </span>
              </div>
              <div className="space-y-3">
                {tareasCierre.map(tarea => (
                  <TareaItem key={tarea.id} tarea={tarea} 
                    esCicloCerrado={ciclo?.estado === 'cerrado'}
                    onClick={() => handleClickTarea(tarea)} />
                ))}
              </div>
            </div>
          )}

          {/* Tareas adicionales */}
          {tareasAdicionales.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">
                  Tareas de {MESES[new Date().getMonth()]} {new Date().getFullYear()}
                </h3>
                <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                  {tareasAdicionales.length}
                </span>
              </div>
              <div className="space-y-3">
                {tareasAdicionales.map(tarea => (
                  <TareaItem key={tarea.id} tarea={tarea} 
                    esCicloCerrado={ciclo?.estado === 'cerrado'}
                    onClick={() => handleClickTarea(tarea)} />
                ))}
              </div>
            </div>
          )}

          {tareas.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              Sin tareas asignadas en este cierre
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {tareaActiva && (
        <TaskModal
          tarea={tareaActiva}
          onClose={() => setTareaActiva(null)}
          onCompletada={() => {
            queryClient.invalidateQueries({ queryKey: ['tareas-integrante', nombreReal, ciclo?.id] })
            setTareaActiva(null)
          }}
        />
      )}
      {tareaDetalle && (
        <DetalleTareaPanel tarea={tareaDetalle} onClose={() => setTareaDetalle(null)} />
      )}
    </div>
  )
}
