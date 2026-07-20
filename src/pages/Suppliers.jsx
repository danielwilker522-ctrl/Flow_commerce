import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const emptyForm = { name: '', contact_person: '', phone: '', email: '', nif: '', address: '', city: '' }

export default function Suppliers() {
  const { company } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => { if (company?.id) load() }, [company?.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', company.id)
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ ...emptyForm, ...item })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        const { error } = await supabase.from('suppliers').update(form).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('suppliers').insert({ ...form, company_id: company.id, is_active: true })
        if (error) throw error
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este fornecedor?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fornecedores</h1>
          <p>Gere os fornecedores dos teus produtos.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo fornecedor</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum fornecedor ainda</h3>
            <p>Adiciona o primeiro fornecedor para ligar aos teus produtos.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Nome</th><th>Contacto</th><th>Telefone</th><th>Cidade</th><th></th></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{s.contact_person || '—'}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.city || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => openEdit(s)}>Editar</button>
                    <button className="btn-danger" onClick={() => handleDelete(s.id)}>Eliminar</button>
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
            <h2>{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Pessoa de contacto</label>
                <input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label>NIF</label>
                <input value={form.nif} onChange={e => setForm({ ...form, nif: e.target.value })} />
              </div>
              <div className="field">
                <label>Cidade</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
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
