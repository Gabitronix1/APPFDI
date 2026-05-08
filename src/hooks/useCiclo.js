import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { calcularFechasTarea, getFeriadosDelAnio, ajustarAlDiaHabilSiguiente } from '../lib/feriados'

// ── Helpers ────────────────────────────────────────────────────────────────

function generarUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function fechaStr(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
}

function calcularFechasSemanales(diaSemana, mes, anio) {
  const jsDay = parseInt(diaSemana) + 1 // JS: 1=lun...5=vie
  const fechas = []
  const diasEnMes = new Date(anio, mes, 0).getDate()
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes - 1, d, 12, 0, 0)
    if (fecha.getDay() === jsDay) fechas.push(fecha)
  }
  return fechas
}

function calcularFechasQuincenales(dia1, dia2, mes, anio, feriados) {
  const termino1 = ajustarAlDiaHabilSiguiente(new Date(anio, mes - 1, parseInt(dia1), 12, 0, 0), feriados)
  const termino2 = ajustarAlDiaHabilSiguiente(new Date(anio, mes - 1, parseInt(dia2), 12, 0, 0), feriados)
  const inicio1  = new Date(anio, mes - 1, 1, 12, 0, 0)
  const inicio2  = new Date(termino1)
  inicio2.setDate(inicio2.getDate() + 1)
  return [
    { inicio: inicio1, termino: termino1 },
    { inicio: inicio2, termino: termino2 },
  ]
}

// ── Hooks ──────────────────────────────────────────────────────────────────

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

      // 4. Preparar feriados del mes
      const feriados    = getFeriadosDelAnio(anio)
      const feriadosAnt = getFeriadosDelAnio(anio - 1)
      const feriadosComb = new Set([...feriados, ...feriadosAnt])

      // 5. Generar tareas según tipo y frecuencia
      const tareas = []

      for (const p of plantillas) {

        // ── Semanal → N tareas con serie_id ──────────────────
        if (p.tipo === 'recurrente_mes' && p.frecuencia === 'semanal') {
          const serieId = generarUUID()
          const fechas  = calcularFechasSemanales(p.dia_del_mes, mes, anio)
          for (const fecha of fechas) {
            tareas.push({
              ciclo_id:        ciclo.id,
              template_id:     p.id,
              responsable_id:  p.responsable_id,
              nombre_tarea:    p.nombre_tarea,
              area:            p.area,
              departamento:    p.departamento,
              condicion:       'habil',
              fecha_inicio:    fechaStr(fecha),
              fecha_termino:   fechaStr(fecha),
              estado:          'pendiente',
              tipo_tarea:      'adicional',
              tipo:            'recurrente_mes',
              frecuencia:      'semanal',
              serie_id:        serieId,
              mes_calendario:  mes,
              anio_calendario: anio,
            })
          }
          continue
        }

        // ── Quincenal → 2 tareas con serie_id ────────────────
        if (p.tipo === 'recurrente_mes' && p.frecuencia === 'quincenal') {
          const serieId = generarUUID()
          // dia_del_mes guarda primera quincena, necesitamos segunda
          // Para quincenal guardamos dia1 en dia_del_mes y dia2 en un campo auxiliar
          // Por ahora asumimos dia1 y dia1+14 como convención
          const dia1   = p.dia_del_mes
          const dia2   = p.dia_del_mes_2 ?? (dia1 <= 15 ? dia1 + 15 : dia1)
          const fechas = calcularFechasQuincenales(dia1, dia2, mes, anio, feriadosComb)
          for (const fecha of fechas) {
            tareas.push({
              ciclo_id:        ciclo.id,
              template_id:     p.id,
              responsable_id:  p.responsable_id,
              nombre_tarea:    p.nombre_tarea,
              area:            p.area,
              departamento:    p.departamento,
              condicion:       'habil',
              fecha_inicio:    fechaStr(f.inicio),
              fecha_termino:   fechaStr(f.termino),
              estado:          'pendiente',
              tipo_tarea:      'adicional',
              tipo:            'recurrente_mes',
              frecuencia:      'quincenal',
              serie_id:        serieId,
              mes_calendario:  mes,
              anio_calendario: anio,
            })
          }
          continue
        }

        // ── Mensual / cierre → 1 tarea normal ────────────────
        const { fecha_inicio, fecha_termino } = calcularFechasTarea(p, mes, anio)
        tareas.push({
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
          tipo_tarea:      p.tipo === 'cierre' ? 'cierre' : 'adicional',
          tipo:            p.tipo ?? 'cierre',
          frecuencia:      p.frecuencia ?? null,
          serie_id:        null,
          mes_calendario:  mes,
          anio_calendario: anio,
        })
      }

      // 6. Insertar todas las tareas
      if (tareas.length > 0) {
        const { error: errTareas } = await supabase
          .from('tasks')
          .insert(tareas)
        if (errTareas) throw errTareas
      }

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
      const { data: tareasDelCiclo } = await supabase
        .from('tasks')
        .select('id')
        .eq('ciclo_id', cicloId)

      const taskIds = tareasDelCiclo?.map(t => t.id) ?? []

      if (taskIds.length > 0) {
        await supabase.from('evidencias').delete().in('task_id', taskIds)
        await supabase.from('task_completions').delete().in('task_id', taskIds)
      }

      await supabase.from('tasks').delete().eq('ciclo_id', cicloId)

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
