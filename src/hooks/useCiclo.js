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
  const jsDay = parseInt(diaSemana)
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

// ── Helpers ponderación (misma lógica que Proyectos.jsx) ──────────────────

const FACTOR_PRIORIDAD = { alta: 3, media: 2, baja: 1 }

function factorP(prioridad) {
  return FACTOR_PRIORIDAD[prioridad] ?? 1
}

function calcularPctPlan(fechaInicio, fechaFin) {
  const hoy    = new Date(); hoy.setHours(0, 0, 0, 0)
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin    = new Date(fechaFin    + 'T00:00:00')
  if (hoy < inicio) return 0
  if (hoy > fin)    return 100
  const total  = fin.getTime() - inicio.getTime()
  const pasado = hoy.getTime() - inicio.getTime()
  return Math.round((pasado / total) * 100)
}

function calcularPonderado(entregables, campo) {
  const totalPeso = entregables.reduce((s, d) =>
    s + (d.duracion_dias || 1) * factorP(d.prioridad), 0)
  if (totalPeso === 0) return 0
  const suma = entregables.reduce((s, d) => {
    const valor = campo === 'pct_plan'
      ? calcularPctPlan(d.fecha_inicio, d.fecha_fin)
      : (Number(d.pct_real) || 0)
    return s + valor * (d.duracion_dias || 1) * factorP(d.prioridad)
  }, 0)
  return Math.round(suma / totalPeso)
}

function calcularPonderadoGlobal(proyectos, campo) {
  const totalPeso = proyectos.reduce((s, p) => {
    const fp = factorP(p.prioridad)
    return s + (p.project_deliverables ?? []).reduce((sd, d) =>
      sd + (d.duracion_dias || 1) * factorP(d.prioridad) * fp, 0)
  }, 0)
  if (totalPeso === 0) return 0
  const suma = proyectos.reduce((s, p) => {
    const fp = factorP(p.prioridad)
    return s + (p.project_deliverables ?? []).reduce((sd, d) => {
      const valor = campo === 'pct_plan'
        ? calcularPctPlan(d.fecha_inicio, d.fecha_fin)
        : (Number(d.pct_real) || 0)
      return sd + valor * (d.duracion_dias || 1) * factorP(d.prioridad) * fp
    }, 0)
  }, 0)
  return Math.round(suma / totalPeso)
}

// ── Snapshot automático al cerrar ciclo ───────────────────────────────────
// Se llama justo antes de crear el nuevo ciclo, guardando el estado actual
// de todos los proyectos activos del departamento.

