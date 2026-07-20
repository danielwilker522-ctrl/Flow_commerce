import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const [companies, setCompanies] = useState([])
  const [owners, setOwners] = useState({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: comps } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })

    setCompanies(comps || [])

    if (comps?.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', comps.map(c => c.id))
      const map = {}
      for (const p of profs || []) map[p.id] = p
      setOwners(map)
    }
    setLoading(false)
  }

  async function toggleApproval(company) {
    setUpdatingId(company.id)
    await supabase.from('companies').update({ is_approved: !company.is_approved }).eq('id', company.id)
    await load()
    setUpdatingId(null)
  }

  const filtered = companies.filter(c => {
    if (filter === 'pending') return !c.is_approved
    if (filter === 'approved') return c.is_approved
    return true
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Painel de Administração</h1>
          <p>Aprova ou revoga o acesso de lojas à plataforma FlowCommerce.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="category-nav" style={{ marginBottom: 0 }}>
          <button className={`category-pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            Pendentes
          </button>
          <button className={`category-pill ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>
            Aprovadas
          </button>
          <button className={`category-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Todas
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Nada por aqui</h3>
            <p>Não há lojas nesta categoria de momento.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Empresa</th><th>Responsável</th><th>Criada em</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{owners[c.id]?.full_name || '—'}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('pt-AO')}</td>
                  <td>
                    <span className={`badge ${c.is_approved ? 'ok' : 'low'}`}>
                      {c.is_approved ? 'Aprovada' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={c.is_approved ? 'btn-danger' : 'btn-primary'}
                      onClick={() => toggleApproval(c)}
                      disabled={updatingId === c.id}
                    >
                      {updatingId === c.id ? '...' : c.is_approved ? 'Revogar' : 'Aprovar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
