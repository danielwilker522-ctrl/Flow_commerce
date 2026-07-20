import { Link } from 'react-router-dom'

const features = [
  { title: 'Ponto de Venda rápido', text: 'Pesquisa por nome, SKU ou código de barras, carrinho intuitivo e cálculo automático de troco.' },
  { title: 'Controlo de Stock', text: 'Stock atualizado automaticamente a cada venda, com alertas de stock mínimo em tempo real.' },
  { title: 'Gestão de Caixa', text: 'Abertura e fecho de turno com cálculo automático de diferenças entre o esperado e o contado.' },
  { title: 'Relatórios em PDF', text: 'Gera relatórios diários de vendas e caixa prontos para exportar e partilhar.' },
  { title: 'Dashboard em tempo real', text: 'Receita, número de vendas e produtos com stock baixo, tudo num único ecrã.' },
  { title: 'Multi-loja', text: 'Cada empresa gere os seus próprios produtos, categorias, fornecedores e equipa.' },
]

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">Flow<span>Commerce</span></div>
        <Link to="/login" className="btn-primary landing-nav-cta">Entrar</Link>
      </header>

      <section className="landing-hero">
        <h1>Gestão comercial e ponto de venda,<br />numa só plataforma.</h1>
        <p>
          Vendas, stock, caixa e relatórios — tudo integrado, para deixares de perder tempo
          com controlo manual e passares a decidir com dados reais.
        </p>
        <div className="landing-hero-actions">
          <Link to="/login" className="btn-primary landing-cta-lg">Começar agora</Link>
          <a href="#funcionalidades" className="btn-secondary landing-cta-lg">Ver funcionalidades</a>
        </div>
      </section>

      <section className="landing-features" id="funcionalidades">
        <h2>Tudo o que o teu negócio precisa</h2>
        <div className="landing-features-grid">
          {features.map(f => (
            <div className="landing-feature-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-section">
        <h2>Pronto para organizar o teu negócio?</h2>
        <p>Cria a tua conta gratuitamente. A tua loja fica ativa assim que for aprovada pela nossa equipa.</p>
        <Link to="/login" className="btn-primary landing-cta-lg">Criar a minha conta</Link>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} FlowCommerce</span>
      </footer>
    </div>
  )
}
