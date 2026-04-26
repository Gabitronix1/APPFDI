import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useCiclos } from './hooks/useCiclo'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tareas from './pages/Tareas'
import Navbar from './components/Navbar'
import Register from './pages/Register'
import Proyectos from './pages/Proyectos'
import DashboardGerente from './pages/DashboardGerente'
import DetalleDepto from './pages/DetalleDepto'

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
  return user ? <Navigate to="/" replace /> : children
}

function AppInner() {
  const { user, profile } = useAuth()  // ← agrega profile aquí
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

  const esGerente = profile?.rol === 'gerente'

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

        {/* Ruta raíz — redirige según rol */}
        <Route path="/" element={
          <PrivateRoute>
            {esGerente
              ? <Navigate to="/gerente" replace />
              : <Dashboard cicloSeleccionado={cicloSeleccionado} />}
          </PrivateRoute>
        } />

        {/* Rutas usuarios/admins */}
        <Route path="/tareas" element={
          <PrivateRoute>
            <Tareas cicloSeleccionado={cicloSeleccionado} />
          </PrivateRoute>
        } />
        <Route path="/proyectos" element={
          <PrivateRoute>
            <Proyectos />
          </PrivateRoute>
        } />

        {/* Rutas gerente */}
        <Route path="/gerente" element={
          <PrivateRoute>
            <DashboardGerente />
          </PrivateRoute>
        } />
        <Route path="/gerente/depto/:depto" element={
          <PrivateRoute>
            <DetalleDepto />
          </PrivateRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={
          <Navigate to={esGerente ? '/gerente' : '/'} replace />
        } />
      </Routes>
    </div>
  )
}

export default function App() {
  return <AppInner />
}