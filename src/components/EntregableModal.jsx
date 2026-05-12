import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'

export default function EntregableModal({ proyectoId, entregable, onClose, onGuardado }) {
  const editando = !!entregable

  // Cargar responsables existentes si estamos editando
  const responsablesIniciales = entregable?.project_deliverable_responsables?.map(r => ({
    user_id: r.user.id,
    nombre:  r.user.nombre,
    cargo:   r.user.cargo,
    rol:     r.rol,
  })) ?? []

  const [form, setForm] = useState({
    edt:          entregable?.edt          ?? '',
    nombre:       entregable?.nombre       ?? '',
    fecha_inicio: entregable?.fecha_inicio ?? '',
    fecha_fin:    entregable?.fecha_fin    ?? '',
    comentarios:  entregable?.comentarios  ?? '',
    orden:        entregable?.orden        ?? 0,
    pct_real:     entregable?.pct_real     ?? 0,
  })
  const [responsables, setResponsables] = useState(responsablesIniciales)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-cdg'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users').select('id, nombre, cargo').eq('activo', true).order('nombre')
      return data ?? []
    }
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function agregarResponsable() {
    setResponsables(prev => [...prev, { user_id: '', nombre: '', cargo: '', rol: 'principal' }])
  }

  function quitarResponsable(idx) {
    setResponsables(prev => prev.filter((_, i) => i !== idx))
  }

  function cambiarResponsable(idx, campo, valor) {
    setResponsables(prev => prev.map((r, i) => {
      if (i !== idx) return r
      if (campo === 'user_id') {
        const usuario = usuarios.find(u => u.id === valor)
        return { ...r, user_id: valor, nombre: usuario?.nombre ?? '', cargo: usuario?.cargo ?? '' }
      }
      return { ...r, [campo]: valor }
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.fecha_inicio)  { setError('La fecha de inicio es obligatoria'); return }
    if (!form.fecha_fin)     { setError('La fecha de fin es obligatoria'); return }
    if (responsables.some(r => !r.user_id)) {
      setError('Selecciona un usuario para cada responsable'); return
    }
    setLoading(true)
    setError('')

    const pctReal = Math.min(100, Math.max(0, Number(form.pct_real) || 0))
    const estado  = pctReal === 100 ? 'completado' : pctReal > 0 ? 'en_progreso' : 'no_iniciado'

    const payload = {
      project_id:   proyectoId,
      edt:          form.edt.trim(),
      nombre:       form.nombre.trim(),
      fecha_inicio: form.fecha_inicio,
      fecha_fin:    form.fecha_fin,
      estado,
      comentarios:  form.comentarios.trim() || null,
      orden:        Number(form.orden),
      pct_real:     pctReal,
    }

    let deliverableId = entregable?.id

    if (editando) {
      const { error: err } = await supabase
        .from('project_deliverables').update(payload).eq('id', deliverableId)
      if (err) { setError('Error al guardar'); setLoading(false); return }
    } else {
      const { data, error: err } = await supabase
        .from('project_deliverables').insert(payload).select().single()
      if (err) { setError('Error al guardar'); setLoading(false); return }
      deliverableId = data.id
    }

    // Actualizar responsables — borrar los anteriores e insertar los nuevos
    await supabase
      .from('project_deliverable_responsables')
      .delete()
      .eq('deliverable_id', deliverableId)

    if (responsables.length > 0) {
      const { error: errResp } = await supabase
        .from('project_deliverable_responsables')
        .insert(responsables.map(r => ({
          deliverable_id: deliverableId,
          user_id:        r.user_id,
          rol:            r.rol,
        })))
      if (errResp) { setError('Error al guardar responsables'); setLoading(false); return }
    }

    onGuardado()
  }

  const pctReal = Number(form.pct_real) || 0

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">
            {editando ? 'Editar entregable' : 'Nuevo entregable'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">EDT</label>
              <input
                name="edt" type="text" value={form.edt} onChange={handleChange}
                placeholder="1.1, 1.2..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Orden</label>
              <input
                name="orden" type="number" value={form.orden} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              name="nombre" type="text" value={form.nombre} onChange={handleChange}
              placeholder="Nombre del entregable"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Responsables múltiples */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Responsables</label>
              <button
                type="button"
                onClick={agregarResponsable}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            {responsables.length === 0 ? (
              <p className="text-xs text-gray-600 py-2">Sin responsables asignados</p>
            ) : (
              <div className="space-y-2">
                {responsables.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={r.user_id}
                      onChange={e => cambiarResponsable(idx, 'user_id', e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg
                                 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nombre}</option>
                      ))}
                    </select>
                    <select
                      value={r.rol}
                      onChange={e => cambiarResponsable(idx, 'rol', e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg
                                 px-2 py-2 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="principal">Principal</option>
                      <option value="apoyo">Apoyo</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => quitarResponsable(idx)}
                      className="p-1.5 text-gray-600 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                name="fecha_inicio" type="date" value={form.fecha_inicio} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Fecha fin <span className="text-red-400">*</span>
              </label>
              <input
                name="fecha_fin" type="date" value={form.fecha_fin} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* % Real */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">% Avance real</label>
              <span className={`text-sm font-bold ${
                pctReal === 100 ? 'text-green-400'
                : pctReal > 50  ? 'text-blue-400'
                : pctReal > 0   ? 'text-amber-400'
                : 'text-gray-500'
              }`}>{pctReal}%</span>
            </div>
            <input
              name="pct_real" type="range" min="0" max="100" step="5"
              value={form.pct_real} onChange={handleChange}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-700 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <div className="mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                pctReal === 100 ? 'bg-green-900 text-green-300'
                : pctReal > 0   ? 'bg-blue-900 text-blue-300'
                : 'bg-gray-800 text-gray-500'
              }`}>
                {pctReal === 100 ? 'Completado' : pctReal > 0 ? 'En progreso' : 'No iniciado'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Comentarios</label>
            <textarea
              name="comentarios" value={form.comentarios} onChange={handleChange}
              rows={2} placeholder="Observaciones opcionales..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold
                       py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar entregable'}
          </button>
        </form>
      </div>
    </div>
  )
}
