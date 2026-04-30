import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Users, ChevronRight, ChevronLeft, ChevronDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import React, { useState } from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

function BarraDepto({ pct }) {
  const color = pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500'
  const texto = pct === 100 ? 'text-green-400' : pct > 60 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold w-10 text-right shrink-0 ${texto}`}>{pct}%</span>
    </div>
  )
}

export default function DashboardGerente() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  // Traer todos los ciclos
  const { data: ciclos = [] } = useQuery({
    queryKey: ['ciclos-gerente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_cycles')
        .select('*')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
      if (error) throw error
      return data ?? []
    }
  })

  // Ciclo seleccionado — por defecto el activo
  const cicloActivo = ciclos.find(c => c.estado === 'activo') ?? ciclos[0]
  const [cicloSeleccionado, setCicloSeleccionado] = useState(null)
  const ciclo = cicloSeleccionado ?? cicloActivo

  const idx      = ciclos.findIndex(c => c.id === ciclo?.id)
  const anterior = ciclos[idx + 1] ?? null
  const siguiente = ciclos[idx - 1] ?? null

  // Tareas del ciclo seleccionado
  const { data: todasTareas = [], isLoading } = useQuery({
    queryKey: ['tareas-gerente', ciclo?.id],
    enabled: !!ciclo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', ciclo.id)
      if (error) throw error
      return data ?? []
    }
  })

  // Usuarios agrupados por depto
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-gerente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, departamento, rol, activo')
        .eq('activo', true)
        .neq('rol', 'gerente')
        .order('departamento')
      if (error) throw error
      return data ?? []
    }
  })

  const deptos = usuarios.reduce((acc, u) => {
    if (!acc[u.departamento]) acc[u.departamento] = []
    acc[u.departamento].push(u)
    return acc
  }, {})

  function metricasDepto(depto) {
    const tareas      = todasTareas.filter(t => t.departamento === depto)
    const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
    const pendientes  = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
    const atrasadas   = tareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
    const pct         = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0
    return { tareas: tareas.length, completadas, pendientes, atrasadas, pct }
  }

  const totalTareas      = todasTareas.length
  const totalCompletadas = todasTareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const totalPendientes  = todasTareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const totalAtrasadas   = todasTareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
  const pctGlobal        = totalTareas ? Math.round((totalCompletadas / totalTareas) * 100) : 0

  const tituloCiclo = ciclo ? nombreCierre(ciclo.mes, ciclo.anio) : ''
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 bg-blue-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">
              Hola, {profile?.nombre?.split(' ')[0]} 👋
            </h1>
          </div>
          <p className="text-gray-400 text-sm ml-5">Vista gerencial · Resumen por departamento</p>
        </div>

        {/* Selector ciclo */}
        {ciclo && (
          <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1 shrink-0">
            <button
              onClick={() => anterior && setCicloSeleccionado(anterior)}
              disabled={!anterior}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700
                         transition disabled:opacity-30 disabled:cursor-not-allowed"
              title={anterior ? `← ${nombreCierre(anterior.mes, anterior.anio)}` : ''}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-medium text-white min-w-[130px] text-center">
              {tituloCiclo}
              {ciclo.estado === 'activo'
                ? <span className="ml-2 text-xs text-green-400">● activo</span>
                : <span className="ml-2 text-xs text-gray-500">● cerrado</span>}
            </span>
            <button
              onClick={() => siguiente && setCicloSeleccionado(siguiente)}
              disabled={!siguiente}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700
                         transition disabled:opacity-30 disabled:cursor-not-allowed"
              title={siguiente ? `${nombreCierre(siguiente.mes, siguiente.anio)} →` : ''}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Barra progreso global */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-white font-semibold">Avance global de la empresa</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {Object.keys(deptos).length} departamentos · {totalTareas} tareas en total
            </p>
          </div>
          <span className={`text-3xl font-bold ${
            pctGlobal === 100 ? 'text-green-400' : pctGlobal > 60 ? 'text-amber-400' : 'text-red-400'
          }`}>{pctGlobal}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${
              pctGlobal === 100 ? 'bg-green-500' : pctGlobal > 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${pctGlobal}%` }}
          />
        </div>
        <div className="flex gap-6 mt-3">
          <span className="text-xs text-green-400">✓ {totalCompletadas} completadas</span>
          <span className="text-xs text-amber-400">⏳ {totalPendientes} pendientes</span>
          <span className="text-xs text-red-400">⚠ {totalAtrasadas} atrasadas</span>
        </div>
      </div>

      {/* Cards por departamento */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(deptos).map(([depto, miembros]) => {
            const m    = metricasDepto(depto)
            const jefe = miembros.find(u => u.rol === 'admin')

            return (
              <div
                key={depto}
                onClick={() => navigate(`/gerente/depto/${encodeURIComponent(depto)}`, {
                  state: { cicloId: ciclo?.id }
                })}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600
                           rounded-2xl p-6 cursor-pointer transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-blue-900 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-blue-300" />
                      </div>
                      <h3 className="text-white font-semibold">{depto}</h3>
                    </div>
                    <p className="text-gray-500 text-xs ml-10">
                      {jefe ? `Jefe: ${jefe.nombre}` : 'Sin jefe asignado'} · {miembros.length} personas
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-300 transition shrink-0" />
                </div>

                <BarraDepto pct={m.pct} />

                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-gray-400">{m.completadas} completadas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs text-gray-400">{m.pendientes} pendientes</span>
                  </div>
                  {m.atrasadas > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs text-red-400">{m.atrasadas} atrasadas</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-600">
                    {tituloCiclo} · {m.tareas} tareas
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
