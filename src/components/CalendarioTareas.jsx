import { useState, useMemo } from 'react'
import {
  RefreshCw, CalendarClock, Sparkles, Lock,
  ChevronLeft, ChevronRight, X, Clock, Users, User
} from 'lucide-react'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getIniciales(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()
}

function formatDuracion(min) {
  if (!min) return '1h'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getColorEstado(tarea, hoy) {
  const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy
  if (estaBloqueada)
    return { bg: 'bg-gray-800', text: 'text-gray-600', border: 'border-gray-700', dot: 'bg-gray-600', agenda: 'bg-gray-800/80 border-gray-700' }
  if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso')
    return { bg: 'bg-green-900/40', text: 'text-green-300', border: 'border-green-800', dot: 'bg-green-500', agenda: 'bg-green-900/30 border-green-700' }
  if (tarea.alerta === 'fuera_de_plazo' || tarea.estado === 'con_atraso')
    return { bg: 'bg-red-900/40', text: 'text-red-300', border: 'border-red-800', dot: 'bg-red-500', agenda: 'bg-red-900/30 border-red-700' }
  if (tarea.alerta === 'por_vencer')
    return { bg: 'bg-amber-900/40', text: 'text-amber-300', border: 'border-amber-800', dot: 'bg-amber-500', agenda: 'bg-amber-900/30 border-amber-700' }
  return { bg: 'bg-gray-800/60', text: 'text-gray-300', border: 'border-gray-700', dot: 'bg-gray-500', agenda: 'bg-gray-800/60 border-gray-700' }
}

function getIconoTipo(tipo, className = 'w-2.5 h-2.5') {
  if (tipo === 'cierre')         return <RefreshCw className={`${className} text-blue-400`} />
  if (tipo === 'recurrente_mes') return <CalendarClock className={`${className} text-purple-400`} />
  return <Sparkles className={`${className} text-amber-400`} />
}

// ── CHIP compacto para vista semana/mes ───────────────────────────────────────
function TareaChip({ tarea, hoy, onClick, soloMia }) {
  const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy
  const colores     = getColorEstado(tarea, hoy)
  const iniciales   = getIniciales(tarea.responsable_nombre)
  const nombreCorto = tarea.nombre_tarea?.length > 14
    ? tarea.nombre_tarea.slice(0, 13) + '…'
    : tarea.nombre_tarea

  return (
    <div
      onClick={estaBloqueada ? undefined : onClick}
      className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs
        transition-all duration-150
        ${colores.bg} ${colores.border}
        ${estaBloqueada ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-125 hover:scale-[1.02]'}`}
    >
      {estaBloqueada
        ? <Lock className="w-2.5 h-2.5 text-gray-600 shrink-0" />
        : getIconoTipo(tarea.tipo)}
      <span className={`truncate font-medium ${colores.text}`}>{nombreCorto}</span>
      {!soloMia && (
        <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded-md bg-black/20 ${colores.text}`}>
          {iniciales}
        </span>
      )}
    </div>
  )
}

// ── COLUMNA DÍA ───────────────────────────────────────────────────────────────
function DiaCol({ fecha, tareas, hoy, esHoy, onClickTarea, onClickDia, soloMia, MAX_VISIBLE = 3 }) {
  const [expandido, setExpandido] = useState(false)
  const esPasado = fecha < hoy && !esHoy

  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
  const tareasDelDia = tareas.filter(t => t.fecha_termino === fechaStr)
  const visibles     = expandido ? tareasDelDia : tareasDelDia.slice(0, MAX_VISIBLE)
  const ocultas      = tareasDelDia.length - MAX_VISIBLE

  return (
    <div
      className={`flex flex-col min-w-0 rounded-xl border transition-all
        ${esHoy
          ? 'border-green-500/50 bg-green-950/20'
          : esPasado
          ? 'border-gray-800/50 bg-gray-900/30'
          : 'border-gray-800 bg-gray-900/50'}`}
    >
      {/* Header día — click abre agenda */}
      <div
        onClick={() => tareasDelDia.length > 0 && onClickDia(fecha, tareasDelDia)}
        className={`px-2 py-2 text-center border-b transition
          ${esHoy ? 'border-green-500/30' : 'border-gray-800/50'}
          ${tareasDelDia.length > 0 ? 'cursor-pointer hover:bg-white/5 rounded-t-xl' : ''}`}
      >
        <p className={`text-xs font-medium ${esHoy ? 'text-green-400' : esPasado ? 'text-gray-600' : 'text-gray-400'}`}>
          {DIAS_SEMANA[(fecha.getDay() + 6) % 7]}
        </p>
        <p className={`text-lg font-bold leading-tight ${esHoy ? 'text-green-300' : esPasado ? 'text-gray-600' : 'text-white'}`}>
          {fecha.getDate()}
        </p>
        {tareasDelDia.length > 0 && (
          <div className="flex justify-center gap-0.5 mt-1">
            {tareasDelDia.slice(0, 4).map((t, i) => {
              const c = getColorEstado(t, hoy)
              return <span key={i} className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            })}
          </div>
        )}
      </div>

      {/* Chips */}
      <div className="p-1.5 space-y-1 flex-1">
        {tareasDelDia.length === 0 ? (
          <div className="h-6" />
        ) : (
          <>
            {visibles.map(t => (
              <TareaChip key={t.id} tarea={t} hoy={hoy} soloMia={soloMia}
                onClick={() => onClickTarea(t)} />
            ))}
            {!expandido && ocultas > 0 && (
              <button
                onClick={() => setExpandido(true)}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-0.5 transition"
              >
                +{ocultas} más
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── PANEL AGENDA (slide-over lateral) ────────────────────────────────────────
function AgendaDia({ fecha, tareas, hoy, soloMia, onClose, onClickTarea }) {
  const [filtroIntegrante, setFiltroIntegrante] = useState('todos')

  const fechaStr  = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
  const esHoy     = fecha.getTime() === hoy.getTime()
  const esPasado  = fecha < hoy && !esHoy

  const integrantes = useMemo(() => {
    if (soloMia) return []
    return [...new Set(tareas.map(t => t.responsable_nombre).filter(Boolean))].sort()
  }, [tareas, soloMia])

  const tareasFiltradas = useMemo(() => {
    const base = filtroIntegrante === 'todos'
      ? tareas
      : tareas.filter(t => t.responsable_nombre === filtroIntegrante)

    // Orden: cierre → recurrente → puntual, luego por duración desc
    const orden = { cierre: 0, recurrente_mes: 1, puntual: 2 }
    return [...base].sort((a, b) => {
      const tipoA = orden[a.tipo] ?? 2
      const tipoB = orden[b.tipo] ?? 2
      if (tipoA !== tipoB) return tipoA - tipoB
      return (b.duracion_estimada_min ?? 60) - (a.duracion_estimada_min ?? 60)
    })
  }, [tareas, filtroIntegrante])

  // Calcular altura proporcional de cada bloque
  const duracionTotal = tareasFiltradas.reduce((s, t) => s + (t.duracion_estimada_min ?? 60), 0)
  const MIN_HEIGHT_PX = 52   // mínimo por bloque para que quepa el texto
  const MAX_HEIGHT_PX = 160  // máximo para que no sean enormes
  const PANEL_HEIGHT  = 520  // altura disponible aprox del panel

  function getAltura(duracion) {
    if (duracionTotal === 0) return MIN_HEIGHT_PX
    const raw = (duracion / duracionTotal) * PANEL_HEIGHT
    return Math.max(MIN_HEIGHT_PX, Math.min(MAX_HEIGHT_PX, raw))
  }

  const labelFecha = `${DIAS_SEMANA[(fecha.getDay() + 6) % 7]} ${fecha.getDate()} de ${MESES_ES[fecha.getMonth()]}`

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel lateral derecho */}
      <div className="w-full max-w-sm bg-gray-900 border-l border-gray-700 flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-800 ${
          esHoy ? 'bg-green-950/30' : esPasado ? 'bg-gray-900' : 'bg-gray-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className={`text-xs font-medium uppercase tracking-widest ${
                esHoy ? 'text-green-400' : 'text-gray-500'
              }`}>
                {esHoy ? '● Hoy' : esPasado ? 'Pasado' : 'Próximo'}
              </p>
              <h3 className="text-white font-semibold text-base">{labelFecha}</h3>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats rápidos */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500">
                {formatDuracion(tareas.reduce((s, t) => s + (t.duracion_estimada_min ?? 60), 0))} estimado
              </span>
            </div>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{tareas.length} tareas</span>
          </div>
        </div>

        {/* Filtro integrante (solo admin) */}
        {!soloMia && integrantes.length > 1 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">Filtrar por integrante</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFiltroIntegrante('todos')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition
                  ${filtroIntegrante === 'todos'
                    ? 'bg-blue-800 text-blue-200'
                    : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                Todos
              </button>
              {integrantes.map(nombre => (
                <button
                  key={nombre}
                  onClick={() => setFiltroIntegrante(nombre)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition
                    ${filtroIntegrante === nombre
                      ? 'bg-blue-800 text-blue-200'
                      : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  <span className="w-4 h-4 rounded-full bg-blue-900 flex items-center justify-center text-[9px] text-blue-300 font-bold">
                    {getIniciales(nombre)}
                  </span>
                  {nombre.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leyenda duración */}
        <div className="px-4 py-2 border-b border-gray-800/50 flex items-center gap-2">
          <span className="text-xs text-gray-600">Altura del bloque proporcional a la duración estimada</span>
        </div>

        {/* Bloques agenda */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-dark">
          {tareasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="w-8 h-8 text-gray-700 mb-2" />
              <p className="text-gray-500 text-sm">Sin tareas para este integrante</p>
            </div>
          ) : (
            tareasFiltradas.map(tarea => {
              const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
                new Date(tarea.fecha_inicio + 'T00:00:00') > hoy
              const colores  = getColorEstado(tarea, hoy)
              const duracion = tarea.duracion_estimada_min ?? 60
              const altura   = getAltura(duracion)

              return (
                <div
                  key={tarea.id}
                  onClick={estaBloqueada ? undefined : () => { onClose(); onClickTarea(tarea) }}
                  style={{ minHeight: altura }}
                  className={`w-full border rounded-xl px-3 py-3 flex flex-col gap-1.5 transition
                    ${colores.agenda}
                    ${estaBloqueada
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer hover:brightness-110 hover:scale-[1.01]'}`}
                >
                  {/* Fila tipo + duración */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {estaBloqueada
                        ? <Lock className="w-3 h-3 text-gray-600" />
                        : getIconoTipo(tarea.tipo, 'w-3 h-3')}
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${colores.text}`}>
                        {tarea.tipo === 'cierre' ? 'Cierre'
                          : tarea.tipo === 'recurrente_mes' ? 'Recurrente'
                          : 'Puntual'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatDuracion(duracion)}</span>
                    </div>
                  </div>

                  {/* Nombre tarea */}
                  <p className={`text-sm font-semibold leading-snug ${
                    estaBloqueada ? 'text-gray-500' : 'text-white'
                  }`}>
                    {tarea.nombre_tarea}
                  </p>

                  {/* Área */}
                  {tarea.area && (
                    <p className="text-xs text-gray-500 truncate">{tarea.area}</p>
                  )}

                  {/* Responsable (solo admin) + estado */}
                  <div className="flex items-center justify-between mt-auto pt-1">
                    {!soloMia && tarea.responsable_nombre && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-blue-900 flex items-center justify-center text-[9px] text-blue-300 font-bold">
                          {getIniciales(tarea.responsable_nombre)}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {tarea.responsable_nombre.split(' ')[0]}
                        </span>
                      </div>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ml-auto ${
                      estaBloqueada                                              ? 'bg-gray-800 text-gray-600'
                      : tarea.estado === 'completada'                           ? 'bg-green-900/60 text-green-300'
                      : tarea.estado === 'completada_con_atraso'               ? 'bg-yellow-900/60 text-yellow-300'
                      : tarea.alerta === 'fuera_de_plazo'                       ? 'bg-red-900/60 text-red-300'
                      : tarea.alerta === 'por_vencer'                           ? 'bg-amber-900/60 text-amber-300'
                      : 'bg-gray-800 text-gray-400'
                    }`}>
                      {estaBloqueada                              ? 'Bloqueada'
                        : tarea.estado === 'completada'           ? '✓ Completada'
                        : tarea.estado === 'completada_con_atraso'? '✓ Entregada'
                        : tarea.alerta === 'fuera_de_plazo'       ? '⚠ Fuera plazo'
                        : tarea.alerta === 'por_vencer'           ? '⏳ Por vencer'
                        : 'Pendiente'}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function CalendarioTareas({ tareas, onClickTarea, soloMia = false }) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const [vistaCompleta, setVistaCompleta] = useState(false)
  const [semanaOffset,  setSemanaOffset]  = useState(0)
  const [agendaDia,     setAgendaDia]     = useState(null) // { fecha, tareas }

  // ── Semana ────────────────────────────────────────────────
  const diasSemana = useMemo(() => {
    const lunes    = new Date(hoy)
    const diaSemana = (hoy.getDay() + 6) % 7
    lunes.setDate(hoy.getDate() - diaSemana + semanaOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d
    })
  }, [semanaOffset])

  // ── Mes ───────────────────────────────────────────────────
  const diasMes = useMemo(() => {
    const año  = hoy.getFullYear(), mes = hoy.getMonth()
    const dias = new Date(año, mes + 1, 0).getDate()
    return Array.from({ length: dias }, (_, i) => new Date(año, mes, i + 1))
  }, [])

  const semanaLabel = (() => {
    if (semanaOffset === 0)  return 'Esta semana'
    if (semanaOffset === -1) return 'Semana pasada'
    if (semanaOffset === 1)  return 'Próxima semana'
    const ini = diasSemana[0], fin = diasSemana[6]
    return `${ini.getDate()} — ${fin.getDate()} ${fin.toLocaleDateString('es-CL', { month: 'short' })}`
  })()

  function abrirAgenda(fecha, tareasDelDia) {
    setAgendaDia({ fecha, tareas: tareasDelDia })
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <h2 className="text-white font-semibold text-sm">
              {vistaCompleta
                ? `Calendario — ${hoy.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}`
                : semanaLabel}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!vistaCompleta && (
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
                <button onClick={() => setSemanaOffset(s => s - 1)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setSemanaOffset(0)} disabled={semanaOffset === 0}
                  className="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-700
                             transition disabled:opacity-30 disabled:cursor-not-allowed">
                  Hoy
                </button>
                <button onClick={() => setSemanaOffset(s => s + 1)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => setVistaCompleta(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${vistaCompleta
                  ? 'bg-blue-800 text-blue-200'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {vistaCompleta ? <X className="w-3 h-3" /> : null}
              {vistaCompleta ? 'Cerrar' : 'Ver mes'}
            </button>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-800/50 bg-gray-800/20">
          {[
            { dot: 'bg-green-500', label: 'Completada' },
            { dot: 'bg-amber-500', label: 'Por vencer' },
            { dot: 'bg-red-500',   label: 'Vencida'    },
            { dot: 'bg-gray-500',  label: 'Pendiente'  },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3 h-3 text-gray-600" />
            <span className="text-xs text-gray-600">Click en el día para ver agenda</span>
          </div>
        </div>

        {/* Vista semana */}
        {!vistaCompleta && (
          <div className="p-3 grid grid-cols-7 gap-2">
            {diasSemana.map((dia, i) => {
              const esHoy = dia.getTime() === hoy.getTime()
              return (
                <DiaCol key={i} fecha={dia} tareas={tareas} hoy={hoy} esHoy={esHoy}
                  onClickTarea={onClickTarea}
                  onClickDia={abrirAgenda}
                  soloMia={soloMia} />
              )
            })}
          </div>
        )}

        {/* Vista mes */}
        {vistaCompleta && (
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {DIAS_SEMANA.map(d => (
                <p key={d} className="text-xs text-gray-600 text-center font-medium py-1">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: (diasMes[0].getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {diasMes.map((dia, i) => {
                const esHoy     = dia.getTime() === hoy.getTime()
                const esPasado  = dia < hoy && !esHoy
                const fechaStr  = `${dia.getFullYear()}-${String(dia.getMonth()+1).padStart(2,'0')}-${String(dia.getDate()).padStart(2,'0')}`
                const tareasDelDia = tareas.filter(t => t.fecha_termino === fechaStr)
                return (
                  <div key={i}
                    onClick={() => tareasDelDia.length > 0 && abrirAgenda(dia, tareasDelDia)}
                    className={`rounded-xl border p-1.5 min-h-[70px] transition
                      ${tareasDelDia.length > 0 ? 'cursor-pointer hover:bg-white/5' : ''}
                      ${esHoy
                        ? 'border-green-500/50 bg-green-950/20'
                        : esPasado
                        ? 'border-gray-800/30 bg-transparent'
                        : 'border-gray-800/50 bg-gray-900/30'}`}
                  >
                    <p className={`text-xs font-bold text-center mb-1 ${
                      esHoy ? 'text-green-400' : esPasado ? 'text-gray-700' : 'text-gray-400'
                    }`}>{dia.getDate()}</p>
                    <div className="space-y-0.5">
                      {tareasDelDia.slice(0, 3).map(t => {
                        const c = getColorEstado(t, hoy)
                        return (
                          <div key={t.id}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded-md border
                              text-[10px] ${c.bg} ${c.border}`}
                          >
                            {getIconoTipo(t.tipo, 'w-2 h-2')}
                            <span className={`truncate ${c.text}`}>
                              {soloMia ? t.nombre_tarea?.slice(0, 10) : getIniciales(t.responsable_nombre)}
                            </span>
                          </div>
                        )
                      })}
                      {tareasDelDia.length > 3 && (
                        <p className="text-[9px] text-gray-600 text-center">+{tareasDelDia.length - 3}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Panel agenda */}
      {agendaDia && (
        <AgendaDia
          fecha={agendaDia.fecha}
          tareas={agendaDia.tareas}
          hoy={hoy}
          soloMia={soloMia}
          onClose={() => setAgendaDia(null)}
          onClickTarea={onClickTarea}
        />
      )}
    </>
  )
}
