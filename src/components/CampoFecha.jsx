import { useState, useEffect, useRef } from 'react'

/**
 * Reemplaza <input type="date"> con tres inputs DD / MM / AAAA.
 * value y onChange usan el formato YYYY-MM-DD (compatible con Supabase).
 */
export default function CampoFecha({ value, onChange, className = '' }) {
  const [dia,  setDia]  = useState('')
  const [mes,  setMes]  = useState('')
  const [anio, setAnio] = useState('')

  const mesRef  = useRef()
  const anioRef = useRef()

  // Sincronizar cuando el valor cambia externamente (init desde BD, reset al guardar, etc.)
  useEffect(() => {
    const interno = (dia.length === 2 && mes.length === 2 && anio.length === 4)
      ? `${anio}-${mes}-${dia}` : ''
    if (value === interno) return          // cambio nuestro propio, ignorar

    if (!value) {
      setDia(''); setMes(''); setAnio('')
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-')
      setAnio(y); setMes(m); setDia(d)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function emitir(d, m, y) {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const nd = Number(d), nm = Number(m), ny = Number(y)
      if (nd >= 1 && nd <= 31 && nm >= 1 && nm <= 12 && ny >= 1900) {
        onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
      }
    }
  }

  function handleDia(raw) {
    const v = raw.replace(/\D/g, '').slice(0, 2)
    setDia(v)
    if (v.length === 2) mesRef.current?.focus()
    emitir(v, mes, anio)
  }

  function handleMes(raw) {
    const v = raw.replace(/\D/g, '').slice(0, 2)
    setMes(v)
    if (v.length === 2) anioRef.current?.focus()
    emitir(dia, v, anio)
  }

  function handleAnio(raw) {
    const v = raw.replace(/\D/g, '').slice(0, 4)
    setAnio(v)
    emitir(dia, mes, v)
  }

  // Backspace en mes vacío vuelve a día; en año vacío vuelve a mes
  function handleMesKey(e) {
    if (e.key === 'Backspace' && mes === '') e.target.previousSibling?.previousSibling?.focus()
  }
  function handleAnioKey(e) {
    if (e.key === 'Backspace' && anio === '') e.target.previousSibling?.previousSibling?.focus()
  }

  const base = 'bg-transparent text-white text-xs focus:outline-none text-center'

  return (
    <div className={`flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg
                     px-2 py-1.5 focus-within:border-blue-500 transition ${className}`}>
      <input
        type="text" inputMode="numeric" maxLength="2"
        value={dia} onChange={e => handleDia(e.target.value)}
        placeholder="DD"
        className={`w-7 ${base}`}
      />
      <span className="text-gray-600 text-xs select-none">/</span>
      <input
        ref={mesRef}
        type="text" inputMode="numeric" maxLength="2"
        value={mes} onChange={e => handleMes(e.target.value)}
        onKeyDown={handleMesKey}
        placeholder="MM"
        className={`w-7 ${base}`}
      />
      <span className="text-gray-600 text-xs select-none">/</span>
      <input
        ref={anioRef}
        type="text" inputMode="numeric" maxLength="4"
        value={anio} onChange={e => handleAnio(e.target.value)}
        onKeyDown={handleAnioKey}
        placeholder="AAAA"
        className={`w-12 ${base}`}
      />
    </div>
  )
}
