import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo_fdi.png'

export default function Login() {
  const { signIn }   = useAuth()
  const navigate     = useNavigate()
  const location     = useLocation()
  const mensajeExito = location.state?.mensaje

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">

        {/* Logo y nombre empresa */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl px-8 py-6 mb-5 flex flex-col items-center">
            <img
              src={logo}
              alt="Agrícola y Forestal Doña Isidora"
              className="h-24 w-auto mb-3"
            />
            <div className="border-t border-gray-700 w-full pt-3 text-center">
              <p className="text-gray-400 text-xs uppercase tracking-widest">
                Agrícola y Forestal
              </p>
              <p className="text-green-400 font-bold text-lg tracking-wide">
                Doña Isidora
              </p>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Portal de Gestión FDI</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa con tu cuenta corporativa</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">

          {mensajeExito && (
            <div className="bg-green-900 border border-green-700 text-green-300 text-sm
                            rounded-lg px-4 py-3 mb-6">
              {mensajeExito}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Email corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5
                         text-white focus:outline-none focus:border-green-500 transition"
              placeholder="usuario@isidorachile.cl"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5
                         text-white focus:outline-none focus:border-green-500 transition"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold
                       py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-green-400 hover:text-green-300 transition">
              Regístrate
            </Link>
          </p>
        </form>

        <p className="text-center text-gray-700 text-xs mt-6">
          Desarrollado por Gabriel Valderrama
        </p>
      </div>
    </div>
  )
}
