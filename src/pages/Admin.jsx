import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const actionLabels = {
  blocked_privilege_escalation_attempt: 'Tentativa bloqueada: escalada de privilégios',
  blocked_self_approval_attempt: 'Tentativa bloqueada: auto-aprovação de loja',
  company_approved: 'Loja aprovada',
  company_revoked: 'Aprovação de loja revogada',
}

export default function Admin() {
  const [tab, setTab] = useState('lojas')
  const [companies, setCompanies] = useState([])
  const [owners, setOwners] = useState({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'registo') loadLogs() }, [tab])

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

  async function loadLogs() {
    setLogsLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs(data || [])
    setLogsLoading(false)
  }

  async function toggleApproval(company) {
    setUpdatingId(company.id)
    const nextState = !company.is_approved
    await supabase.from('companies').update({ is_approved: nextState }).eq('id', company.id)
    await supabase.from('audit_log').insert({
      company_id: company.id,
      action: nextState ? 'company_approved' : 'company_revoked',
      entity_type: 'companies',
      entity_id: company.id,
      details: { nome: company.name },
    })
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
          <p>Aprova lojas e acompanha o registo de segurança da plataforma.</p>
        </div>
      </div>

      <div className="category-nav">
        <button className={`category-pill ${tab === 'lojas' ? 'active' : ''}`} onClick={() => setTab('lojas')}>
          Lojas
        </button>
        <button className={`category-pill ${tab === 'registo' ? 'active' : ''}`} onClick={() => setTab('registo')}>
          Registo de Segurança
        </button>
      </div>

      {tab === 'lojas' ? (
        <>
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
        </>
      ) : (
        <div className="card">
          {logsLoading ? (
            <div className="empty-state">A carregar...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <h3>Sem registos ainda</h3>
              <p>Ações de segurança e aprovações vão aparecer aqui.</p>
            </div>
          ) : (
            <table>
              <thead><tr><th>Quando</th><th>Ação</th><th>Detalhes</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('pt-AO')}</td>
                    <td>
                      <span className={`badge ${l.action.startsWith('blocked_') ? 'low' : 'ok'}`}>
                        {actionLabels[l.action] || l.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 400 }}>
                      {l.details ? JSON.stringify(l.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
