import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/pdv', label: 'Ponto de Venda' },
  { to: '/app/caixa', label: 'Caixa' },
  { to: '/app/produtos', label: 'Produtos' },
  { to: '/app/categorias', label: 'Categorias' },
  { to: '/app/fornecedores', label: 'Fornecedores' },
]

export default function Layout() {
  const { profile, company, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Flow<span>Commerce</span></div>
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
