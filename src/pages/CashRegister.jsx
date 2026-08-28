import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

const paymentLabels = {
  dinheiro: 'Dinheiro',
  multicaixa: 'Multicaixa',
  transferencia: 'Transferência',
  cartao: 'Cartão',
}

export default function CashRegister() {
  const { company, profile } = useAuth()
  const [current, setCurrent] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [cashSalesTotal, setCashSalesTotal] = useState(0)
  const [error, setError] = useState('')
  const [reportLoadingId, setReportLoadingId] = useState(null)

  useEffect(() => { if (company?.id) load() }, [company?.id])

  async function load() {
    setLoading(true)
    const { data: open } = await supabase
      .from('cash_register')
      .select('*')
      .eq('company_id', company.id)
      .eq('status', 'aberto')
      .order('opened_at', { ascending: false })
      .maybeSingle()

    setCurrent(open || null)

    if (open) {
      const { data: sales } = await supabase
        .from('sales')
        .select('total')
        .eq('company_id', company.id)
        .eq('payment_method', 'dinheiro')
        .neq('status', 'cancelled')
        .gte('created_at', open.opened_at)
      const total = (sales || []).reduce((s, r) => s + Number(r.total || 0), 0)
      setCashSalesTotal(total)
    }

    const { data: closed } = await supabase
      .from('cash_register')
      .select('*')
      .eq('company_id', company.id)
      .eq('status', 'fechado')
      .order('closed_at', { ascending: false })
      .limit(8)

    setHistory(closed || [])
    setLoading(false)
  }

  async function handleOpen(e) {
    e.preventDefault()
    setError('')
    const value = Number(openingAmount || 0)
    const confirmed = window.confirm(
      `Confirmas o valor de abertura?\n\n${formatKz(value)}\n\nSe este valor não corresponder ao que contaste na gaveta, cancela e corrige — repara sobretudo se usaste um ponto (.) para separar milhares, o sistema lê o ponto como vírgula decimal.`
    )
    if (!confirmed) return
    try {
      const { error } = await supabase.from('cash_register').insert({
        company_id: company.id,
        profile_id: profile.id,
        opening_amount: value,
        status: 'aberto',
        opened_at: new Date().toISOString(),
      })
      if (error) throw error
      setOpeningAmount('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleClose(e) {
    e.preventDefault()
    setError('')
    const closing = Number(closingAmount || 0)
    const confirmed = window.confirm(
      `Confirmas o valor contado no fecho?\n\n${formatKz(closing)}\n\nSe este valor não corresponder ao que contaste na gaveta, cancela e corrige — repara sobretudo se usaste um ponto (.) para separar milhares, o sistema lê o ponto como vírgula decimal.`
    )
    if (!confirmed) return
    try {
      const expected = Number(current.opening_amount || 0) + cashSalesTotal
      const { error } = await supabase.from('cash_register').update({
        closing_amount: closing,
        expected_amount: expected,
        difference: closing - expected,
        status: 'fechado',
        closed_at: new Date().toISOString(),
      }).eq('id', current.id)
      if (error) throw error
      setClosingAmount('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function downloadReport(session) {
    setReportLoadingId(session.id)
    try {
      const periodEnd = session.closed_at || new Date().toISOString()

      const [{ data: sales }, { data: operatorProfile }] = await Promise.all([
        supabase
          .from('sales')
          .select('*')
          .eq('company_id', company.id)
          .neq('status', 'cancelled')
          .gte('created_at', session.opened_at)
          .lte('created_at', periodEnd),
        supabase.from('profiles').select('full_name').eq('id', session.profile_id).maybeSingle(),
      ])

      const salesList = sales || []
      const totalVendido = salesList.reduce((s, r) => s + Number(r.total || 0), 0)
      const totalDesconto = salesList.reduce((s, r) => s + Number(r.discount || 0), 0)
      const totalTroco = salesList.reduce((s, r) => s + Number(r.change_amount || 0), 0)

      const saleIds = salesList.map(s => s.id)
      let productRows = []
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from('sales_itens')
          .select('quantity, subtotal, product_id, products(name)')
          .in('sales_id', saleIds)

        const byProduct = {}
        for (const it of items || []) {
          const key = it.product_id
          if (!byProduct[key]) {
            byProduct[key] = { name: it.products?.name || 'Produto removido', quantity: 0, total: 0 }
          }
          byProduct[key].quantity += Number(it.quantity || 0)
          byProduct[key].total += Number(it.subtotal || 0)
        }
        productRows = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity)
      }

      const byMethod = {}
      for (const s of salesList) {
        const key = s.payment_method || 'outro'
        byMethod[key] = (byMethod[key] || 0) + Number(s.total || 0)
      }

      const doc = new jsPDF()
      const dateLabel = new Date(session.opened_at).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })

      doc.setFontSize(17)
      doc.text(company?.name || 'FlowCommerce', 14, 18)
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Relatório de Caixa · ${dateLabel}`, 14, 26)
      doc.text(`Operador: ${operatorProfile?.full_name || '—'}`, 14, 32)

      autoTable(doc, {
        startY: 40,
        head: [['Resumo financeiro', 'Valor']],
        body: [
          ['Valor de abertura', formatKz(session.opening_amount)],
          ['Total vendido', formatKz(totalVendido)],
          ['Número de vendas', String(salesList.length)],
          ['Desconto total concedido', formatKz(totalDesconto)],
          ['Troco total entregue', formatKz(totalTroco)],
          ['Valor esperado no fecho', formatKz(session.expected_amount)],
          ['Valor contado no fecho', formatKz(session.closing_amount)],
          ['Diferença', formatKz(session.difference)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [31, 77, 61] },
      })

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Método de pagamento', 'Total']],
        body: Object.entries(byMethod).map(([method, value]) => [paymentLabels[method] || method, formatKz(value)]),
        theme: 'grid',
        headStyles: { fillColor: [31, 77, 61] },
      })

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Produto', 'Quantidade', 'Total vendido']],
        body: productRows.length > 0
          ? productRows.map(p => [p.name, String(p.quantity), formatKz(p.total)])
          : [['Nenhum produto vendido neste turno', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [31, 77, 61] },
        styles: { fontSize: 9 },
      })

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Hora', 'Método', 'Total']],
        body: salesList.map(s => [
          new Date(s.created_at).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }),
          paymentLabels[s.payment_method] || s.payment_method || '—',
          formatKz(s.total),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 77, 61] },
        styles: { fontSize: 9 },
      })

      doc.save(`relatorio-caixa-${new Date(session.opened_at).toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      setError('Erro ao gerar relatório: ' + err.message)
    } finally {
      setReportLoadingId(null)
    }
  }

  if (loading) return <div className="empty-state">A carregar...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Caixa</h1>
          <p>Abertura, fecho e controlo de diferenças de caixa.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {!current ? (
        <div className="card" style={{ padding: 24, maxWidth: 420 }}>
          <h3 style={{ marginBottom: 6 }}>Abrir caixa</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 16 }}>Define o valor inicial em dinheiro para começar as vendas.</p>
          <form onSubmit={handleOpen}>
            <div className="field">
              <label>Valor de abertura</label>
              <input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="ex: 30000 (sem pontos nem vírgulas)" required />
              {openingAmount !== '' && (
                <p style={{ fontSize: 13, marginTop: 6, color: 'var(--primary)', fontWeight: 600 }}>
                  = {formatKz(Number(openingAmount))}
                </p>
              )}
            </div>
            <button className="btn-primary" style={{ width: '100%' }}>Abrir caixa</button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ padding: 24, maxWidth: 460 }}>
          <div className="badge ok" style={{ marginBottom: 12 }}>Caixa aberto</div>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div>
              <div className="label" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Abertura</div>
              <div className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}>{formatKz(current.opening_amount)}</div>
            </div>
            <div>
              <div className="label" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Vendas em dinheiro</div>
              <div className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}>{formatKz(cashSalesTotal)}</div>
            </div>
          </div>
          <div className="cart-totals" style={{ marginBottom: 18 }}>
            <div className="row total"><span>Valor esperado</span><span>{formatKz(Number(current.opening_amount || 0) + cashSalesTotal)}</span></div>
          </div>
          <form onSubmit={handleClose}>
            <div className="field">
              <label>Valor contado no fecho</label>
              <input type="number" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder="ex: 176875 (sem pontos nem vírgulas)" required />
              {closingAmount !== '' && (
                <p style={{ fontSize: 13, marginTop: 6, color: 'var(--primary)', fontWeight: 600 }}>
                  = {formatKz(Number(closingAmount))}
                </p>
              )}
            </div>
            <button className="btn-primary" style={{ width: '100%' }}>Fechar caixa</button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ padding: '16px 18px 0' }}><h3>Histórico de fechos</h3></div>
        {history.length === 0 ? (
          <div className="empty-state"><p>Ainda sem fechos de caixa registados.</p></div>
        ) : (
          <table>
            <thead><tr><th>Data</th><th>Abertura</th><th>Esperado</th><th>Contado</th><th>Diferença</th><th></th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.closed_at).toLocaleString('pt-AO')}</td>
                  <td className="mono">{formatKz(h.opening_amount)}</td>
                  <td className="mono">{formatKz(h.expected_amount)}</td>
                  <td className="mono">{formatKz(h.closing_amount)}</td>
                  <td>
                    <span className={`badge ${Number(h.difference) === 0 ? 'ok' : 'low'}`}>{formatKz(h.difference)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => downloadReport(h)} disabled={reportLoadingId === h.id}>
                      {reportLoadingId === h.id ? 'A gerar...' : '⬇ PDF'}
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
