import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

export default function Dashboard() {
  const { company, profile } = useAuth()
  const [stats, setStats] = useState({ revenue: 0, count: 0, lowStock: 0 })
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [loginEvents, setLoginEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company?.id) return
    loadDashboard()
  }, [company?.id])

  async function loadDashboard() {
    setLoading(true)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, created_at, payment_method, status')
      .eq('company_id', company.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })

    const validSales = (sales || []).filter(s => s.status !== 'cancelled')
    const revenue = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0)

    const { data: products } = await supabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock')
      .eq('company_id', company.id)
      .eq('is_active', true)

    const lowStock = (products || []).filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock ?? 0))

    setStats({ revenue, count: validSales.length, lowStock: lowStock.length })
    setLowStockProducts(lowStock.slice(0, 6))
    setRecentSales(validSales.slice(0, 6))

    if (profile?.role === 'admin') {
      const { data: logins } = await supabase
        .from('login_events')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(8)
      setLoginEvents(logins || [])
    }

    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do desempenho de hoje, {new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="label">Receita de hoje</div>
          <div className="value">{loading ? '—' : formatKz(stats.revenue)}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Vendas de hoje</div>
          <div className="value accent">{loading ? '—' : stats.count}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Produtos com stock baixo</div>
          <div className="value danger">{loading ? '—' : stats.lowStock}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ padding: '16px 18px 0' }}><h3>Últimas vendas</h3></div>
          {recentSales.length === 0 ? (
            <div className="empty-state">
              <h3>Ainda sem vendas hoje</h3>
              <p>Regista a primeira venda no Ponto de Venda.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Hora</th><th>Método</th><th>Total</th></tr>
              </thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ textTransform: 'capitalize' }}>{s.payment_method || '—'}</td>
                    <td className="mono">{formatKz(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Stock baixo</h3>
            {stats.lowStock > 0 && (
              <Link to="/app/produtos?stock=baixo" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Ver todos ({stats.lowStock}) →
              </Link>
            )}
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="empty-state">
              <h3>Tudo em ordem</h3>
              <p>Nenhum produto abaixo do stock mínimo.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Produto</th><th>Stock</th></tr>
              </thead>
              <tbody>
                {lowStockProducts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="badge low">{p.stock_quantity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {profile?.role === 'admin' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ padding: '16px 18px 0' }}><h3>🔔 Acessos recentes da equipa</h3></div>
          {loginEvents.length === 0 ? (
            <div className="empty-state"><p>Ainda sem registos de acesso.</p></div>
          ) : (
            <table>
              <thead><tr><th>Funcionário</th><th>Função</th><th>Quando</th></tr></thead>
              <tbody>
                {loginEvents.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 600 }}>{ev.full_name || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{ev.role}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{new Date(ev.created_at).toLocaleString('pt-AO')}</td>
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
