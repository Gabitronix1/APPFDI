export function generarLinkGoogleCalendar(tarea, horaInicio = '09:00') {
  const fecha = tarea.fecha_termino  // 'YYYY-MM-DD'
  if (!fecha) return null

  const duracion = tarea.duracion_estimada_min ?? 60
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [hh, mm] = horaInicio.split(':').map(Number)
  const inicio = new Date(anio, mes - 1, dia, hh, mm, 0)
  const fin    = new Date(inicio.getTime() + duracion * 60000)

  const fmt = (d) =>
    `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}` +
    `T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`

  const texto    = encodeURIComponent(tarea.nombre_tarea ?? 'Tarea')
  const detalles = encodeURIComponent(
    [
      tarea.observaciones ? `Observaciones: ${tarea.observaciones}` : '',
      tarea.area ? `Área: ${tarea.area}` : '',
      tarea.departamento ? `Departamento: ${tarea.departamento}` : '',
      'Generado desde Gestión FDI',
    ].filter(Boolean).join('\n')
  )
  const fechas = `${fmt(inicio)}/${fmt(fin)}`

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${texto}&dates=${fechas}&details=${detalles}`
}

// Helper para mostrar duración legible
export function formatDuracion(min) {
  const m = min ?? 60
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  if (rest === 0) return `${h} h`
  return `${h} h ${rest} min`
}
