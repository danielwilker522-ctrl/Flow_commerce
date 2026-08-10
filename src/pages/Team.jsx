import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Team() {
  const { company, profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { if (company?.id) load() }, [company?.id])

  if (profile?.role !== 'admin') {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <h3>Acesso restrito</h3>
        <p>Esta página só está disponível para administradores da loja.</p>
      </div>
    )
  }

  async function load() {
    setLoading(true)
    const [{ data: emps }, { data: invs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('company_id', company.id).order('created_at', { ascending: true }),
      supabase.from('invites').select('*').eq('company_id', company.id).is('used_at', null).order('created_at', { ascending: false }),
    ])
    setEmployees(emps || [])
    setInvites((invs || []).filter(i => new Date(i.expires_at) > new Date()))
    setLoading(false)
  }

  async function generateInvite() {
    setError('')
    setGenerating(true)
    try {
      const { error } = await supabase.from('invites').insert({ company_id: company.id, role: 'operador', created_by: profile.id })
      if (error) throw error
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function cancelInvite(id) {
    await supabase.from('invites').delete().eq('id', id)
    await load()
  }

  async function toggleActive(employee) {
    await supabase.from('profiles').update({ is_active: !employee.is_active }).eq('id', employee.id)
    await load()
  }

  async function toggleRole(employee) {
    const nextRole = employee.role === 'admin' ? 'operador' : 'admin'
    await supabase.from('profiles').update({ role: nextRole }).eq('id', employee.id)
    await load()
  }

  function copyInviteLink(invite) {
    const link = `${window.location.origin}/login?convite=${invite.code}`
    navigator.clipboard.writeText(link)
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Funcionários</h1>
          <p>Convida operadores para a tua loja e gere quem tem acesso.</p>
        </div>
        <button className="btn-primary" onClick={generateInvite} disabled={generating}>
          {generating ? 'A gerar...' : '+ Gerar convite'}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {invites.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 18px 0' }}><h3>Convites por usar</h3></div>
          <table>
            <thead><tr><th>Criado em</th><th>Expira em</th><th></th><th></th></tr></thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id}>
                  <td>{new Date(inv.created_at).toLocaleDateString('pt-AO')}</td>
                  <td>{new Date(inv.expires_at).toLocaleDateString('pt-AO')}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => copyInviteLink(inv)}>
                      {copiedId === inv.id ? 'Copiado!' : 'Copiar link'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-danger" onClick={() => cancelInvite(inv.id)}>Cancelar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '16px 18px 0' }}><h3>Equipa</h3></div>
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : (
          <table>
            <thead><tr><th>Nome</th><th>Função</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.full_name}{e.id === profile.id ? ' (tu)' : ''}</td>
                  <td style={{ textTransform: 'capitalize' }}>{e.role}</td>
                  <td>
                    <span className={`badge ${e.is_active ? 'ok' : 'low'}`}>{e.is_active ? 'Ativo' : 'Desativado'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {e.id !== profile.id && (
                      <>
                        <button className="btn-ghost" onClick={() => toggleRole(e)}>
                          Tornar {e.role === 'admin' ? 'operador' : 'admin'}
                        </button>
                        <button className={e.is_active ? 'btn-danger' : 'btn-secondary'} onClick={() => toggleActive(e)}>
                          {e.is_active ? 'Desativar' : 'Reativar'}
                        </button>
                      </>
                    )}
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
