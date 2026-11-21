import { useState } from 'react'

// Casca do app. As abas estão vazias e serão construídas seguindo PADRAO-VISUAL.md.
// Os motores de dados ficam em src/domain e ainda não são chamados pela tela.

const TABS = ['Sell out', 'Estoque', 'Clientes', 'Campanhas', 'Administração'] as const
type Tab = (typeof TABS)[number]

export function App() {
  const [tab, setTab] = useState<Tab>('Sell out')

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Navegação principal">
        {TABS.map(name => (
          <button
            key={name}
            type="button"
            className={`nav-item${tab === name ? ' on' : ''}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="main">
        <h1 className="page-title">{tab}</h1>
        <p className="page-empty">Em construção.</p>
      </main>
    </div>
  )
}
