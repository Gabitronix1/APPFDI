import { useCiclos, useCrearCiclo, useEliminarCiclo } from '../hooks/useCiclo'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Trash2, Lock } from 'lucide-react'
import { useState } from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

// Nombre de display: mes N → "Cierre de [mes N-1]"
function nombreCierre(mes, anio) {
  if (mes === 1) return `Cierre de Diciembre ${anio - 1}`
  return `Cierre de ${MESES[mes - 2]} ${anio}`
}

export default function CambiadorMes({ cicloSeleccionado, onCambiarCiclo }) {
  const { profile }  = useAuth()
  const { data: ciclos = [] } = useCiclos()
  const { mutate: crearCiclo,   isPending: creando }   = useCrearCiclo()
  const { mutate: eliminarCiclo, isPending: eliminando } = useEliminarCiclo()

  const [confirmando, setConfirmando] = useState(null)
  const [exito, setExito]             = useState('')

  if (!cicloSeleccionado) return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      <span className="text-sm text-gray-500">Cargando...</span>
    </div>
  )

  const idx       = ciclos.findIndex(c => c.id === cicloSeleccionado.id)
  const anterior  = ciclos[idx + 1] ?? null
  const siguiente = ciclos[idx - 1] ?? null
  const esActivo  = cicloSeleccionado.estado === 'activo'

  // Próximo mes para nuevo cierre
  const hoy = new Date()
  let mesNext  = hoy.getMonth() + 2
  let anioNext = hoy.getFullYear()
  if (mesNext > 12) { mesNext -= 12; anioNext++ }
  while (ciclos.some(c => c.mes === mesNext && c.anio === anioNext)) {
    mesNext++
    if (mesNext > 12) { mesNext = 1; anioNext++ }
  }

  const isPending = creando || eliminando

  function handleConfirmar() {
    if (!confirmando) return
    if (confirmando.tipo === 'crear') {
      crearCiclo({ mes: confirmando.mes, anio: confirmando.anio }, {
        onSuccess: (nuevoCiclo) => {
          mostrarExito(`${nombreCierre(confirmando.mes, confirmando.anio)} creado`)
          setConfirmando(null)
          onCambiarCiclo(nuevoCiclo)
        }
      })
    }
    if (confirmando.tipo === 'eliminar') {
      const fallback = anterior ?? siguiente
      eliminarCiclo(cicloSeleccionado.id, {
        onSuccess: () => {
          mostrarExito('Cierre eliminado')
          setConfirmando(null)
          if (fallback) onCambiarCiclo(fallback)
        }
      })
    }
  }

  function mostrarExito(msg) {
    setExito(msg)
    setTimeout(() => setExito(''), 3000)
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
          title={anterior ? `← ${nombreCierre(anterior.mes, anterior.anio)}` : ''}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Nombre del cierre */}
        <span className="px-2 text-sm font-medium text-white min-w-[120px] sm:min-w-[180px] text-center">
          {nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio)}
          {esActivo
            ? <span className="ml-1.5 text-xs text-green-400">● activo</span>
            : <span className="ml-1.5 text-xs text-gray-600">🔒 cerrado</span>}
        </span>

        {/* Avanzar */}
        <button
          onClick={() => siguiente && onCambiarCiclo(siguiente)}
          disabled={!siguiente}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700
                     transition disabled:opacity-30 disabled:cursor-not-allowed"
          title={siguiente ? `${nombreCierre(siguiente.mes, siguiente.anio)} →` : ''}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {profile?.rol === 'admin' && (
          <>
            {/* Eliminar — solo en activo */}
            {esActivo && (
              <button
                onClick={() => setConfirmando({ tipo: 'eliminar' })}
                className="p-1.5 rounded-md text-red-500 hover:text-red-400 hover:bg-gray-700 transition"
                title="Eliminar este cierre"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Nuevo cierre */}
            <button
              onClick={() => setConfirmando({ tipo: 'crear', mes: mesNext, anio: anioNext })}
              className="p-1.5 rounded-md text-green-400 hover:text-green-300 hover:bg-gray-700 transition"
              title={`Crear ${nombreCierre(mesNext, anioNext)}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Banner ciclo cerrado */}
      {!esActivo && (
        <div className="fixed top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700
                          text-gray-400 text-xs px-4 py-2 rounded-full shadow-lg">
            <Lock className="w-3 h-3" />
            Estás viendo {nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio)} — solo lectura
          </div>
        </div>
      )}

      {/* Modal confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-2">
              {confirmando.tipo === 'crear'
                ? `¿Crear ${nombreCierre(confirmando.mes, confirmando.anio)}?`
                : `¿Eliminar ${nombreCierre(cicloSeleccionado.mes, cicloSeleccionado.anio)}?`}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {confirmando.tipo === 'crear'
                ? `Se generarán las tareas recurrentes del cierre con fechas según el calendario hábil chileno. El cierre actual quedará cerrado.`
                : `Se eliminarán permanentemente todas las tareas de este cierre. Esta acción no se puede deshacer.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 text-white
                           py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50
                           ${confirmando.tipo === 'eliminar' ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}
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
                        border border-green-600 text-green-200 px-4 py-3 rounded-xl shadow-xl z-50 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {exito}
        </div>
      )}
    </>
  )
}
