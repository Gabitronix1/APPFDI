import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TreePine, LayoutDashboard, ListChecks, LogOut, FolderKanban } from 'lucide-react'
import CambiadorMes from './CambiadorMes'

export default function Navbar({ cicloSeleccionado, onCambiarCiclo }) {
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

  // El link activo del gerente debe considerar subrutas
  function isActive(to) {
    if (to === '/gerente') return location.pathname.startsWith('/gerente')
    return location.pathname === to
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-3 py-2">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">

        {/* Logo */}
        <div className="items-center gap-2 shrink-0 hidden sm:flex">
          <TreePine className="w-5 h-5 text-green-400" />
          <span className="font-bold text-white text-sm">
            {esGerente ? 'Vista Gerencial' : 'Cierres CDG'}
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

        {/* Selector mes + logout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!esGerente && (
            <CambiadorMes
              cicloSeleccionado={cicloSeleccionado}
              onCambiarCiclo={onCambiarCiclo}
            />
          )}
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
  )
}