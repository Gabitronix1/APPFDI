const DIA_RRULE = ['SU','MO','TU','WE','TH','FR','SA']  // index = getDay()

export function generarLinkGoogleCalendar(tarea, horaInicio = '09:00', recurrencia = null) {
  const fecha = tarea.fecha_termino
  if (!fecha) return null

  const duracion = tarea.duracion_estimada_min ?? 60
  const [hh, mm] = horaInicio.split(':').map(Number)

  const texto = encodeURIComponent(tarea.nombre_tarea ?? 'Tarea')
  const detalles = encodeURIComponent(
    [
      tarea.observaciones ? `Observaciones: ${tarea.observaciones}` : '',
      tarea.area ? `Área: ${tarea.area}` : '',
      tarea.departamento ? `Departamento: ${tarea.departamento}` : '',
      'Generado desde Gestión FDI',
    ].filter(Boolean).join('\n')
  )

  const fmt = (d) =>
    `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}` +
    `T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`

  if (recurrencia && recurrencia.diasSemana?.length > 0) {
    // EVENTO RECURRENTE
    const { diasSemana, mesCalendario, anioCalendario } = recurrencia
    // Primera ocurrencia: primer día del mes que caiga en uno de los diasSemana
    const diasEnMes = new Date(anioCalendario, mesCalendario, 0).getDate()
    let primeraFecha = null
    for (let d = 1; d <= diasEnMes; d++) {
      const f = new Date(anioCalendario, mesCalendario - 1, d, hh, mm, 0)
      if (diasSemana.includes(f.getDay())) { primeraFecha = f; break }
    }
    if (!primeraFecha) primeraFecha = new Date(anioCalendario, mesCalendario - 1, 1, hh, mm, 0)

    const inicio = primeraFecha
    const fin = new Date(inicio.getTime() + duracion * 60000)

    // UNTIL: último día del mes a las 23:59:59 UTC
    const ultimoDia = new Date(anioCalendario, mesCalendario, 0, 23, 59, 59)
    const until = `${ultimoDia.getFullYear()}${String(ultimoDia.getMonth()+1).padStart(2,'0')}${String(ultimoDia.getDate()).padStart(2,'0')}T235959Z`

    const byday = diasSemana.map(d => DIA_RRULE[d]).join(',')
    const rrule = encodeURIComponent(`RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${until}`)

    const fechas = `${fmt(inicio)}/${fmt(fin)}`
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${texto}&dates=${fechas}&details=${detalles}&recur=${rrule}`
  }

  // EVENTO ÚNICO (comportamiento actual)
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const inicio = new Date(anio, mes - 1, dia, hh, mm, 0)
  const fin = new Date(inicio.getTime() + duracion * 60000)
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
