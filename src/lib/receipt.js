import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const paymentLabels = { dinheiro: 'Dinheiro', multicaixa: 'Multicaixa', transferencia: 'Transferência', cartao: 'Cartão' }

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

// items: [{ name, quantity, unitPrice }]
export function downloadReceipt({ companyName, sale, items, cashier }) {
  const doc = new jsPDF({ format: [80, 200], unit: 'mm' })
  let y = 10

  doc.setFontSize(11)
  doc.text(companyName || 'FlowCommerce', 40, y, { align: 'center' })
  y += 6
  doc.setFontSize(8)
  doc.text('Recibo de venda (sem valor fiscal)', 40, y, { align: 'center' })
  y += 4
  doc.text(new Date(sale.created_at || Date.now()).toLocaleString('pt-AO'), 40, y, { align: 'center' })
  y += 4
  doc.text(`Operador: ${cashier || '—'}`, 40, y, { align: 'center' })
  y += 4
  doc.text(`Venda #${sale.id.slice(0, 8)}`, 40, y, { align: 'center' })
  y += 6

  autoTable(doc, {
    startY: y,
    margin: { left: 4, right: 4 },
    head: [['Produto', 'Qtd', 'Total']],
    body: items.map(it => [it.name, String(it.quantity), formatKz(it.unitPrice * it.quantity)]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 77, 61] },
    theme: 'grid',
  })

  let finalY = doc.lastAutoTable.finalY + 4
  doc.setFontSize(8)
  doc.text(`Subtotal: ${formatKz(sale.subtotal)}`, 4, finalY); finalY += 4
  doc.text(`Desconto: ${formatKz(sale.discount)}`, 4, finalY); finalY += 4
  doc.setFontSize(10)
  doc.text(`Total: ${formatKz(sale.total)}`, 4, finalY); finalY += 5
  doc.setFontSize(8)
  doc.text(`Método: ${paymentLabels[sale.payment_method] || sale.payment_method}`, 4, finalY); finalY += 4
  if (sale.payment_method === 'dinheiro') {
    doc.text(`Recebido: ${formatKz(sale.amount_received)}`, 4, finalY); finalY += 4
    doc.text(`Troco: ${formatKz(sale.change_amount)}`, 4, finalY); finalY += 4
  }
  finalY += 4
  doc.setFontSize(7)
  doc.text('Obrigado pela preferência!', 40, finalY, { align: 'center' })

  doc.save(`recibo-${sale.id.slice(0, 8)}.pdf`)
}
