import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCicloActivo(departamento) {
  const { data } = await supabase
    .from('monthly_cycles')
    .select('id')
    .eq('estado', 'activo')
    .eq('departamento', departamento)
    .maybeSingle()
  return data?.id ?? null
}

async function notificacionExiste(userId, linkId, tipo) {
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('link_id', linkId)
    .eq('tipo', tipo)
    .maybeSingle()
  return !!data
}

// ─── Generador de notificaciones (función pura, no hook) ──────────────────────
// Se llama desde AuthContext después de fetchProfile.

export async function generarNotificaciones(userId, rol, departamento, lastSeenAt) {
  if (!userId || !departamento) return

  try {
    const cicloId = await getCicloActivo(departamento)
    if (!cicloId) return

    const hoy    = new Date()
    hoy.setHours(0, 0, 0, 0)
    const manana = new Date(hoy)
    manana.setDate(manana.getDate() + 1)

    const hoyStr    = hoy.toISOString().split('T')[0]
    const mananaStr = manana.toISOString().split('T')[0]

    // ── 1. Tareas por vencer hoy o mañana (todos los roles) ───────────────────
    const { data: tareasPorVencer } = await supabase
      .from('tasks')
      .select('id, nombre, fecha_termino')
      .eq('cycle_id', cicloId)
      .in('fecha_termino', [hoyStr, mananaStr])
      .not('estado', 'in', '(completada,completada_con_atraso)')

    for (const tarea of tareasPorVencer ?? []) {
      const existe = await notificacionExiste(userId, tarea.id, 'por_vencer')
      if (!existe) {
        const diasTexto = tarea.fecha_termino === hoyStr ? 'hoy' : 'mañana'
        await supabase.from('notifications').insert({
          user_id:   userId,
          tipo:      'por_vencer',
          titulo:    'Tarea por vencer',
          mensaje:   `"${tarea.nombre}" vence ${diasTexto}`,
          leida:     false,
          link_id:   tarea.id,
          link_tipo: 'tarea',
        })
      }
    }

    // ── 2. Tareas vencidas (alerta=fuera_de_plazo) — solo del usuario ─────────
    const { data: tareasVencidas } = await supabase
      .from('tasks')
      .select('id, nombre')
      .eq('cycle_id', cicloId)
      .eq('alerta', 'fuera_de_plazo')
      .eq('responsable_id', userId)

    for (const tarea of tareasVencidas ?? []) {
      const existe = await notificacionExiste(userId, tarea.id, 'vencida')
      if (!existe) {
        await supabase.from('notifications').insert({
          user_id:   userId,
          tipo:      'vencida',
          titulo:    'Tarea vencida',
          mensaje:   `"${tarea.nombre}" está fuera de plazo`,
          leida:     false,
          link_id:   tarea.id,
          link_tipo: 'tarea',
        })
      }
    }

    // ── 3. Nuevas entregas (solo admin) ───────────────────────────────────────
    if (rol === 'admin' && lastSeenAt) {
      const { data: tareasCompletadas } = await supabase
        .from('tasks')
        .select('id, nombre, responsable_nombre')
        .eq('cycle_id', cicloId)
        .in('estado', ['completada', 'completada_con_atraso'])
        .gte('updated_at', lastSeenAt)

      for (const tarea of tareasCompletadas ?? []) {
        const existe = await notificacionExiste(userId, tarea.id, 'novedad')
        if (!existe) {
          await supabase.from('notifications').insert({
            user_id:   userId,
            tipo:      'novedad',
            titulo:    'Nueva entrega',
            mensaje:   `${tarea.responsable_nombre || 'Un integrante'} completó "${tarea.nombre}"`,
            leida:     false,
            link_id:   tarea.id,
            link_tipo: 'tarea',
          })
        }
      }
    }
  } catch (err) {
    console.error('[useNotificaciones] Error al generar notificaciones:', err)
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificaciones() {
  const { user } = useAuth()
  const userId   = user?.id
  const queryClient = useQueryClient()

  const { data: notificaciones = [] } = useQuery({
    queryKey: ['notificaciones', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('leida', false)
        .order('creado_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })

  async function marcarLeida(notificacionId) {
    await supabase
      .from('notifications')
      .update({ leida: true })
      .eq('id', notificacionId)
    queryClient.invalidateQueries({ queryKey: ['notificaciones', userId] })
  }

  async function marcarTodasLeidas() {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ leida: true })
      .eq('user_id', userId)
      .eq('leida', false)
    queryClient.invalidateQueries({ queryKey: ['notificaciones', userId] })
  }

  return {
    notificaciones,
    totalNoLeidas: notificaciones.length,
    marcarLeida,
    marcarTodasLeidas,
  }
}
