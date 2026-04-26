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

      // 4. Calcular fechas con feriados chilenos y generar tareas
      const tareas = plantillas.map(p => {
        const { fecha_inicio, fecha_termino } = calcularFechasTarea(p, mes, anio)
        return {
          ciclo_id:       ciclo.id,
          template_id:    p.id,
          responsable_id: p.responsable_id,
          nombre_tarea:   p.nombre_tarea,
          area:           p.area,
          departamento:   p.departamento,
          condicion:      p.condicion,
          fecha_inicio,
          fecha_termino,
          estado:         'pendiente',
        }
      })

      const { data: tareasCreadas, error: errTareas } = await supabase
        .from('tasks')
        .insert(tareas)
        .select()
    console.log('Tareas a insertar:', tareas)
    console.log('Error tareas:', errTareas)
    console.log('Tareas creadas:', tareasCreadas)
    if (errTareas) throw errTareas
      

      return ciclo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    }
  })
}
export function useActivarCiclo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cicloId) => {
      // Cerrar todos los activos
      await supabase
        .from('monthly_cycles')
        .update({ estado: 'cerrado' })
        .eq('estado', 'activo')
      // Activar el seleccionado
      const { data, error } = await supabase
        .from('monthly_cycles')
        .update({ estado: 'activo' })
        .eq('id', cicloId)
        .select()
        .single()
      if (error) throw error
      return data
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
      // Borrar tareas del ciclo primero
      await supabase.from('tasks').delete().eq('ciclo_id', cicloId)
      // Borrar el ciclo
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