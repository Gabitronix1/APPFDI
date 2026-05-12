import { useState, useMemo } from 'react'
import { RefreshCw, CalendarClock, Sparkles, Lock, ChevronLeft, ChevronRight, X } from 'lucide-react'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getIniciales(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()
}

function getColorEstado(tarea, hoy) {
  const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy

  if (estaBloqueada) return { bg: 'bg-gray-800', text: 'text-gray-600', border: 'border-gray-700', dot: 'bg-gray-600' }
  if (tarea.estado === 'completada' || tarea.estado === 'completada_con_atraso')
    return { bg: 'bg-green-900/40', text: 'text-green-300', border: 'border-green-800', dot: 'bg-green-500' }
  if (tarea.alerta === 'fuera_de_plazo' || tarea.estado === 'con_atraso')
    return { bg: 'bg-red-900/40', text: 'text-red-300', border: 'border-red-800', dot: 'bg-red-500' }
  if (tarea.alerta === 'por_vencer')
    return { bg: 'bg-amber-900/40', text: 'text-amber-300', border: 'border-amber-800', dot: 'bg-amber-500' }
  return { bg: 'bg-gray-800/60', text: 'text-gray-300', border: 'border-gray-700', dot: 'bg-gray-500' }
}

function getIconoTipo(tipo, className = 'w-2.5 h-2.5') {
  if (tipo === 'cierre') return <RefreshCw className={`${className} text-blue-400`} />
  if (tipo === 'recurrente_mes') return <CalendarClock className={`${className} text-purple-400`} />
  return <Sparkles className={`${className} text-amber-400`} />
}

