import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { calcularFechasTarea } from '../lib/feriados'

export function useCiclos() {
  return useQuery({
    queryKey: ['ciclos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_cycles')
        .select('*')
        .order('anio', { ascending: false })
        .order('mes',  { ascending: false })
      if (error) throw error
      return data ?? []
    }
  })
}

export function useTareasPorCiclo(cicloId) {
  return useQuery({
    queryKey: ['tareas', cicloId],
    enabled:  !!cicloId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tareas_ciclo_activo')
        .select('*')
        .eq('ciclo_id', cicloId)
        .order('fecha_termino', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })
}

export function useCrearCiclo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ mes, anio }) => {
      // 1. Cerrar ciclo activo anterior
      await supabase
        .from('monthly_cycles')
        .update({ estado: 'cerrado' })
        .eq('estado', 'activo')

      // 2. Crear nuevo ciclo
      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`
      const { data: ciclo, error: errCiclo } = await supabase
        .from('monthly_cycles')
        .insert({ mes, anio, fecha_inicio_mes: fechaInicio, estado: 'activo' })
        .select()
        .single()
      if (errCiclo) throw errCiclo

      // 3. Traer plantillas activas
      const { data: plantillas, error: errPlant } = await supabase
        .from('task_templates')
        .select('*')
        .eq('activo', true)
      if (errPlant) throw errPlant

      // 4. Calcular fechas y generar tareas
      const tareas = plantillas.map(p => {
        const { fecha_inicio, fecha_termino } = calcularFechasTarea(p, mes, anio)
        return {
          ciclo_id:        ciclo.id,
          template_id:     p.id,
          responsable_id:  p.responsable_id,
          nombre_tarea:    p.nombre_tarea,
          area:            p.area,
          departamento:    p.departamento,
          condicion:       p.condicion,
          fecha_inicio,
          fecha_termino,
          estado:          'pendiente',
          tipo_tarea:      'cierre',
          mes_calendario:  mes,
          anio_calendario: anio,
        }
      })

      const { error: errTareas } = await supabase
        .from('tasks')
        .insert(tareas)
      if (errTareas) throw errTareas

      return ciclo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    }
  })
}

export function useEliminarCiclo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cicloId) => {
      // 1. Obtener IDs de tareas del ciclo
      const { data: tareasDelCiclo } = await supabase
        .from('tasks')
        .select('id')
        .eq('ciclo_id', cicloId)

      const taskIds = tareasDelCiclo?.map(t => t.id) ?? []

      // 2. Borrar evidencias y completions si hay tareas
      if (taskIds.length > 0) {
        await supabase.from('evidencias').delete().in('task_id', taskIds)
        await supabase.from('task_completions').delete().in('task_id', taskIds)
      }

      // 3. Borrar tareas
      await supabase.from('tasks').delete().eq('ciclo_id', cicloId)

      // 4. Borrar ciclo
      const { error } = await supabase
        .from('monthly_cycles')
        .delete()
        .eq('id', cicloId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    }
  })
}
