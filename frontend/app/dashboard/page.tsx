'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getIncidents, getMetrics, type Incident, type Metrics } from '@/lib/api'

function SeverityBadge({ s }: { s: string }) {
  return <span className={`severity ${s}`}>{s}</span>
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [view, setView] = useState<'incidents' | 'war-room' | 'timeline' | 'audit'>('war-room')
  const [role, setRole] = useState('Incident Lead')

  useEffect(() => {
    getIncidents().then(setIncidents)
    getMetrics().then(setMetrics)
  }, [])

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <a className="brand" href="#">
          <div className="brand-mark">S</div>
          <span>sentinel</span>
        </a>
        <div className="workspace-switcher">
          <span className="mini-dot" />
          <span>shop-demo</span>
          <span className="chevron" style={{ marginLeft: 'auto' }}>⌄</span>
        </div>
        <nav className="nav-list">
          {[
            { id: 'incidents', icon: '▦', label: 'Incidents', count: incidents.filter(i => i.status !== 'resolved').length },
            { id: 'war-room', icon: '◉', label: 'War room' },
            { id: 'timeline', icon: '≡', label: 'Timeline' },
            { id: 'audit', icon: '⌘', label: 'Audit & safety' },
          ].map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item${view === item.id ? ' active' : ''}`}
              onClick={() => setView(item.id as typeof view)}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-lock">
            <span>✓</span>
            <div><strong>Advisory-only</strong><small>No production access</small></div>
          </div>
          <button className="user-card" id="roleButton" onClick={() => setRole(r => r === 'Incident Lead' ? 'Viewer' : 'Incident Lead')}>
            <span className="avatar">AL</span>
            <span><strong>Aisha Lee</strong><small id="roleLabel">{role}</small></span>
            <span className="chevron">⌄</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Incidents</span><span>/</span>
            <strong>{view === 'war-room' ? 'Checkout failures' : view === 'incidents' ? 'All Incidents' : view === 'timeline' ? 'Timeline' : 'Audit & Safety'}</strong>
          </div>
          <div className="top-actions">
            <span className="live-indicator"><i />Live updates</span>
            <button className="icon-button">♧</button>
            <button className="help-button">?</button>
          </div>
        </header>

        {view === 'war-room' && <WarRoom role={role} />}
        {view === 'incidents' && <IncidentsList incidents={incidents} onOpen={() => setView('war-room')} />}
        {view === 'timeline' && <TimelinePage />}
        {view === 'audit' && <AuditPage metrics={metrics} />}
      </main>
    </div>
  )
}

// ── War Room ──────────────────────────────────────────────────────────────────
function WarRoom({ role }: { role: string }) {
  const signals = [
    { severity: 'error', time: '10:44:21', service: 'checkout', text: 'DB connection pool exhausted', detail: '184 requests rejected in the last 2m' },
    { severity: 'error', time: '10:43:08', service: 'payments', text: 'Upstream checkout returned 503', detail: 'Related downstream failure' },
    { severity: 'warning', time: '10:42:31', service: 'checkout', text: 'Connection acquisition latency rising', detail: 'p95 reached 4.8 seconds' },
    { severity: 'info', time: '10:32:05', service: 'deploy', text: 'Version v2.3 deployed to checkout', detail: 'Configuration change detected' },
  ]
  const causes = [
    { title: 'Deploy v2.3 changed the DB connection settings', confidence: 85, reason: 'Error spike began 10 minutes after v2.3 changed checkout pool settings.', evidence: ['evt_0412', 'evt_0390', 'evt_0007'] },
    { title: 'Database overloaded by unusually high traffic', confidence: 38, reason: 'Pool exhaustion present, but request volume remained within normal range.', evidence: ['evt_0412', 'evt_0415'] },
  ]
  const [proposals, setProposals] = useState([
    { id: 'prop_001', title: 'Check DB connection pool metrics', check: 'View current pool use, wait time, and rejected connections.', status: 'pending', risk: 'low' },
    { id: 'prop_002', title: 'Compare v2.3 configuration with v2.2', check: 'Read the deployment configuration diff for checkout.', status: 'pending', risk: 'low' },
  ])
  const [blockedCount, setBlockedCount] = useState(12)
  const [blocked, setBlocked] = useState([
    { command: 'Restart the checkout service to clear the pool', reason: 'Blocked: restart changes live system state.' },
    { command: 'kubectl scale deployment checkout --replicas=0', reason: 'Blocked: scaling modifies production capacity.' },
    { command: 'curl metrics; rm -rf /tmp/cache', reason: 'Blocked: chained command and deletion detected.' },
  ])
  const [modal, setModal] = useState<{ title: string, body: React.ReactNode } | null>(null)
  const [toast, setToast] = useState<{ msg: string, err?: boolean } | null>(null)
  const [timeline, setTimeline] = useState([
    { time: '10:32 UTC', actor: 'system', title: 'Checkout v2.3 deployed', text: 'Deployment received from release pipeline.', evidence: ['evt_0007'] },
    { time: '10:42 UTC', actor: 'system', title: 'Incident created from error spike', text: '5xx rate crossed critical threshold.', evidence: ['evt_0390'] },
    { time: '10:44 UTC', actor: 'ai', title: 'Noise Filter grouped 184 duplicate alerts', text: 'Health checks and repeated connection errors removed.', evidence: ['184 filtered'] },
    { time: '10:45 UTC', actor: 'ai', title: 'Commander ranked deploy config change first', text: '85% confidence. Three correlated events.', evidence: ['evt_0412', 'evt_0390', 'evt_0007'] },
    { time: '10:46 UTC', actor: 'ai', title: 'Safe diagnostics prepared', text: 'Two read-only checks passed the guardrail policy.', evidence: ['prop_001', 'prop_002'] },
  ])

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3800)
  }

  function decideProposal(id: string, decision: 'approved' | 'rejected') {
    if (role === 'Viewer') { showToast('Viewers cannot record a decision.', true); return }
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: decision } : p))
    setTimeline(t => [...t, {
      time: '10:47 UTC', actor: 'human',
      title: `${proposals.find(p => p.id === id)?.title} ${decision}`,
      text: `${role} recorded a ${decision} decision. No command was run.`,
      evidence: [id],
    }])
    showToast(decision === 'approved' ? 'Approval recorded. No action was executed.' : 'Rejection recorded in the audit timeline.')
  }

  function tryUnsafe() {
    const cmd = { command: 'Restart checkout && clear /tmp/cache', reason: 'Blocked: restart and deletion modify system state.' }
    setBlocked(b => [cmd, ...b])
    setBlockedCount(c => c + 1)
    setTimeline(t => [...t, { time: '10:47 UTC', actor: 'system', title: 'Unsafe suggestion blocked', text: 'Guardrail rejected a state-changing suggestion.', evidence: ['guardrail-013'] }])
    setModal({
      title: 'Unsafe suggestion blocked',
      body: (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0' }}>The following command was rejected before reaching the UI.</p>
          <div className="modal-code">restart checkout &amp;&amp; rm -rf /tmp/cache</div>
          <div className="modal-safety"><strong>Blocked.</strong> This combines a restart and deletion. Neither is an approved read-only diagnostic, and chained commands are always rejected.</div>
          <div className="modal-actions"><button className="primary-button" id="modalOk" onClick={() => setModal(null)}>Understood</button></div>
        </>
      )
    })
  }

  return (
    <div className="view">
      <div className="incident-heading">
        <div>
          <div className="eyebrow">ACTIVE INCIDENT <span className="incident-id">INC-2048</span></div>
          <h1>Checkout failures after v2.3 deploy</h1>
          <p>Started 10:42 UTC · <span className="service-name">checkout</span> · <span className="critical">Critical</span></p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => showToast('Shareable incident summary copied.')}>↗ Share</button>
          <button className="primary-button" id="resolveButton" onClick={() => { setTimeline(t => [...t, { time: '10:48 UTC', actor: 'human', title: 'Incident marked resolved', text: 'Resolution recorded by Incident Lead.', evidence: ['INC-2048'] }]); showToast('Incident marked resolved. Timeline remains append-only.') }}>Mark resolved</button>
        </div>
      </div>

      <div className="status-strip">
        <div><span className="pulse" /><strong>Investigating</strong><span className="muted">Commander last ran just now</span></div>
        <div className="agent-steps">
          <span className="agent-step done">1. Noise filtered</span>
          <span className="agent-step done">2. Correlated</span>
          <span className="agent-step done">3. Cause ranked</span>
          <span className="agent-step current">4. Diagnostics ready</span>
        </div>
      </div>

      <div className="war-grid">
        {/* Signals panel */}
        <section className="panel alerts-panel">
          <div className="panel-header">
            <div><p className="section-kicker">SIGNALS</p><h2>Cleaned alerts</h2></div>
          </div>
          <div className="noise-card">
            <div className="noise-icon">✦</div>
            <div><strong>184 noisy alerts removed</strong><p>Duplicates and health checks were grouped away.</p></div>
            <span className="noise-percent">89% less noise</span>
          </div>
          {signals.map(s => (
            <article key={s.time + s.service} className={`signal`}>
              <div className="signal-top"><span className={`severity ${s.severity}`}>{s.severity}</span><span>{s.service}</span><span className="time">{s.time}</span></div>
              <strong>{s.text}</strong><p>{s.detail}</p>
            </article>
          ))}
          <button className="outline-button full-button" id="showRawButton" onClick={() => setModal({ title: 'Filtered events', body: <><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>184 events were exact duplicates, routine health checks, or repeats of an already-represented error. The raw source remains in the audit record.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Close</button></div></> })}>View 184 filtered events</button>
        </section>

        {/* Root causes panel */}
        <section className="panel root-panel">
          <div className="panel-header">
            <div><p className="section-kicker">ANALYSIS</p><h2>Probable root causes</h2></div>
            <span className="confidence-legend">Evidence-backed</span>
          </div>
          {causes.map((c, i) => (
            <article key={i} className={`cause-card${i === 0 ? ' top' : ''}`}>
              <div className="cause-heading">
                <span className={`rank${i ? ' alt' : ''}`}>{i + 1}</span>
                <div><div className="cause-title">{c.title}</div><p className="cause-reason">{c.reason}</p></div>
                <div className="confidence">{c.confidence}%<small>confidence</small></div>
              </div>
              <div className="confidence-bar"><i style={{ width: `${c.confidence}%` }} /></div>
              <div className="evidence-row">
                <span>{c.evidence.length} linked evidence items</span>
                <button className="evidence-link" onClick={() => setModal({ title: `Evidence: ${c.title}`, body: (<div>{c.evidence.map(id => <div key={id} className="evidence-event" style={{ marginBottom: 8 }}><strong>{id}</strong><p style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Source event linked to this root cause.</p></div>)}<div className="modal-actions"><button className="primary-button" onClick={() => setModal(null)}>Done</button></div></div>) })}>Inspect evidence</button>
              </div>
            </article>
          ))}
          <div className="analysis-note"><span>✦</span><p>Generated from 12 connected events. The commander makes recommendations only.</p></div>
        </section>

        {/* Diagnostics panel */}
        <section className="panel diagnostics-panel">
          <div className="panel-header">
            <div><p className="section-kicker">HUMAN CHECKS</p><h2>Safe diagnostics</h2></div>
            <span className="safe-pill">✓ Read-only</span>
          </div>
          <p className="panel-intro">Suggestions are screened by fixed safety rules before you see them.</p>
          {proposals.map(p => (
            <article key={p.id} className="proposal">
              <div className="proposal-title">{p.title} <span className="risk">{p.risk} risk</span></div>
              <p>{p.check}</p>
              {p.status === 'pending' && role !== 'Viewer'
                ? <div className="proposal-actions"><button className="approve" onClick={() => decideProposal(p.id, 'approved')}>Approve</button><button className="reject" onClick={() => decideProposal(p.id, 'rejected')}>Reject</button></div>
                : p.status === 'pending'
                  ? <div className="proposal-status">Viewer role · decision controls are hidden</div>
                  : <div className="proposal-status">{p.status === 'approved' ? '✓ Approved' : '✗ Rejected'} by {role}</div>
              }
            </article>
          ))}
          <button className="unsafe-demo" id="unsafeButton" onClick={tryUnsafe}><span>⊘</span> Try unsafe suggestion</button>
        </section>
      </div>

      {/* Timeline preview */}
      <section className="timeline-preview panel">
        <div className="panel-header">
          <div><p className="section-kicker">AUDITABLE RECORD</p><h2>What has happened</h2></div>
        </div>
        <div className="preview-entries">
          {timeline.slice(-4).map((e, i) => (
            <article key={i} className="preview-item">
              <i className={`preview-dot ${e.actor}`} />
              <span className="preview-time">{e.time}</span>
              <div className="preview-title">{e.title}</div>
              <div className="preview-text">{e.text}</div>
            </article>
          ))}
        </div>
      </section>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <h2 style={{ marginBottom: 12, fontSize: 18 }}>{modal.title}</h2>
            {modal.body}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast show${toast.err ? ' error' : ''}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Incidents List ─────────────────────────────────────────────────────────────
function IncidentsList({ incidents, onOpen }: { incidents: Incident[], onOpen: () => void }) {
  const mockFallback: Incident[] = [
    { id: 'inc-2048', title: 'Checkout failures after v2.3 deploy', severity: 'critical', status: 'investigating', started_at: '2026-09-30T10:42:00Z' },
    { id: 'inc-2041', title: 'Payment webhooks delayed', severity: 'high', status: 'monitoring', started_at: '2026-09-30T09:18:00Z' },
    { id: 'inc-2035', title: 'Search cache evictions elevated', severity: 'medium', status: 'resolved', started_at: '2026-09-29T14:00:00Z' },
  ]
  const data = incidents.length ? incidents : mockFallback
  return (
    <div className="view">
      <div className="page-heading">
        <div><p className="eyebrow">INCIDENTS</p><h1>Keep every response in view.</h1><p>Prioritised, explainable incident workspaces for on-call teams.</p></div>
        <button className="primary-button" id="newIncident">+ New incident</button>
      </div>
      <div className="incident-summary">
        <div><small>Open incidents</small><strong>{data.filter(i => i.status !== 'resolved').length}</strong><span className="down">↓ 1 from yesterday</span></div>
        <div><small>Median time to diagnose</small><strong>11m</strong><span className="up">↑ 4m faster</span></div>
        <div><small>Safety checks passed</small><strong>100%</strong><span>this week</span></div>
      </div>
      <div className="incident-table panel">
        <div className="table-head"><span>Incident</span><span>Severity</span><span>State</span><span>Started</span><span /></div>
        {data.map(inc => (
          <div key={inc.id} className="incident-row" onClick={onOpen}>
            <div className="row-title"><strong>{inc.title}</strong><span>{inc.id} · {inc.status === 'resolved' ? 'resolved' : 'checkout'}</span></div>
            <span className={`severity ${inc.severity}`}>{inc.severity}</span>
            <span className={`state ${inc.status}`}>{inc.status[0].toUpperCase() + inc.status.slice(1)}</span>
            <span className="time">{new Date(inc.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
            <button className="row-arrow" onClick={onOpen}>→</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Timeline Page ─────────────────────────────────────────────────────────────
function TimelinePage() {
  const [filter, setFilter] = useState('all')
  const entries = [
    { id: 'tl_0001', time: '10:32 UTC', actor: 'system', title: 'Checkout v2.3 deployed', text: 'Configuration change detected: MAX_DB_CONNECTIONS changed.', evidence: ['evt_0007'] },
    { id: 'tl_0002', time: '10:42 UTC', actor: 'system', title: 'Incident created from error spike', text: 'Checkout 5xx rate crossed the critical alert threshold.', evidence: ['evt_0390'] },
    { id: 'tl_0003', time: '10:44 UTC', actor: 'ai', title: 'Noise Filter grouped 184 duplicate alerts', text: 'Health checks and repeated connection errors were removed from the working set.', evidence: ['184 filtered'] },
    { id: 'tl_0004', time: '10:45 UTC', actor: 'ai', title: 'Commander ranked a deploy configuration change first', text: 'Supported by three connected events and 85% confidence.', evidence: ['evt_0412', 'evt_0390', 'evt_0007'] },
    { id: 'tl_0005', time: '10:46 UTC', actor: 'ai', title: 'Safe diagnostic proposals prepared', text: 'Two read-only checks passed the fixed guardrail policy.', evidence: ['prop_001', 'prop_002'] },
  ]
  const actorLabel = (a: string) => a === 'ai' ? 'AI DEDUCTION' : a === 'human' ? 'HUMAN DECISION' : 'SYSTEM EVENT'
  const filtered = filter === 'all' ? entries : entries.filter(e => e.actor === filter)

  return (
    <div className="view">
      <div className="page-heading">
        <div><p className="eyebrow">INCIDENT TIMELINE</p><h1>A complete account, not a black box.</h1><p>Every event, deduction and human decision is retained in order.</p></div>
        <button className="secondary-button" id="exportButton" onClick={() => {
          const blob = new Blob([JSON.stringify({ incident: 'INC-2048', generated_at: new Date().toISOString(), advisory_only: true, timeline: entries }, null, 2)], { type: 'application/json' })
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'INC-2048-audit-record.json' })
          a.click()
        }}>⇩ Export record</button>
      </div>
      <div className="filter-row">
        {['all', 'ai', 'human', 'system'].map(f => (
          <button key={f} className={`filter${filter === f ? ' active' : ''}`} data-filter={f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All activity' : f === 'ai' ? 'AI deductions' : f === 'human' ? 'Human decisions' : 'System events'}
          </button>
        ))}
      </div>
      <div className="full-timeline panel">
        {filtered.length === 0 ? <p className="empty-state">No matching activity.</p> : filtered.map(e => (
          <article key={e.id} className="timeline-entry" data-actor={e.actor}>
            <div className="timeline-time">{e.time}</div>
            <div className="timeline-line"><i className={e.actor} /></div>
            <div className="timeline-content">
              <span className={`actor ${e.actor}`}>{actorLabel(e.actor)}</span>
              <strong>{e.title}</strong>
              <p>{e.text}</p>
              <div className="evidence-chips">{e.evidence.map(id => <span key={id} className="evidence-chip">{id}</span>)}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// ── Audit Page ────────────────────────────────────────────────────────────────
function AuditPage({ metrics }: { metrics: Metrics | null }) {
  const m = metrics || { total_events: 207, noise_removed: 184, noise_reduction_percentage: 88.9, unsafe_blocked: 12, unsafe_total: 12, unsafe_blocked_percentage: 100 }
  const blocked = [
    { command: 'Restart the checkout service to clear the pool', reason: 'Blocked: restart changes live system state.' },
    { command: 'kubectl scale deployment checkout --replicas=0', reason: 'Blocked: scaling modifies production capacity.' },
    { command: 'curl metrics; rm -rf /tmp/cache', reason: 'Blocked: chained command and deletion detected.' },
  ]
  return (
    <div className="view">
      <div className="page-heading">
        <div><p className="eyebrow">AUDIT & SAFETY</p><h1>Safety is enforced in code.</h1><p>The system has no path to run commands in your infrastructure.</p></div>
        <span className="safe-pill large">✓ Guardrails active</span>
      </div>
      <div className="metric-grid">
        <div className="metric-card"><span>Root-cause accuracy</span><strong>3/3</strong><small>demo scenarios ranked correctly</small></div>
        <div className="metric-card"><span>Noise reduction</span><strong>{m.noise_reduction_percentage}%</strong><small>in this incident</small></div>
        <div className="metric-card"><span>Unsafe output blocked</span><strong>{m.unsafe_blocked}</strong><small>of {m.unsafe_total} attempts</small></div>
        <div className="metric-card"><span>Timeline complete</span><strong>100%</strong><small>all actions recorded</small></div>
      </div>
      <div className="audit-grid">
        <section className="panel policy-panel">
          <div className="panel-header"><div><p className="section-kicker">POLICY</p><h2>Diagnostic allowlist</h2></div></div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Only information-gathering checks are eligible for display. Everything else is blocked or sent for human review.</p>
          <div className="policy-columns">
            <div><strong className="allowed-title">Allowed</strong><ul><li>View logs</li><li>Check metrics</li><li>Service status</li><li>List processes</li></ul></div>
            <div><strong className="blocked-title">Blocked</strong><ul><li>Restart / kill</li><li>Delete / drop</li><li>Deploy / rollback</li><li>Write / scale</li></ul></div>
          </div>
        </section>
        <section className="panel blocked-panel">
          <div className="panel-header"><div><p className="section-kicker">ENFORCEMENT LOG</p><h2>Blocked suggestions</h2></div><span className="blocked-pill">{m.unsafe_blocked} blocked</span></div>
          {blocked.map((b, i) => (
            <article key={i} className="blocked-entry">
              <span className="block-icon">⊘</span>
              <div><strong>{b.command}</strong><p>{b.reason}</p></div>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
