import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function CompleteSetup() {
  const { session, signOut, reload } = useAuth()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const userId = session.user.id

      // Garante que não existe já uma empresa (idempotente, em caso de retry)
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!existingCompany) {
        const { error: companyError } = await supabase
          .from('companies')
          .insert({ id: userId, name: companyName })
        if (companyError) throw companyError
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, company_id: userId, full_name: fullName, role: 'admin' })
      if (profileError) throw profileError

      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Flow<span>Commerce</span></div>
        <p className="auth-subtitle">
          Falta completar o registo da tua conta. Preenche os dados da tua empresa para continuar.
        </p>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>O teu nome completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Nome da empresa</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'A concluir...' : 'Concluir registo'}
          </button>
        </form>

        <div className="auth-toggle">
          <button onClick={signOut}>Terminar sessão</button>
        </div>
      </div>
    </div>
  )
}
