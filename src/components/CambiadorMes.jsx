import { useCiclos, useCrearCiclo, useActivarCiclo, useEliminarCiclo } from '../hooks/useCiclo'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Zap, Trash2 } from 'lucide-react'
import { useState } from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export default function CambiadorMes({ cicloSeleccionado, onCambiarCiclo }) {
  const { profile }  = useAuth()
  const { data: ciclos = [] } = useCiclos()
  const { mutate: crearCiclo,   isPending: creando }   = useCrearCiclo()
  const { mutate: activarCiclo, isPending: activando } = useActivarCiclo()
  const { mutate: eliminarCiclo,isPending: eliminando } = useEliminarCiclo()

  const [confirmando,  setConfirmando]  = useState(null)  // {tipo: 'crear'|'activar'|'eliminar', mes?, anio?}
  const [exito, setExito] = useState('')

  if (!cicloSeleccionado) return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      <span className="text-sm text-gray-500">Cargando ciclo...</span>
    </div>
  )

  const idx      = ciclos.findIndex(c => c.id === cicloSeleccionado.id)
  const anterior = ciclos[idx + 1] ?? null
  const siguiente = ciclos[idx - 1] ?? null
  const esActivo = cicloSeleccionado.estado === 'activo'

  // Próximo mes sin ciclo
  const hoy = new Date()
  let mesNext  = hoy.getMonth() + 2
  let anioNext = hoy.getFullYear()
  if (mesNext > 12) { mesNext -= 12; anioNext++ }
  while (ciclos.some(c => c.mes === mesNext && c.anio === anioNext)) {
    mesNext++
    if (mesNext > 12) { mesNext = 1; anioNext++ }
  }

  const isPending = creando || activando || eliminando

  function handleConfirmar() {
    if (!confirmando) return

    if (confirmando.tipo === 'crear') {
      crearCiclo({ mes: confirmando.mes, anio: confirmando.anio }, {
        onSuccess: (nuevoCiclo) => {
          mostrarExito('Ciclo generado correctamente')
          setConfirmando(null)
          onCambiarCiclo(nuevoCiclo)
        }
      })
    }

    if (confirmando.tipo === 'activar') {
      activarCiclo(cicloSeleccionado.id, {
        onSuccess: (cicloActualizado) => {
          mostrarExito('Ciclo activado correctamente')
          setConfirmando(null)
          onCambiarCiclo({ ...cicloSeleccionado, estado: 'activo' })
        }
      })
    }

    if (confirmando.tipo === 'eliminar') {
      const cicloAnteriorAlEliminado = anterior ?? siguiente
      eliminarCiclo(cicloSeleccionado.id, {
        onSuccess: () => {
          mostrarExito('Ciclo eliminado')
          setConfirmando(null)
          if (cicloAnteriorAlEliminado) onCambiarCiclo(cicloAnteriorAlEliminado)
        }
      })
    }
  }

  function mostrarExito(msg) {
    setExito(msg)
    setTimeout(() => setExito(''), 3000)
  }

  const textoConfirmacion = {
    crear:   `Se generarán las 22 tareas de ${confirmando ? MESES[confirmando.mes-1] : ''} ${confirmando?.anio} con fechas según el calendario hábil chileno. El ciclo actual quedará cerrado.`,
    activar: `El ciclo de ${MESES[cicloSeleccionado.mes-1]} ${cicloSeleccionado.anio} quedará como activo y el actual se cerrará.`,
    eliminar:`Se eliminarán permanentemente el ciclo y todas sus tareas de ${MESES[cicloSeleccionado.mes-1]} ${cicloSeleccionado.anio}. Esta acción no se puede deshacer.`,
  }

  return (
    <>
      <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">

        {/* Retroceder */}
        <button
          onClick={() => anterior && onCambiarCiclo(anterior)}
          disabled={!anterior}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700
                     transition disabled:opacity-30 disabled:cursor-not-allowed"
          title={anterior ? `← ${MESES[anterior.mes-1]} ${anterior.anio}` : 'No hay ciclos anteriores'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Mes */}
        <span className="px-3 text-sm font-medium text-white min-w-[150px] text-center">
          {MESES[cicloSeleccionado.mes - 1]} {cicloSeleccionado.anio}
          {esActivo
            ? <span className="ml-2 text-xs text-green-400">● activo</span>
            : <span className="ml-2 text-xs text-gray-500">● cerrado</span>}
        </span>

        {/* Avanzar */}
        <button
          onClick={() => siguiente && onCambiarCiclo(siguiente)}
          disabled={!siguiente}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700
                     transition disabled:opacity-30 disabled:cursor-not-allowed"
          title={siguiente ? `${MESES[siguiente.mes-1]} ${siguiente.anio} →` : ''}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {profile?.rol === 'admin' && (
          <>
            {/* Activar ciclo — solo si está cerrado */}
            {!esActivo && (
              <button
                onClick={() => setConfirmando({ tipo: 'activar' })}
                className="ml-1 p-1.5 rounded-md text-amber-400 hover:text-amber-300
                           hover:bg-gray-700 transition"
                title={`Activar ${MESES[cicloSeleccionado.mes-1]} ${cicloSeleccionado.anio}`}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            {/* Eliminar ciclo */}
            <button
              onClick={() => setConfirmando({ tipo: 'eliminar' })}
              className="p-1.5 rounded-md text-red-500 hover:text-red-400
                         hover:bg-gray-700 transition"
              title={`Eliminar ciclo ${MESES[cicloSeleccionado.mes-1]}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Nuevo ciclo */}
            <button
              onClick={() => setConfirmando({ tipo: 'crear', mes: mesNext, anio: anioNext })}
              className="p-1.5 rounded-md text-green-400 hover:text-green-300
                         hover:bg-gray-700 transition"
              title={`Abrir ciclo ${MESES[mesNext-1]} ${anioNext}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Modal confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-2">
              {confirmando.tipo === 'crear'   && `¿Abrir ciclo ${MESES[confirmando.mes-1]} ${confirmando.anio}?`}
              {confirmando.tipo === 'activar' && `¿Activar ${MESES[cicloSeleccionado.mes-1]} ${cicloSeleccionado.anio}?`}
              {confirmando.tipo === 'eliminar'&& `¿Eliminar ciclo ${MESES[cicloSeleccionado.mes-1]} ${cicloSeleccionado.anio}?`}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {confirmando.tipo && textoConfirmacion[confirmando.tipo]}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                           py-2.5 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 text-white 
                           py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50
                           ${confirmando.tipo === 'eliminar'
                             ? 'bg-red-700 hover:bg-red-600'
                             : 'bg-green-700 hover:bg-green-600'}`}
              >
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                  : confirmando.tipo === 'eliminar' ? 'Eliminar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {exito && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-green-800
                        border border-green-600 text-green-200 px-4 py-3 rounded-xl
                        shadow-xl z-50 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {exito}
        </div>
      )}
    </>
  )
}