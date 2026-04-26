import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TreePine } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: { nombre: form.nombre }
      }
    })

    if (error) {
      setError(error.message === 'User already registered'
        ? 'Este email ya está registrado'
        : 'Error al registrarse, intenta de nuevo')
      setLoading(false)
      return
    }

    // Registro exitoso → ir al login
    navigate('/login', { state: { mensaje: 'Cuenta creada. Ya puedes ingresar.' } })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-green-800 p-3 rounded-2xl mb-4">
            <TreePine className="w-8 h-8 text-green-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
          <p className="text-gray-400 text-sm mt-1">Cierres Mensuales CDG</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre completo</label>
            <input
              name="nombre"
              type="text"
              value={form.nombre}
              onChange={handleChange}
              required
              placeholder="Juan Pérez"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 
                         text-white focus:outline-none focus:border-green-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="tu@empresa.cl"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 
                         text-white focus:outline-none focus:border-green-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 
                         text-white focus:outline-none focus:border-green-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirmar contraseña</label>
            <input
              name="confirm"
              type="password"
              value={form.confirm}
              onChange={handleChange}
              required
              placeholder="Repite la contraseña"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 
                         text-white focus:outline-none focus:border-green-500 transition"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold 
                       py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-green-400 hover:text-green-300 transition">
              Ingresar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}