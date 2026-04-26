import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ChevronRight, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

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

  // Traer todos los ciclos activos
  const { data: ciclosActivos = [] } = useQuery({
    queryKey: ['ciclos-activos-gerente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('estado', 'activo')
        .order('mes', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })

  // Traer todas las tareas de ciclos activos
  const { data: todasTareas = [], isLoading } = useQuery({
    queryKey: ['tareas-gerente'],
    enabled: ciclosActivos.length > 0,
    queryFn: async () => {
      const cicloIds = ciclosActivos.map(c => c.id)
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .in('ciclo_id', cicloIds)
      if (error) throw error
      return data ?? []
    }
  })

  // Traer todos los usuarios agrupados por depto
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

  // Agrupar por departamento
  const deptos = usuarios.reduce((acc, u) => {
    if (!acc[u.departamento]) acc[u.departamento] = []
    acc[u.departamento].push(u)
    return acc
  }, {})

  // Calcular métricas por depto
  function metricasDepto(depto) {
    const tareas      = todasTareas.filter(t => t.departamento === depto)
    const completadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
    const pendientes  = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
    const atrasadas   = tareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
    const pct         = tareas.length ? Math.round((completadas / tareas.length) * 100) : 0
    const ciclo       = ciclosActivos[0]
    return { tareas: tareas.length, completadas, pendientes, atrasadas, pct, ciclo }
  }

  // Métricas globales
  const totalTareas      = todasTareas.length
  const totalCompletadas = todasTareas.filter(t => t.estado === 'completada' || t.estado === 'completada_con_atraso').length
  const totalPendientes  = todasTareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const totalAtrasadas   = todasTareas.filter(t => t.estado === 'con_atraso' || t.estado === 'no_completada').length
  const pctGlobal        = totalTareas ? Math.round((totalCompletadas / totalTareas) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-8 bg-blue-500 rounded-full" />
          <h1 className="text-2xl font-bold text-white">
            Hola, {profile?.nombre?.split(' ')[0]} 👋
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-5">Vista gerencial · Resumen por departamento</p>
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
                onClick={() => navigate(`/gerente/depto/${encodeURIComponent(depto)}`)}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600
                           rounded-2xl p-6 cursor-pointer transition group"
              >
                {/* Header depto */}
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

                {/* Barra progreso */}
                <BarraDepto pct={m.pct} />

                {/* Stats mini */}
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

                {/* Ciclo activo */}
                {m.ciclo && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-600">
                      Ciclo activo: {MESES[m.ciclo.mes - 1]} {m.ciclo.anio} · {m.tareas} tareas
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}