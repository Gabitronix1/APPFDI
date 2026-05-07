// Feriados fijos chilenos (dia, mes)
const FERIADOS_FIJOS = [
  { dia: 1,  mes: 1  }, // Año Nuevo
  { dia: 1,  mes: 5  }, // Día del Trabajo
  { dia: 21, mes: 5  }, // Glorias Navales
  { dia: 20, mes: 6  }, // Día Nacional de los Pueblos Indígenas (varía, aprox)
  { dia: 29, mes: 6  }, // San Pedro y San Pablo
  { dia: 16, mes: 7  }, // Virgen del Carmen
  { dia: 15, mes: 8  }, // Asunción de la Virgen
  { dia: 18, mes: 9  }, // Independencia
  { dia: 19, mes: 9  }, // Glorias del Ejército
  { dia: 12, mes: 10 }, // Encuentro de Dos Mundos
  { dia: 1,  mes: 11 }, // Día de Todos los Santos
  { dia: 8,  mes: 12 }, // Inmaculada Concepción
  { dia: 25, mes: 12 }, // Navidad
]

// Semana Santa: Viernes y Sábado Santos (calculado por año)
function semanaSanta(anio) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  const pascua = new Date(anio, mes - 1, dia)
  const viernesSanto = new Date(pascua)
  viernesSanto.setDate(pascua.getDate() - 2)
  const sabadoSanto = new Date(pascua)
  sabadoSanto.setDate(pascua.getDate() - 1)

  return [viernesSanto, sabadoSanto]
}

export function getFeriadosDelAnio(anio) {
  const feriados = new Set()

  for (const { dia, mes } of FERIADOS_FIJOS) {
    feriados.add(`${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`)
  }

  for (const fecha of semanaSanta(anio)) {
    feriados.add(fecha.toISOString().split('T')[0])
  }

  return feriados
}

export function esDiaHabil(fecha, feriados) {
  const dia = fecha.getDay()
  const key = fecha.toISOString().split('T')[0]
  return dia !== 0 && dia !== 6 && !feriados.has(key)
}

// Retrocede al día hábil anterior si cae en feriado o fin de semana
export function ajustarAlDiaHabilAnterior(fecha, feriados) {
  const d = new Date(fecha)
  while (!esDiaHabil(d, feriados)) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

// Avanza al día hábil siguiente si cae en feriado o fin de semana
export function ajustarAlDiaHabilSiguiente(fecha, feriados) {
  const d = new Date(fecha)
  while (!esDiaHabil(d, feriados)) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

// Dado un mes/año y una plantilla, calcula fecha_inicio y fecha_termino
export function calcularFechasTarea(template, mes, anio) {
  const feriados = getFeriadosDelAnio(anio)
  const feriadosAnterior = getFeriadosDelAnio(anio - 1)
  const feriadosCombinados = new Set([...feriados, ...feriadosAnterior])

  let fechaTermino

  if (template.condicion === 'habil') {
    fechaTermino = getNesimoHabilDelMes(mes, anio, template.dia_del_mes, feriadosCombinados)
  } else {
    // Día real: día N del mes → si cae en feriado o finde → día hábil siguiente
    fechaTermino = new Date(anio, mes - 1, template.dia_del_mes)
    fechaTermino = ajustarAlDiaHabilSiguiente(fechaTermino, feriadosCombinados)
  }

  // fecha_inicio: 3 días hábiles antes de fecha_termino
  const fechaInicio = new Date(fechaTermino)
  let diasAtras = 0
  while (diasAtras < 3) {
    fechaInicio.setDate(fechaInicio.getDate() - 1)
    if (esDiaHabil(fechaInicio, feriadosCombinados)) diasAtras++
  }

  return {
    fecha_inicio:  fechaInicio.toISOString().split('T')[0],
    fecha_termino: fechaTermino.toISOString().split('T')[0],
  }
}

// Obtiene el N-ésimo día hábil de un mes
export function getNesimoHabilDelMes(mes, anio, n, feriados) {
  let count = 0
  const d = new Date(anio, mes - 1, 1)

  while (count < n) {
    if (esDiaHabil(d, feriados)) count++
    if (count < n) d.setDate(d.getDate() + 1)
  }

  return d
}
