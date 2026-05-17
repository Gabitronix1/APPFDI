import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'

/**
 * Dropdown de áreas con botón eliminar por fila (solo admin).
 * Antes de borrar verifica que no haya tareas usando el área.
 */
export default function AreaSelector({ value, onChange, areas, queryKey, isAdmin }) {
  const queryClient = useQueryClient()
  const [open,         setOpen]         = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [errorId,      setErrorId]      = useState(null)
  const [errorMsg,     setErrorMsg]     = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setErrorId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleEliminar(e, area) {
    e.stopPropagation()
    setErrorId(null)
    setEliminandoId(area.id)

    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('area', area.nombre)

    if (error || count === null) {
      setEliminandoId(null)
      return
    }

    if (count > 0) {
      setEliminandoId(null)
      setErrorId(area.id)
      setErrorMsg(`${count} tarea${count !== 1 ? 's' : ''} usa${count !== 1 ? 'n' : ''} esta área`)
      return
    }

    await supabase.from('areas').update({ activo: false }).eq('id', area.id)
    setEliminandoId(null)
    if (value === area.nombre) onChange('')
    queryClient.invalidateQueries({ queryKey })
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setErrorId(null) }}
        className="w-full flex items-center justify-between bg-gray-800 border border-gray-700
                   text-sm rounded-lg px-3 py-2.5 focus:outline-none hover:border-gray-600
                   transition"
      >
        <span className={value ? 'text-gray-300' : 'text-gray-500'}>
          {value || 'Seleccionar área...'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 w-full mt-1 bg-gray-800 border border-gray-700
                        rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {/* Opción vacía */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-500
                         hover:bg-gray-700 transition"
            >
              Sin área
            </button>

            {areas.map(a => (
              <div key={a.id}>
                <div className={`flex items-center justify-between px-3 py-2
                  hover:bg-gray-700/60 transition
                  ${value === a.nombre ? 'bg-gray-700/40' : ''}`}>
                  {/* Nombre — selecciona el área */}
                  <button
                    type="button"
                    onClick={() => { onChange(a.nombre); setOpen(false) }}
                    className="flex-1 text-left text-sm text-gray-300 truncate"
                  >
                    {a.nombre}
                  </button>

                  {/* Botón eliminar — solo admin */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => handleEliminar(e, a)}
                      disabled={eliminandoId === a.id}
                      title="Eliminar área"
                      className="ml-2 p-1 rounded hover:bg-red-900/40 text-gray-600
                                 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {eliminandoId === a.id
                        ? <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                        : <X className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Error inline bajo el área con tareas */}
                {errorId === a.id && (
                  <p className="px-3 pb-1.5 text-[10px] text-red-400">{errorMsg}</p>
                )}
              </div>
            ))}

            {areas.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-600">Sin áreas creadas</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