function TareaChip({ tarea, hoy, onClick, soloMia }) {
  const estaBloqueada = tarea.serie_id && tarea.fecha_inicio &&
    new Date(tarea.fecha_inicio + 'T00:00:00') > hoy
  const colores = getColorEstado(tarea, hoy)
  const iniciales = getIniciales(tarea.responsable_nombre)

  // Abreviar nombre tarea a ~12 chars
  const nombreCorto = tarea.nombre_tarea?.length > 14
    ? tarea.nombre_tarea.slice(0, 13) + '…'
    : tarea.nombre_tarea

  return (
    <div
      onClick={estaBloqueada ? undefined : onClick}
      className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs
        transition-all duration-150 group
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

function DiaCol({ fecha, tareas, hoy, esHoy, onClick, soloMia, MAX_VISIBLE = 3 }) {
  const [expandido, setExpandido] = useState(false)
  const esPasado = fecha < hoy && !esHoy
  const esFuturo = fecha > hoy

  const tareasDelDia = tareas.filter(t => {
    const ft = t.fecha_termino
    return ft === `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
  })

  const visibles  = expandido ? tareasDelDia : tareasDelDia.slice(0, MAX_VISIBLE)
  const ocultas   = tareasDelDia.length - MAX_VISIBLE

  return (
    <div className={`flex flex-col min-w-0 rounded-xl border transition-all
      ${esHoy
        ? 'border-green-500/50 bg-green-950/20'
        : esPasado
        ? 'border-gray-800/50 bg-gray-900/30'
        : 'border-gray-800 bg-gray-900/50'}`}
    >
      {/* Header día */}
      <div className={`px-2 py-2 text-center border-b ${esHoy ? 'border-green-500/30' : 'border-gray-800/50'}`}>
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

      {/* Tareas */}
      <div className="p-1.5 space-y-1 flex-1">
        {tareasDelDia.length === 0 ? (
          <div className="h-6" />
        ) : (
          <>
            {visibles.map(t => (
              <TareaChip
                key={t.id}
                tarea={t}
                hoy={hoy}
                soloMia={soloMia}
                onClick={() => onClick(t)}
              />
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

export default function CalendarioTareas({ tareas, onClickTarea, soloMia = false }) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [vistaCompleta, setVistaCompleta] = useState(false)
  const [semanaOffset, setSemanaOffset]   = useState(0)

  // ── Semana actual ─────────────────────────────────────────
  const diasSemana = useMemo(() => {
    const lunes = new Date(hoy)
    const diaSemana = (hoy.getDay() + 6) % 7
    lunes.setDate(hoy.getDate() - diaSemana + semanaOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }, [semanaOffset])

  // ── Mes completo ──────────────────────────────────────────
  const diasMes = useMemo(() => {
    const año  = hoy.getFullYear()
    const mes  = hoy.getMonth()
    const dias = new Date(año, mes + 1, 0).getDate()
    return Array.from({ length: dias }, (_, i) => new Date(año, mes, i + 1))
  }, [])

  const semanaLabel = (() => {
    const ini = diasSemana[0]
    const fin = diasSemana[6]
    if (semanaOffset === 0) return 'Esta semana'
    if (semanaOffset === -1) return 'Semana pasada'
    if (semanaOffset === 1) return 'Próxima semana'
    return `${ini.getDate()} — ${fin.getDate()} ${fin.toLocaleDateString('es-CL', { month: 'short' })}`
  })()

  return (
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
            {vistaCompleta ? `Calendario — ${hoy.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}` : semanaLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!vistaCompleta && (
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setSemanaOffset(s => s - 1)}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSemanaOffset(0)}
                disabled={semanaOffset === 0}
                className="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-700
                           transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Hoy
              </button>
              <button
                onClick={() => setSemanaOffset(s => s + 1)}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
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
          { dot: 'bg-green-500',  label: 'Completada' },
          { dot: 'bg-amber-500',  label: 'Por vencer' },
          { dot: 'bg-red-500',    label: 'Vencida' },
          { dot: 'bg-gray-500',   label: 'Pendiente' },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <RefreshCw className="w-2.5 h-2.5 text-blue-400" />
          <span className="text-xs text-gray-600">Cierre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarClock className="w-2.5 h-2.5 text-purple-400" />
          <span className="text-xs text-gray-600">Recurrente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-xs text-gray-600">Puntual</span>
        </div>
      </div>

      {/* Vista semana */}
      {!vistaCompleta && (
        <div className="p-3 grid grid-cols-7 gap-2">
          {diasSemana.map((dia, i) => {
            const esHoy = dia.getTime() === hoy.getTime()
            return (
              <DiaCol
                key={i}
                fecha={dia}
                tareas={tareas}
                hoy={hoy}
                esHoy={esHoy}
                onClick={onClickTarea}
                soloMia={soloMia}
              />
            )
          })}
        </div>
      )}

      {/* Vista mes completo */}
      {vistaCompleta && (
        <div className="p-3">
          {/* Headers días semana */}
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DIAS_SEMANA.map(d => (
              <p key={d} className="text-xs text-gray-600 text-center font-medium py-1">{d}</p>
            ))}
          </div>

          {/* Grid días del mes */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Espacios vacíos antes del día 1 */}
            {Array.from({ length: (diasMes[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {diasMes.map((dia, i) => {
              const esHoy = dia.getTime() === hoy.getTime()
              const esPasado = dia < hoy && !esHoy
              const fechaStr = `${dia.getFullYear()}-${String(dia.getMonth()+1).padStart(2,'0')}-${String(dia.getDate()).padStart(2,'0')}`
              const tareasDelDia = tareas.filter(t => t.fecha_termino === fechaStr)

              return (
                <div key={i} className={`rounded-xl border p-1.5 min-h-[70px] transition
                  ${esHoy
                    ? 'border-green-500/50 bg-green-950/20'
                    : esPasado
                    ? 'border-gray-800/30 bg-transparent'
                    : 'border-gray-800/50 bg-gray-900/30'}`}
                >
                  <p className={`text-xs font-bold text-center mb-1 ${
                    esHoy ? 'text-green-400' : esPasado ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {dia.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {tareasDelDia.slice(0, 3).map(t => {
                      const c = getColorEstado(t, hoy)
                      return (
                        <div
                          key={t.id}
                          onClick={() => onClickTarea(t)}
                          className={`flex items-center gap-1 px-1 py-0.5 rounded-md border cursor-pointer
                            hover:brightness-125 transition text-[10px] ${c.bg} ${c.border}`}
                        >
                          {getIconoTipo(t.tipo, 'w-2 h-2')}
                          <span className={`truncate ${c.text}`}>
                            {soloMia
                              ? t.nombre_tarea?.slice(0, 10)
                              : getIniciales(t.responsable_nombre)}
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
  )
}
