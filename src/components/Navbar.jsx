import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, ListChecks, LogOut, FolderKanban, HelpCircle, Bell } from 'lucide-react'
import { useState } from 'react'
import CambiadorMes from './CambiadorMes'
import PanelAyuda from './PanelAyuda'
import NotificacionesPanel from './NotificacionesPanel'
import { useNotificaciones } from '../hooks/useNotificaciones'
import logo from '../assets/logo_fdi.png'

export default function Navbar({ cicloSeleccionado, onCambiarCiclo }) {
  const [mostrarAyuda,  setMostrarAyuda]  = useState(false)
  const [mostrarNotif,  setMostrarNotif]  = useState(false)
  const { profile, signOut } = useAuth()
  const location   = useLocation()
  const esGerente  = profile?.rol === 'gerente'

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
    </>
  )
}
