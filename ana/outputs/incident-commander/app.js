/* Sentinel demo: all recommendations stay in the browser and never execute commands. */
const state = {
  role: 'Incident Lead',
  blockedCount: 12,
  signals: [
    { severity: 'error', time: '10:44:21', service: 'checkout', text: 'DB connection pool exhausted', detail: '184 requests rejected in the last 2m' },
    { severity: 'error', time: '10:43:08', service: 'payments', text: 'Upstream checkout returned 503', detail: 'Related downstream failure' },
    { severity: 'warning', time: '10:42:31', service: 'checkout', text: 'Connection acquisition latency rising', detail: 'p95 reached 4.8 seconds' },
    { severity: 'info', time: '10:32:05', service: 'deploy', text: 'Version v2.3 deployed to checkout', detail: 'Configuration change detected' }
  ],
  causes: [
    { title: 'Deploy v2.3 changed the DB connection settings', confidence: 85, reason: 'The error spike began 10 minutes after v2.3 changed checkout pool settings.', evidence: ['evt_0412', 'evt_0390', 'evt_0007'] },
    { title: 'Database is overloaded by unusually high traffic', confidence: 38, reason: 'Pool exhaustion is present, but request volume remained within the usual range.', evidence: ['evt_0412', 'evt_0415'] }
  ],
  proposals: [
    { id: 'prop_001', title: 'Check DB connection pool metrics', check: 'View current pool use, wait time, and rejected connections.', why: 'Confirms whether the pool is exhausted.', status: 'pending' },
    { id: 'prop_002', title: 'Compare v2.3 configuration with v2.2', check: 'Read the deployment configuration diff for checkout.', why: 'Validates the suspected setting change.', status: 'pending' }
  ],
  timeline: [
    { time: '10:32 UTC', actor: 'system', title: 'Checkout v2.3 deployed', text: 'Deployment history received from the release pipeline.', evidence: ['evt_0007'] },
    { time: '10:42 UTC', actor: 'system', title: 'Incident created from error spike', text: 'Checkout 5xx rate crossed the critical alert threshold.', evidence: ['evt_0390'] },
    { time: '10:44 UTC', actor: 'ai', title: 'Noise Filter grouped 184 duplicate alerts', text: 'Health checks and repeated connection errors were removed from the working set.', evidence: ['184 filtered'] },
    { time: '10:45 UTC', actor: 'ai', title: 'Commander ranked a deploy configuration change first', text: 'The recommendation is supported by three connected events and 85% confidence.', evidence: ['evt_0412', 'evt_0390', 'evt_0007'] },
    { time: '10:46 UTC', actor: 'ai', title: 'Safe diagnostic proposals prepared', text: 'Two read-only checks passed the fixed guardrail policy.', evidence: ['prop_001', 'prop_002'] }
  ],
  blocked: [
    { command: 'Restart the checkout service to clear the pool', reason: 'Blocked: restart changes live system state.' },
    { command: 'kubectl scale deployment checkout --replicas=0', reason: 'Blocked: scaling modifies production capacity.' },
    { command: 'curl metrics; rm -rf /tmp/cache', reason: 'Blocked: chained command and deletion detected.' }
  ]
};

const byId = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function toast(message, error = false) {
  const item = byId('toast');
  item.textContent = message;
  item.classList.toggle('error', error);
  item.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => item.classList.remove('show'), 3800);
}

function renderSignals() {
  byId('signalList').innerHTML = state.signals.map(signal => `
    <article class="signal">
      <div class="signal-top"><span class="severity ${signal.severity}">${signal.severity}</span><span>${esc(signal.service)}</span><span class="time">${signal.time}</span></div>
      <strong>${esc(signal.text)}</strong><p>${esc(signal.detail)}</p>
    </article>`).join('');
}

function renderCauses() {
  byId('causesList').innerHTML = state.causes.map((cause, index) => `
    <article class="cause-card ${index === 0 ? 'top' : ''}">
      <div class="cause-heading"><span class="rank ${index ? 'alt' : ''}">${index + 1}</span><div><div class="cause-title">${esc(cause.title)}</div><p class="cause-reason">${esc(cause.reason)}</p></div><div class="confidence">${cause.confidence}%<small>confidence</small></div></div>
      <div class="confidence-bar"><i style="width:${cause.confidence}%"></i></div>
      <div class="evidence-row"><span>${cause.evidence.length} linked evidence items</span><button class="evidence-link" data-evidence="${index}">Inspect evidence</button></div>
    </article>`).join('');
  document.querySelectorAll('[data-evidence]').forEach(button => button.addEventListener('click', () => showEvidence(Number(button.dataset.evidence))));
}

