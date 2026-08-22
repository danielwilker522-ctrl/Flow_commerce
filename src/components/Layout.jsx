import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const baseLinks = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/pdv', label: 'Ponto de Venda' },
  { to: '/app/caixa', label: 'Caixa' },
  { to: '/app/produtos', label: 'Produtos' },
  { to: '/app/categorias', label: 'Categorias' },
  { to: '/app/fornecedores', label: 'Fornecedores' },
]

const adminOnlyLinks = [
  { to: '/app/lucro', label: 'Lucro & Stock' },
  { to: '/app/equipa', label: 'Funcionários' },
]

export default function Layout() {
  const { profile, company, accessibleCompanies, switchCompany, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const links = isAdmin ? [...baseLinks.slice(0, 4), ...adminOnlyLinks, ...baseLinks.slice(4), { to: '/app/seguranca', label: 'Segurança' }] : [...baseLinks, { to: '/app/seguranca', label: 'Segurança' }]
  const hasMultipleCompanies = accessibleCompanies.length > 1

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Flow<span>Commerce</span></div>

        {hasMultipleCompanies && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#9DA69C', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 6, padding: '0 4px' }}>
              Loja ativa
            </label>
            <select
              value={company?.id || ''}
              onChange={e => switchCompany(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.08)', color: 'white',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5,
              }}
            >
              {accessibleCompanies.map(c => (
                <option key={c.id} value={c.id} style={{ color: '#1A2420' }}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav>
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
          {profile?.is_platform_admin && (
            <NavLink to="/admin" style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18 }}>
              ⚙ Painel Admin
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="name">{profile?.full_name || 'Utilizador'}</div>
          <div className="role">{profile?.role || 'operador'} · {company?.name || ''}</div>
          <button className="btn-ghost" style={{ marginTop: 10, padding: 0, color: '#C7CDC4' }} onClick={signOut}>
            Terminar sessão
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
