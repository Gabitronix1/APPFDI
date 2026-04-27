import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, ListChecks, LogOut, FolderKanban, HelpCircle } from 'lucide-react'
import CambiadorMes from './CambiadorMes'
import PanelAyuda from './PanelAyuda'
import logo from '../assets/logo_fdi.png'
import { useState } from 'react'

export default function Navbar({ cicloSeleccionado, onCambiarCiclo }) {
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const { profile, signOut } = useAuth()
  const location  = useLocation()
  const esGerente = profile?.rol === 'gerente'

  const links = esGerente ? [
    { to: '/gerente',   label: 'Dashboard', icon: LayoutDashboard },
    { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  ] : [
    { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tareas',    label: 'Tareas',    icon: ListChecks },
    { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  ]

  function isActive(to) {
    if (to === '/gerente') return location.pathname.startsWith('/gerente')
    return location.pathname === to
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
            <button
              onClick={() => setMostrarAyuda(true)}
              className="text-gray-400 hover:text-blue-400 transition p-1.5"
              title="Manual de uso"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
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

      {/* Panel ayuda — fuera del nav */}
      {mostrarAyuda && (
        <PanelAyuda onClose={() => setMostrarAyuda(false)} />
      )}
    </>
  )
}