function renderProposals() {
  byId('proposalsList').innerHTML = state.proposals.map(proposal => `
    <article class="proposal"><div class="proposal-title">${esc(proposal.title)} <span class="risk">low risk</span></div><p>${esc(proposal.check)}</p>
      ${proposal.status === 'pending' && state.role !== 'Viewer' ? `<div class="proposal-actions"><button class="approve" data-approve="${proposal.id}">Approve</button><button class="reject" data-reject="${proposal.id}">Reject</button></div>` : proposal.status === 'pending' ? '<div class="proposal-status">Viewer role · decision controls are hidden</div>' : `<div class="proposal-status">${proposal.status === 'approved' ? '✓ Approved by Aisha Lee' : 'Rejected by Aisha Lee'}</div>`}
    </article>`).join('');
  document.querySelectorAll('[data-approve]').forEach(button => button.addEventListener('click', () => decideProposal(button.dataset.approve, 'approved')));
  document.querySelectorAll('[data-reject]').forEach(button => button.addEventListener('click', () => decideProposal(button.dataset.reject, 'rejected')));
}

function timelineMarkup(entry, preview = false) {
  if (preview) return `<article class="preview-item"><i class="preview-dot ${entry.actor}"></i><span class="preview-time">${entry.time}</span><div class="preview-title">${esc(entry.title)}</div><div class="preview-text">${esc(entry.text)}</div></article>`;
  return `<article class="timeline-entry" data-actor="${entry.actor}"><div class="timeline-time">${entry.time}</div><div class="timeline-line"><i class="${entry.actor}"></i></div><div class="timeline-content"><span class="actor ${entry.actor}">${entry.actor === 'ai' ? 'AI DEDUCTION' : entry.actor === 'human' ? 'HUMAN DECISION' : 'SYSTEM EVENT'}</span><strong>${esc(entry.title)}</strong><p>${esc(entry.text)}</p><div class="evidence-chips">${entry.evidence.map(id => `<span class="evidence-chip">${esc(id)}</span>`).join('')}</div></div></article>`;
}
function renderTimeline(filter = 'all') {
  byId('previewTimeline').innerHTML = state.timeline.slice(-4).map(entry => timelineMarkup(entry, true)).join('');
  byId('fullTimeline').innerHTML = state.timeline.filter(entry => filter === 'all' || entry.actor === filter).map(entry => timelineMarkup(entry)).join('') || '<p class="empty-state">No matching activity.</p>';
}
function renderIncidents() {
  const incidents = [
    ['Checkout failures after v2.3 deploy', 'INC-2048 · checkout', 'Critical', 'investigating', '10:42 UTC'],
    ['Payment webhooks delayed', 'INC-2041 · payments', 'High', 'monitoring', '09:18 UTC'],
    ['Search cache evictions elevated', 'INC-2035 · search', 'Medium', 'resolved', 'Yesterday']
  ];
  byId('incidentRows').innerHTML = incidents.map((row, index) => `<div class="incident-row"><div class="row-title"><strong>${row[0]}</strong><span>${row[1]}</span></div><span class="severity ${row[2].toLowerCase() === 'critical' ? 'error' : row[2].toLowerCase() === 'high' ? 'warning' : 'info'}">${row[2]}</span><span class="state ${row[3]}">${row[3][0].toUpperCase() + row[3].slice(1)}</span><span class="time">${row[4]}</span><button class="row-arrow" data-open="${index}">→</button></div>`).join('');
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => { showView('war-room'); toast('Opened incident workspace.'); }));
}
function renderBlocked() {
  byId('blockedMetric').textContent = state.blockedCount;
  byId('blockedList').innerHTML = state.blocked.map(item => `<article class="blocked-entry"><span class="block-icon">⊘</span><div><strong>${esc(item.command)}</strong><p>${esc(item.reason)}</p></div></article>`).join('');
}

function decideProposal(id, status) {
  const proposal = state.proposals.find(item => item.id === id);
  if (!proposal || state.role === 'Viewer') return toast('Viewers can review proposals but cannot record a decision.', true);
  proposal.status = status;
  state.timeline.push({ time: '10:47 UTC', actor: 'human', title: `${proposal.title} ${status}`, text: `${state.role} recorded a ${status} decision. No command was run.`, evidence: [proposal.id] });
  renderProposals(); renderTimeline();
  toast(status === 'approved' ? 'Approval recorded. No action was executed.' : 'Rejection recorded in the audit timeline.');
}

