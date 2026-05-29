import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generarNotificaciones } from '../hooks/useNotificaciones'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient           = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data)
    setLoading(false)

    if (data) {
      // Generar notificaciones en background (no bloquea el login)
      generarNotificaciones(userId, data.rol, data.departamento, data.last_seen_at)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['notificaciones', userId] })
        })
        .catch(console.error)

      // Actualizar last_seen_at para la próxima sesión
      supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then()
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signIn, signOut,
      esSubgerente:    profile?.rol === 'subgerente',
      deptosAsignados: profile?.deptos_asignados ?? [],
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
