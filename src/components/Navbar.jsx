import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, ListChecks, LogOut, FolderKanban,
  HelpCircle, Bell, Lock, AlertTriangle
} from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import CambiadorMes from './CambiadorMes'
import PanelAyuda from './PanelAyuda'
import NotificacionesPanel from './NotificacionesPanel'
import { useNotificaciones } from '../hooks/useNotificaciones'
import logo from '../assets/logo_fdi.png'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export default function Navbar({ cicloSeleccionado, onCambiarCiclo }) {
  const [mostrarAyuda,       setMostrarAyuda]       = useState(false)
  const [mostrarNotif,       setMostrarNotif]       = useState(false)
  const [mostrarCerrarCiclo, setMostrarCerrarCiclo] = useState(false)
  const [tareasAfectadas,    setTareasAfectadas]    = useState(0)
  const [cargandoModal,      setCargandoModal]      = useState(false)
  const [cargandoCierre,     setCargandoCierre]     = useState(false)

  const { profile, signOut } = useAuth()
  const location    = useLocation()
  const queryClient = useQueryClient()
  const esGerente   = profile?.rol === 'gerente'
  const esAdmin     = profile?.rol === 'admin'

  const { totalNoLeidas } = useNotificaciones()

  const links = esGerente ? [
    { to: '/gerente',   label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/proyectos', label: 'Plan Operativo',  icon: FolderKanban },
  ] : [
    { to: '/',          label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/tareas',    label: 'Tareas',          icon: ListChecks },
    { to: '/proyectos', label: 'Plan Operativo',  icon: FolderKanban },
  ]

  function isActive(to) {
    if (to === '/gerente') return location.pathname.startsWith('/gerente')
    return location.pathname === to
  }

  // Badge: máximo "9+"
  const badgeLabel = totalNoLeidas > 9 ? '9+' : String(totalNoLeidas)

  // Botón cerrar ciclo: solo admin, solo cuando ciclo es activo o inactivo
  const mostrarBotonCierre = esAdmin && !esGerente &&
    (cicloSeleccionado?.estado === 'activo' || cicloSeleccionado?.estado === 'inactivo')

  const nombreDelCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  async function handleAbrirCerrarCiclo() {
    setMostrarCerrarCiclo(true)
    setCargandoModal(true)
    const { data } = await supabase
      .from('tasks')
      .select('id')
      .eq('ciclo_id', cicloSeleccionado.id)
      .in('estado', ['pendiente', 'con_atraso'])
    setTareasAfectadas(data?.length ?? 0)
    setCargandoModal(false)
  }

  async function handleConfirmarCierre() {
    setCargandoCierre(true)
    const hoy = new Date().toISOString().split('T')[0]
    try {
      // 1a. Marcar como no_completada solo las tareas disponibles (fecha_inicio <= hoy)
      await supabase
        .from('tasks')
        .update({ estado: 'no_completada' })
        .eq('ciclo_id', cicloSeleccionado.id)
        .in('estado', ['pendiente', 'con_atraso'])
        .or(`fecha_inicio.is.null,fecha_inicio.lte.${hoy}`)

      // 1b. Eliminar las tareas bloqueadas (fecha_inicio > hoy) — nunca estuvieron disponibles
      await supabase
        .from('tasks')
        .delete()
        .eq('ciclo_id', cicloSeleccionado.id)
        .in('estado', ['pendiente', 'con_atraso'])
        .gt('fecha_inicio', hoy)

      // 2. Cerrar el ciclo
      await supabase
        .from('monthly_cycles')
        .update({ estado: 'cerrado' })
        .eq('id', cicloSeleccionado.id)

      // 3. Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })

      // 4. Refrescar con el ciclo actualizado
      onCambiarCiclo?.({ ...cicloSeleccionado, estado: 'cerrado' })

      setMostrarCerrarCiclo(false)
    } catch (err) {
      console.error('Error al cerrar ciclo:', err)
    } finally {
      setCargandoCierre(false)
    }
  }

  return (
    <>
      <nav className="bg-gray-900 border-b border-gray-800 px-3 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">

          {/* Logo */}
          <div className="items-center gap-2 shrink-0 hidden sm:flex">
            <img src={logo} alt="FDI" className="h-12 w-auto" />
            <span className="font-bold text-white text-sm">
              {esGerente ? 'Vista Gerencial' : 'Gestión FDI'}
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm transition
                  ${isActive(to)
                    ? 'bg-green-800 text-green-300'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </div>

          {/* Selector mes + botones */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!esGerente && (
              <CambiadorMes
                cicloSeleccionado={cicloSeleccionado}
                onCambiarCiclo={onCambiarCiclo}
              />
            )}

            {/* Botón cerrar ciclo — solo admin cuando ciclo es activo o inactivo */}
            {mostrarBotonCierre && (
              <button
                onClick={handleAbrirCerrarCiclo}
                className="flex items-center gap-1 text-gray-400 hover:text-orange-400 transition p-1.5"
                title="Cerrar ciclo"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Cerrar ciclo</span>
              </button>
            )}

            {/* Ayuda */}
            <button
              onClick={() => setMostrarAyuda(true)}
              className="text-gray-400 hover:text-blue-400 transition p-1.5"
              title="Manual de uso"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Campana de notificaciones */}
            <button
              onClick={() => setMostrarNotif(v => !v)}
              className="relative text-gray-400 hover:text-amber-400 transition p-1.5"
              title="Notificaciones"
            >
              <Bell className="w-4 h-4" />
              {totalNoLeidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5
                                 bg-red-500 text-white text-[10px] font-bold
                                 rounded-full flex items-center justify-center leading-none">
                  {badgeLabel}
                </span>
              )}
            </button>

            {/* Cerrar sesión */}
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-red-400 transition p-1.5"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </nav>

      {/* Paneles — fuera del nav */}
      {mostrarAyuda && (
        <PanelAyuda onClose={() => setMostrarAyuda(false)} />
      )}

      {mostrarNotif && (
        <NotificacionesPanel onClose={() => setMostrarNotif(false)} />
      )}

      {/* Modal confirmación cierre de ciclo */}
      {mostrarCerrarCiclo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">

            {/* Header del modal */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-orange-900/40 rounded-xl shrink-0">
                <Lock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Cerrar ciclo</h3>
                <p className="text-gray-400 text-sm">{nombreDelCiclo}</p>
              </div>
            </div>

            {/* Contenido */}
            {cargandoModal ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                {tareasAfectadas > 0 ? (
                  <div className="bg-orange-950/40 border border-orange-800 rounded-xl px-4 py-3">
                    <p className="text-orange-300 text-sm font-medium">
                      {tareasAfectadas} tarea{tareasAfectadas !== 1 ? 's' : ''} pendiente{tareasAfectadas !== 1 ? 's' : ''} o con atraso
                    </p>
                    <p className="text-orange-400/70 text-xs mt-1">
                      Se marcarán como "no completada" al cerrar el ciclo.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-950/40 border border-green-800 rounded-xl px-4 py-3">
                    <p className="text-green-300 text-sm">Todas las tareas están completadas ✓</p>
                  </div>
                )}

                <div className="flex items-start gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-gray-400 text-xs">Esta acción no se puede deshacer</p>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarCerrarCiclo(false)}
                disabled={cargandoCierre}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300
                           py-2.5 rounded-xl text-sm transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCierre}
                disabled={cargandoCierre || cargandoModal}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-700
                           hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm
                           font-semibold transition disabled:opacity-50"
              >
                {cargandoCierre ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Cerrar ciclo
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