async function guardarSnapshotAutomatico(departamento, mes, anio) {
  try {
    // Traer proyectos activos del departamento con sus entregables
    const { data: proyectos, error: errProy } = await supabase
      .from('projects')
      .select(`
        *,
        project_deliverables(*)
      `)
      .eq('departamento', departamento)
      .eq('activo', true)
      .eq('anio', anio)

    if (errProy || !proyectos || proyectos.length === 0) return

    for (const proyecto of proyectos) {
      const entregables  = proyecto.project_deliverables ?? []
      const pctReal      = calcularPonderado(entregables, 'pct_real')
      const pctPlan      = calcularPonderado(entregables, 'pct_plan')
      const cumplimiento = pctPlan > 0 ? Math.round((pctReal / pctPlan) * 100) : null

      const { data: snap, error: errSnap } = await supabase
        .from('project_snapshots')
        .insert({
          project_id:   proyecto.id,
          departamento: proyecto.departamento,
          mes,
          anio,
          pct_real:     pctReal,
          pct_plan:     pctPlan,
          cumplimiento,
          prioridad:    proyecto.prioridad,
        })
        .select()
        .single()

      if (errSnap || !snap) continue

      // Detalle por entregable
      if (entregables.length > 0) {
        const detalles = entregables.map(d => ({
          snapshot_id:    snap.id,
          deliverable_id: d.id,
          nombre:         d.nombre,
          pct_real:       Number(d.pct_real) || 0,
          pct_plan:       calcularPctPlan(d.fecha_inicio, d.fecha_fin),
          prioridad:      d.prioridad,
        }))
        await supabase
          .from('project_deliverable_snapshots')
          .insert(detalles)
      }
    }
    // Snapshot global del departamento
    const allDeliverables   = proyectos.flatMap(p => p.project_deliverables ?? [])
    const deptoReal         = calcularPonderadoGlobal(proyectos, 'pct_real')
    const deptoPlan         = calcularPonderadoGlobal(proyectos, 'pct_plan')
    const deptoCumpl        = deptoPlan > 0 ? Math.round(deptoReal / deptoPlan * 100) : null
    const deptoCompletados  = allDeliverables.filter(d => Number(d.pct_real) === 100).length
    const deptoEnProgreso   = allDeliverables.filter(d => Number(d.pct_real) > 0 && Number(d.pct_real) < 100).length
    const deptoNoIniciados  = allDeliverables.length - deptoCompletados - deptoEnProgreso

    await supabase
      .from('department_snapshots')
      .insert({
        departamento,
        mes,
        anio,
        pct_real:          deptoReal,
        pct_plan:          deptoPlan,
        cumplimiento:      deptoCumpl,
        total_proyectos:   proyectos.length,
        total_entregables: allDeliverables.length,
        completados:       deptoCompletados,
        en_progreso:       deptoEnProgreso,
        no_iniciados:      deptoNoIniciados,
        creado_por:        null,
      })
  } catch (err) {
    // El snapshot es secundario — no interrumpe el cierre de ciclo si falla
    console.warn('Snapshot automático falló (no crítico):', err)
  }
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
    mutationFn: async ({ mes, anio, departamento }) => {

      // ── Modelo híbrido: crear el ciclo para TODOS los departamentos activos ──
      // El `departamento` recibido se ignora para la creación (se crea para todos)
      // y solo se usa al final para retornar el ciclo del usuario que hizo clic.

      // 0. Obtener lista de departamentos activos
      const { data: deptosData } = await supabase
        .from('users')
        .select('departamento')
        .eq('activo', true)
      const departamentos = [...new Set((deptosData ?? [])
        .map(u => u.departamento).filter(Boolean))]

      // Feriados del mes (compartidos entre todos los deptos)
      const feriados     = getFeriadosDelAnio(anio)
      const feriadosAnt  = getFeriadosDelAnio(anio - 1)
      const feriadosComb = new Set([...feriados, ...feriadosAnt])

      // Snapshot mantiene mes/anio del sistema (decisión intencional)
      const ahora    = new Date()
      const mesSnap  = ahora.getMonth() + 1
      const anioSnap = ahora.getFullYear()

      for (const depto of departamentos) {
        try {
          // 1. Guardar snapshot del estado actual ANTES de cerrar el ciclo
          await guardarSnapshotAutomatico(depto, mesSnap, anioSnap)

          // 2. Marcar ciclo activo anterior de ESE depto como inactivo
          await supabase
            .from('monthly_cycles')
            .update({ estado: 'inactivo' })
            .eq('estado', 'activo')
            .eq('departamento', depto)

          // 3. Crear nuevo ciclo para ESE depto
          const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`
          const { data: ciclo, error: errCiclo } = await supabase
            .from('monthly_cycles')
            .insert({ mes, anio, fecha_inicio_mes: fechaInicio, estado: 'activo', departamento: depto })
            .select()
            .single()
          if (errCiclo) throw errCiclo

          // 4. Traer plantillas activas de ESE depto
          const { data: plantillas, error: errPlant } = await supabase
            .from('task_templates')
            .select('*')
            .eq('activo', true)
            .eq('departamento', depto)
          if (errPlant) throw errPlant

          // 5. Si no hay plantillas, el ciclo queda vacío — continuar al siguiente
          if (!plantillas || plantillas.length === 0) continue

          // 6. Generar tareas según tipo y frecuencia
          const tareas = []

          for (const p of plantillas) {
            const duracion    = p.duracion_estimada_min ?? 60
            const ponderacion = p.ponderacion ?? null

            // ── Semanal → N tareas con serie_id (soporta múltiples días) ─────
            if (p.tipo === 'recurrente_mes' && p.frecuencia === 'semanal') {
              const serieId   = generarUUID()
              const diasArray = (p.dias_semana && p.dias_semana.length > 0)
                ? p.dias_semana
                : [p.dia_del_mes]
              const fechas = diasArray
                .flatMap(dia => calcularFechasSemanales(dia, mes, anio))
                .sort((a, b) => a - b)
              for (const fecha of fechas) {
                tareas.push({
                  ciclo_id:              ciclo.id,
                  template_id:           p.id,
                  responsable_id:        p.responsable_id,
                  nombre_tarea:          p.nombre_tarea,
                  area:                  p.area,
                  departamento:          p.departamento,
                  condicion:             'habil',
                  fecha_inicio:          fechaStr(fecha),
                  fecha_termino:         fechaStr(fecha),
                  estado:                'pendiente',
                  tipo_tarea:            'adicional',
                  tipo:                  'recurrente_mes',
                  frecuencia:            'semanal',
                  serie_id:              serieId,
                  mes_calendario:        mes,
                  anio_calendario:       anio,
                  ponderacion,
                  duracion_estimada_min: duracion,
                })
              }
              continue
            }

            // ── Quincenal → 2 tareas con serie_id ────────────────
            if (p.tipo === 'recurrente_mes' && p.frecuencia === 'quincenal') {
              const serieId = generarUUID()
              const dia1    = p.dia_del_mes
              const dia2    = p.dia_del_mes_2 ?? (dia1 <= 15 ? dia1 + 15 : dia1)
              const fechas  = calcularFechasQuincenales(dia1, dia2, mes, anio, feriadosComb)
              for (const f of fechas) {
                tareas.push({
                  ciclo_id:              ciclo.id,
                  template_id:           p.id,
                  responsable_id:        p.responsable_id,
                  nombre_tarea:          p.nombre_tarea,
                  area:                  p.area,
                  departamento:          p.departamento,
                  condicion:             'habil',
                  fecha_inicio:          fechaStr(f.inicio),
                  fecha_termino:         fechaStr(f.termino),
                  estado:                'pendiente',
                  tipo_tarea:            'adicional',
                  tipo:                  'recurrente_mes',
                  frecuencia:            'quincenal',
                  serie_id:              serieId,
                  mes_calendario:        mes,
                  anio_calendario:       anio,
                  ponderacion,
                  duracion_estimada_min: duracion,
                })
              }
              continue
            }

            // ── Mensual / cierre → 1 tarea normal ────────────────
            const { fecha_inicio, fecha_termino } = calcularFechasTarea(p, mes, anio)
            tareas.push({
              ciclo_id:              ciclo.id,
              template_id:           p.id,
              responsable_id:        p.responsable_id,
              nombre_tarea:          p.nombre_tarea,
              area:                  p.area,
              departamento:          p.departamento,
              condicion:             p.condicion,
              fecha_inicio,
              fecha_termino,
              estado:                'pendiente',
              tipo_tarea:            p.tipo === 'cierre' ? 'cierre' : 'adicional',
              tipo:                  p.tipo ?? 'cierre',
              frecuencia:            p.frecuencia ?? null,
              serie_id:              null,
              mes_calendario:        mes,
              anio_calendario:       anio,
              ponderacion,
              duracion_estimada_min: duracion,
            })
          }

          // 7. Insertar todas las tareas de ESE depto
          if (tareas.length > 0) {
            const { error: errTareas } = await supabase
              .from('tasks')
              .insert(tareas)
            if (errTareas) throw errTareas
          }

          // 8. Instanciar dependencias entre tareas a partir de las plantillas
          try {
            const { data: templateDeps } = await supabase
              .from('template_dependencies')
              .select('*')
              .eq('activo', true)

            if (templateDeps && templateDeps.length > 0) {
              const dependenciasInsertar = []

              for (const dep of templateDeps) {
                const { data: tareasOrigen } = await supabase
                  .from('tasks')
                  .select('id')
                  .eq('ciclo_id', ciclo.id)
                  .eq('template_id', dep.template_id)

                const { data: tareasDestino } = await supabase
                  .from('tasks')
                  .select('id')
                  .eq('ciclo_id', ciclo.id)
                  .eq('template_id', dep.depends_on_template_id)

                if (tareasOrigen?.length && tareasDestino?.length) {
                  dependenciasInsertar.push({
                    task_id:        tareasOrigen[0].id,
                    depends_on_id:  tareasDestino[0].id,
                    tipo:           'referencia',
                    template_dep_id: dep.id,
                  })
                }
              }

              if (dependenciasInsertar.length > 0) {
                await supabase.from('task_dependencies').insert(dependenciasInsertar)
              }
            }
          } catch (err) {
            // Las dependencias son trazabilidad — no interrumpen la creación del ciclo
            console.warn(`Instanciación de dependencias falló para ${depto} (no crítico):`, err)
          }

        } catch (err) {
          console.warn(`Error creando ciclo para ${depto}:`, err)
          // continuar con los demás deptos
        }
      }

      // 9. Retornar el ciclo del departamento del usuario que hizo clic
      //    (para mantener compatibilidad con onCambiarCiclo en CambiadorMes.jsx)
      const { data: cicloDelUsuario } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('mes', mes)
        .eq('anio', anio)
        .eq('departamento', departamento)
        .maybeSingle()
      return cicloDelUsuario
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['department_snapshots'] })
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
