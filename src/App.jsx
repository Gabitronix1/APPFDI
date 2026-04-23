import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useCiclos } from './hooks/useCiclo'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tareas from './pages/Tareas'
import Navbar from './components/Navbar'
import Register from './pages/Register'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Si ya está logueado, redirigir al dashboard
  return user ? <Navigate to="/" replace /> : children
}

function AppInner() {
  const { user } = useAuth()
  const { data: ciclos = [] } = useCiclos()
  const [cicloSeleccionado, setCicloSeleccionado] = useState(null)

  useEffect(() => {
    if (ciclos.length > 0 && !cicloSeleccionado) {
      const activo = ciclos.find(c => c.estado === 'activo') ?? ciclos[0]
      setCicloSeleccionado(activo)
    }
  }, [ciclos])

  function handleCambiarCiclo(ciclo) {
    setCicloSeleccionado(ciclo)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {user && (
        <Navbar
          cicloSeleccionado={cicloSeleccionado}
          onCambiarCiclo={handleCambiarCiclo}
        />
      )}
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Rutas privadas */}
        <Route path="/" element={
          <PrivateRoute>
            <Dashboard cicloSeleccionado={cicloSeleccionado} />
          </PrivateRoute>
        } />
        <Route path="/tareas" element={
          <PrivateRoute>
            <Tareas cicloSeleccionado={cicloSeleccionado} />
          </PrivateRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return <AppInner />
}