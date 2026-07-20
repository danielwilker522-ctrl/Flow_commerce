import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Categories() {
  const { company } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState('')

  useEffect(() => { if (company?.id) load() }, [company?.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', company.id)
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ name: item.name || '', description: item.description || '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        const { error } = await supabase.from('categories').update(form).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert({ ...form, company_id: company.id, is_active: true })
        if (error) throw error
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta categoria?')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Categorias</h1>
          <p>Organiza os teus produtos por categoria.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Nova categoria</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma categoria ainda</h3>
            <p>Cria a primeira categoria para começar a organizar os produtos.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Nome</th><th>Descrição</th><th></th></tr></thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{c.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn-danger" onClick={() => handleDelete(c.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Descrição</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
