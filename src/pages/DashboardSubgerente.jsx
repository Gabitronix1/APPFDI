import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Calendar } from 'lucide-react'
import { BarraGlobalAdmin, DashboardAdmin } from './Dashboard'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function nombreCiclo(mes, anio) { return `${MESES[mes - 1]} ${anio}` }
function formatFechaHoy() {
  const hoy = new Date()
  return `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`
}

export default function DashboardSubgerente() {
  const { profile, deptosAsignados } = useAuth()
  const [deptoActivo, setDeptoActivo] = useState(() => deptosAsignados[0] ?? null)

  // Ciclo activo por depto
  const { data: ciclosPorDepto = {}, isLoading: loadingCiclos } = useQuery({
    queryKey: ['ciclos-subgerente', deptosAsignados],
    enabled: deptosAsignados.length > 0,
    queryFn: async () => {
      const result = {}
      for (const depto of deptosAsignados) {
        const { data } = await supabase
          .from('monthly_cycles')
          .select('*')
          .eq('departamento', depto)
          .eq('estado', 'activo')
          .maybeSingle()
        result[depto] = data ?? null
      }
      return result
    }
  })

  // Clave estable para las tareas (cambia cuando cambian los IDs de ciclo)
  const cicloIdsKey = deptosAsignados.map(d => ciclosPorDepto[d]?.id ?? '').join(',')

  // Tareas por depto
  const { data: tareasPorDepto = {}, isLoading: loadingTareas } = useQuery({
    queryKey: ['tareas-subgerente', cicloIdsKey],
    enabled: !loadingCiclos && Object.keys(ciclosPorDepto).length > 0,
    queryFn: async () => {
      const result = {}
      for (const depto of deptosAsignados) {
        const ciclo = ciclosPorDepto[depto]
        if (!ciclo) { result[depto] = []; continue }
        const { data } = await supabase
          .from('v_tareas_ciclo_activo')
          .select('*')
          .eq('ciclo_id', ciclo.id)
          .eq('departamento', depto)
          .order('fecha_termino', { ascending: true })
        result[depto] = data ?? []
      }
      return result
    }
  })

  const cicloActivo       = deptoActivo ? (ciclosPorDepto[deptoActivo] ?? null) : null
  const tareasActivo      = deptoActivo ? (tareasPorDepto[deptoActivo] ?? []) : []
  const tituloCicloActivo = cicloActivo ? nombreCiclo(cicloActivo.mes, cicloActivo.anio) : '—'
  const esCicloCerrado    = cicloActivo?.estado === 'cerrado'

  const taskIds = useMemo(() => tareasActivo.map(t => t.id), [tareasActivo])

  // Impactos de dependencias para el depto activo
  const { data: impactosDep = {} } = useQuery({
    queryKey: ['impactos-subgerente', deptoActivo, cicloActivo?.id],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select('task_id, impacto_atraso, depends_on:depends_on_id(nombre_tarea, departamento)')
        .in('task_id', taskIds)
        .gt('impacto_atraso', 0)
      if (error) throw error
      const mapa = {}
      for (const row of data ?? []) {
        mapa[row.task_id] = {
          impacto_atraso: row.impacto_atraso,
          nombre_tarea:   row.depends_on?.nombre_tarea ?? '',
          departamento:   row.depends_on?.departamento ?? '',
        }
      }
      return mapa
    }
  })

  // Profile con departamento sobreescrito al depto activo para que DashboardAdmin funcione
  const profileConDepto = useMemo(
    () => (deptoActivo ? { ...profile, departamento: deptoActivo } : profile),
    [profile, deptoActivo]
  )

  const isLoading = loadingCiclos || loadingTareas

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 bg-green-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">
              Hola, {profile?.nombre?.split(' ')[0]} 👋
            </h1>
          </div>
          <p className="text-gray-400 text-sm ml-5">
            Vista Subgerencial · {cicloActivo ? tituloCicloActivo : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 shrink-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">{formatFechaHoy()}</span>
        </div>
      </div>

      {/* ── PANEL SUPERIOR — Resumen multi-depto ───────────────── */}
      <div className="mb-6 space-y-3">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          Resumen de departamentos
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deptosAsignados.map(depto => {
          const ciclo  = ciclosPorDepto[depto]
          const tareas = tareasPorDepto[depto] ?? []

          if (!ciclo) {
            return (
              <div key={depto}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl px-5 py-3.5 flex items-center gap-5"
              >
                <div className="shrink-0">
                  <p className="text-white text-sm font-semibold">{depto}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Sin ciclo activo</p>
                </div>
                <div className="w-px h-8 bg-gray-800 shrink-0" />
                <div className="flex-1 bg-gray-800 rounded-full h-2" />
              </div>
            )
          }

          return (
            <BarraGlobalAdmin
              key={depto}
              tareas={tareas}
              departamento={depto}
              tituloCiclo={nombreCiclo(ciclo.mes, ciclo.anio)}
            />
          )
        })}
      </div>

      {/* ── SELECTOR DE DEPTO ──────────────────────────────────── */}
      {deptosAsignados.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {deptosAsignados.map(depto => (
            <button
              key={depto}
              onClick={() => setDeptoActivo(depto)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                deptoActivo === depto
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {depto}
            </button>
          ))}
        </div>
      )}

      {/* ── PANEL INFERIOR — Vista admin del depto seleccionado ── */}
      {deptoActivo && (
        isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DashboardAdmin
            tareas={tareasActivo}
            tituloCiclo={tituloCicloActivo}
            cicloSeleccionado={cicloActivo}
            isLoading={loadingTareas}
            profile={profileConDepto}
            esCicloCerrado={esCicloCerrado}
            impactosDep={impactosDep}
          />
        )
      )}
    </div>
  )
}
