import { useState } from 'react'
import { X, Calendar, ExternalLink } from 'lucide-react'
import { generarLinkGoogleCalendar, formatDuracion } from '../lib/googleCalendar'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatFechaLegible(fechaStr) {
  if (!fechaStr) return '—'
  const [a, m, d] = fechaStr.split('-').map(Number)
  return `${d} de ${MESES[m-1]} ${a}`
}

export default function GoogleCalendarModal({ tarea, onClose }) {
  const [horaInicio, setHoraInicio] = useState('09:00')
  const link = generarLinkGoogleCalendar(tarea, horaInicio)

  // Calcular hora fin para el resumen
  const duracion = tarea.duracion_estimada_min ?? 60
  const [hh, mm] = horaInicio.split(':').map(Number)
  const finMin = hh * 60 + mm + duracion
  const finHH = String(Math.floor(finMin / 60) % 24).padStart(2, '0')
  const finMM = String(finMin % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Agregar a Google Calendar
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del evento */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 mb-4 space-y-1.5">
          <p className="text-white text-sm font-medium">{tarea.nombre_tarea}</p>
          <p className="text-gray-400 text-xs">📅 {formatFechaLegible(tarea.fecha_termino)}</p>
          <p className="text-gray-400 text-xs">⏱ Duración: {formatDuracion(duracion)}</p>
          <p className="text-gray-400 text-xs">🕐 {horaInicio} – {finHH}:{finMM}</p>
        </div>

        {/* Selector de hora */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1">Hora de inicio</label>
          <input
            type="time"
            value={horaInicio}
            onChange={e => setHoraInicio(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition">
            Cancelar
          </button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600
                       text-white py-2.5 rounded-xl text-sm font-semibold transition"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir en Calendar
          </a>
        </div>
      </div>
    </div>
  )
}
