import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProyectoCard from '../components/ProyectoCard'
import ProyectoModal from '../components/ProyectoModal'
import { Plus, FolderKanban } from 'lucide-react'

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
          project_deliverables(*)
        `)
        .eq('anio', anio)
        .eq('activo', true)
        .order('edt')
    console.log('Proyectos data:', data)
    console.log('Proyectos error:', error)
      if (error) throw error
      return data ?? []
    }
  })

  function onCambio() {
    queryClient.invalidateQueries({ queryKey: ['proyectos', anio] })
  }

  const totalEntregables   = proyectos.reduce((s, p) => s + p.project_deliverables.length, 0)
  const completados        = proyectos.reduce((s, p) =>
    s + p.project_deliverables.filter(d => d.estado === 'completado').length, 0)
  const enProgreso         = proyectos.reduce((s, p) =>
    s + p.project_deliverables.filter(d => d.estado === 'en_progreso').length, 0)
  const pctGlobal          = totalEntregables
    ? Math.round((completados / totalEntregables) * 100) : 0

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

      {/* Resumen global */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-white font-semibold">Avance global PO {anio}</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {completados} completados · {enProgreso} en progreso · {totalEntregables - completados - enProgreso} no iniciados
            </p>
          </div>
          <span className={`text-3xl font-bold ${
            pctGlobal === 100 ? 'text-green-400'
            : pctGlobal > 50  ? 'text-blue-400'
            : 'text-amber-400'
          }`}>
            {pctGlobal}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-700 ${
              pctGlobal === 100 ? 'bg-green-500'
              : pctGlobal > 50  ? 'bg-blue-500'
              : 'bg-amber-500'
            }`}
            style={{ width: `${pctGlobal}%` }}
          />
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