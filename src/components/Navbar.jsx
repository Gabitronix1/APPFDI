import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TreePine, LayoutDashboard, ListChecks, LogOut } from 'lucide-react'
import CambiadorMes from './CambiadorMes'

export default function Navbar({ cicloSeleccionado, onCambiarCiclo }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const links = [
    { to: '/',       label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tareas', label: 'Tareas',    icon: ListChecks },
  ]

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <TreePine className="w-5 h-5 text-green-400" />
          <span className="font-bold text-white text-sm hidden sm:block">Cierres CDG</span>
        </div>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition
                ${location.pathname === to
                  ? 'bg-green-800 text-green-300'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <CambiadorMes
            cicloSeleccionado={cicloSeleccionado}
            onCambiarCiclo={onCambiarCiclo}
          />
          <span className="text-sm text-gray-400 hidden lg:block">
            {profile?.nombre ?? ''}
          </span>
          <button
            onClick={signOut}
            className="text-gray-400 hover:text-red-400 transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}