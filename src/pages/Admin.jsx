import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const actionLabels = {
  blocked_privilege_escalation_attempt: 'Tentativa bloqueada: escalada de privilégios',
  blocked_self_approval_attempt: 'Tentativa bloqueada: auto-aprovação de loja',
  blocked_role_change_attempt: 'Tentativa bloqueada: mudança de função',
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

  // Multi-loja
  const [managerEmail, setManagerEmail] = useState('')
  const [grantCompanyId, setGrantCompanyId] = useState('')
  const [grantError, setGrantError] = useState('')
  const [granting, setGranting] = useState(false)
  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'registo') loadLogs() }, [tab])
  useEffect(() => { if (tab === 'multiloja') loadAssignments() }, [tab])

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

  async function loadAssignments() {
    setAssignmentsLoading(true)
    const { data } = await supabase
      .from('company_managers')
      .select('id, manager_id, company_id, created_at')
      .order('created_at', { ascending: false })

    const managerIds = [...new Set((data || []).map(a => a.manager_id))]
    const companyIds = [...new Set((data || []).map(a => a.company_id))]

    const [{ data: profs }, { data: comps }] = await Promise.all([
      managerIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', managerIds) : { data: [] },
      companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : { data: [] },
    ])
    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]))
    const compMap = Object.fromEntries((comps || []).map(c => [c.id, c]))

    setAssignments((data || []).map(a => ({
      ...a,
      managerName: profMap[a.manager_id]?.full_name || profMap[a.manager_id]?.email || a.manager_id,
      companyName: compMap[a.company_id]?.name || a.company_id,
    })))
    setAssignmentsLoading(false)
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

  async function handleGrant(e) {
    e.preventDefault()
    setGrantError('')
    setGranting(true)
    try {
      const { error } = await supabase.rpc('grant_company_access', {
        p_manager_email: managerEmail.trim(),
        p_company_id: grantCompanyId,
      })
      if (error) throw error
      setManagerEmail('')
      setGrantCompanyId('')
      await loadAssignments()
    } catch (err) {
      setGrantError(err.message)
    } finally {
      setGranting(false)
    }
  }

  async function handleRevoke(a) {
    if (!confirm(`Remover o acesso de ${a.managerName} à loja ${a.companyName}?`)) return
    await supabase.rpc('revoke_company_access', { p_manager_id: a.manager_id, p_company_id: a.company_id })
    await loadAssignments()
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
          <p>Aprova lojas, atribui acessos multi-loja, e acompanha o registo de segurança da plataforma.</p>
        </div>
      </div>

      <div className="category-nav">
        <button className={`category-pill ${tab === 'lojas' ? 'active' : ''}`} onClick={() => setTab('lojas')}>
          Lojas
        </button>
        <button className={`category-pill ${tab === 'multiloja' ? 'active' : ''}`} onClick={() => setTab('multiloja')}>
          Multi-loja
        </button>
        <button className={`category-pill ${tab === 'registo' ? 'active' : ''}`} onClick={() => setTab('registo')}>
          Registo de Segurança
        </button>
      </div>

      {tab === 'lojas' && (
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
      )}

      {tab === 'multiloja' && (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 24, maxWidth: 560 }}>
            <h3 style={{ marginBottom: 6 }}>Atribuir uma loja extra a um gestor</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 16 }}>
              O gestor precisa de já ter uma conta no FlowCommerce (dono da sua própria loja). Depois disto, vai ver
              um seletor de loja no menu lateral dele, para alternar entre as lojas que gere.
            </p>
            {grantError && <div className="alert error">{grantError}</div>}
            <form onSubmit={handleGrant}>
              <div className="field">
                <label>Email do gestor</label>
                <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Loja a atribuir</label>
                <select value={grantCompanyId} onChange={e => setGrantCompanyId(e.target.value)} required>
                  <option value="">Seleciona uma loja</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" disabled={granting}>
                {granting ? 'A atribuir...' : 'Atribuir acesso'}
              </button>
            </form>
          </div>

          <div className="card">
            <div style={{ padding: '16px 18px 0' }}><h3>Acessos multi-loja atuais</h3></div>
            {assignmentsLoading ? (
              <div className="empty-state">A carregar...</div>
            ) : assignments.length === 0 ? (
              <div className="empty-state">
                <h3>Ainda sem atribuições</h3>
                <p>Quando atribuíres uma loja extra a alguém, aparece aqui.</p>
              </div>
            ) : (
              <table>
                <thead><tr><th>Gestor</th><th>Loja atribuída</th><th>Desde</th><th></th></tr></thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.managerName}</td>
                      <td>{a.companyName}</td>
                      <td>{new Date(a.created_at).toLocaleDateString('pt-AO')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-danger" onClick={() => handleRevoke(a)}>Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'registo' && (
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
