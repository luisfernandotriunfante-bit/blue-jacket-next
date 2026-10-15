export function CampaignTab() {
  return (
    <>
      <header className="topbar" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>
            Campanhas
          </span>
        </div>
      </header>
      <section className="content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center', gap: 12 }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>📋</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, lineHeight: 1.6 }}>
          Módulo de campanhas em construção.<br />
          Em breve será possível cadastrar e apurar campanhas por aqui.
        </p>
      </section>
    </>
  )
}