function showEvidence(index) {
  const cause = state.causes[index];
  const events = index === 0 ? [
    ['evt_0007', '10:32 UTC', 'deploy', 'v2.3 changed MAX_DB_CONNECTIONS from 50 to 10.'],
    ['evt_0390', '10:42 UTC', 'checkout', '5xx errors crossed the critical threshold.'],
    ['evt_0412', '10:44 UTC', 'checkout', 'DB connection pool exhausted.']
  ] : [['evt_0412', '10:44 UTC', 'checkout', 'DB connection pool exhausted.'], ['evt_0415', '10:45 UTC', 'metrics', 'Request volume is within normal daily variance.']];
  openModal(`<p class="eyebrow">EVIDENCE FOR ${cause.confidence}% CONFIDENCE</p><h2>${esc(cause.title)}</h2><p>These source events support the recommendation. Ingested text is treated as data, never as instructions.</p><div>${events.map(event => `<div class="evidence-event"><strong>${event[0]}</strong><span>${event[1]} · ${event[2]}</span><p>${event[3]}</p></div>`).join('')}</div><div class="modal-actions"><button class="primary-button" id="modalOk">Done</button></div>`);
}
function openModal(content) { byId('modalContent').innerHTML = content; byId('modal').classList.remove('hidden'); const ok = byId('modalOk'); if (ok) ok.onclick = closeModal; }
function closeModal() { byId('modal').classList.add('hidden'); }
function showView(view) { document.querySelectorAll('.view').forEach(section => section.classList.add('hidden')); byId(`${view}-view`).classList.remove('hidden'); document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view)); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function addBlockedSuggestion() {
  const unsafe = { command: 'Restart checkout and then clear /tmp/cache', reason: 'Blocked: restart and deletion modify system state. The dashboard only gives advice.' };
  state.blocked.unshift(unsafe); state.blockedCount += 1;
  state.timeline.push({ time: '10:47 UTC', actor: 'system', title: 'Unsafe diagnostic suggestion blocked', text: 'Guardrail rejected a state-changing suggestion before it could be displayed.', evidence: ['guardrail-013'] });
  renderBlocked(); renderTimeline();
  openModal(`<p class="eyebrow">GUARDRAIL DECISION</p><h2>Unsafe suggestion blocked</h2><div class="modal-code">restart checkout && rm -rf /tmp/cache</div><div class="modal-safety"><strong>Blocked.</strong> This combines a restart and deletion. Neither is an approved read-only diagnostic, and chained commands are always rejected.</div><div class="modal-actions"><button class="primary-button" id="modalOk">Understood</button></div>`);
}

function setupEvents() {
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  byId('unsafeButton').addEventListener('click', addBlockedSuggestion);
  byId('modalClose').addEventListener('click', closeModal);
  byId('modal').addEventListener('click', event => { if (event.target === byId('modal')) closeModal(); });
  byId('showRawButton').addEventListener('click', () => openModal(`<p class="eyebrow">FILTERED EVENTS</p><h2>184 events were deliberately hidden</h2><p>They were exact duplicates, routine health checks, or repeats of an already represented error. The raw source remains in the audit record.</p><div class="modal-actions"><button class="secondary-button" id="modalOk">Close</button></div>`));
  byId('resolveButton').addEventListener('click', () => { state.timeline.push({ time: '10:48 UTC', actor: 'human', title: 'Incident marked resolved', text: 'Resolution status was recorded by the Incident Lead.', evidence: ['INC-2048'] }); renderTimeline(); toast('Incident marked resolved. The timeline remains append-only.'); });
  byId('shareButton').addEventListener('click', () => toast('Shareable incident summary copied to this demo session.'));
  byId('newIncident').addEventListener('click', () => toast('In a connected deployment this opens the incident intake form.'));
  byId('exportButton').addEventListener('click', () => {
    const record = JSON.stringify({ incident: 'INC-2048', generated_at: new Date().toISOString(), advisory_only: true, timeline: state.timeline }, null, 2);
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([record], { type: 'application/json' })), download: 'INC-2048-audit-record.json' }); link.click(); URL.revokeObjectURL(link.href); toast('Audit record exported.');
  });
  byId('roleButton').addEventListener('click', () => { state.role = state.role === 'Incident Lead' ? 'Viewer' : 'Incident Lead'; byId('roleLabel').textContent = state.role; renderProposals(); toast(`Role switched to ${state.role} for this demo.`); });
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active'); renderTimeline(button.dataset.filter); }));
}

renderSignals(); renderCauses(); renderProposals(); renderTimeline(); renderIncidents(); renderBlocked(); setupEvents();
