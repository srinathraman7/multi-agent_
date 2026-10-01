/**
 * Typed API client for the Sentinel backend.
 * Falls back to rich mock data when NEXT_PUBLIC_API_URL is not set.
 */

const API = process.env.NEXT_PUBLIC_API_URL || ''

export interface Incident {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'investigating' | 'monitoring' | 'resolved'
  started_at: string
}

export interface Event {
  id: string
  source: string
  timestamp: string
  service: string
  severity: string
  message: string
  is_noise: boolean
}

export interface RootCause {
  cause: string
  confidence: number
  evidence_ids: string[]
  reasoning: string
}

export interface Proposal {
  id: string
  title: string
  check_text: string
  why: string
  expected_result: string
  risk: string
  status: string
  guardrail_decision: string
  guardrail_reason: string
  evidence_ids: string[]
}

export interface TimelineEntry {
  id: string
  timestamp: string
  actor: 'system' | 'ai' | 'human'
  action: string
  evidence_ids: string[]
}

export interface Metrics {
  total_events: number
  noise_removed: number
  noise_reduction_percentage: number
  unsafe_blocked: number
  unsafe_total: number
  unsafe_blocked_percentage: number
}

let _token = ''
export function setToken(t: string) { _token = t }
export function getToken() { return _token }

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${API}/auth/token`, { method: 'POST', body })
  if (!res.ok) throw new Error('Login failed')
  return res.json()
}

// ── Incidents ─────────────────────────────────────────────────────────────────
export async function getIncidents(): Promise<Incident[]> {
  if (!API) return MOCK.incidents
  return apiFetch('/incidents/')
}

export async function getIncident(id: string): Promise<Incident> {
  if (!API) return MOCK.incidents[0]
  return apiFetch(`/incidents/${id}`)
}

export async function getEvents(incidentId: string): Promise<Event[]> {
  if (!API) return MOCK.events
  return apiFetch(`/incidents/${incidentId}/events`)
}

export async function getTimeline(incidentId: string): Promise<TimelineEntry[]> {
  if (!API) return MOCK.timeline
  return apiFetch(`/incidents/${incidentId}/timeline`)
}

export async function getProposals(incidentId: string): Promise<Proposal[]> {
  if (!API) return MOCK.proposals
  return apiFetch(`/incidents/${incidentId}/proposals`)
}

export async function getMetrics(): Promise<Metrics> {
  if (!API) return MOCK.metrics
  return apiFetch('/incidents/audit/metrics')
}

export async function decideProposal(proposalId: string, decision: 'approved' | 'rejected'): Promise<void> {
  if (!API) return
  await apiFetch(`/proposals/${proposalId}/decide`, { method: 'POST', body: JSON.stringify({ decision }) })
}

export async function ingestScenario(scenarioId: string): Promise<{ incident_id: string }> {
  return apiFetch(`/ingest/scenario/${scenarioId}`, { method: 'POST' })
}

// ── Mock data (used when API is not configured) ───────────────────────────────
const MOCK = {
  incidents: [
    { id: 'inc-2048', title: 'Checkout failures after v2.3 deploy', severity: 'critical' as const, status: 'investigating' as const, started_at: '2026-09-30T10:42:00Z' },
    { id: 'inc-2041', title: 'Payment webhooks delayed', severity: 'high' as const, status: 'monitoring' as const, started_at: '2026-09-30T09:18:00Z' },
    { id: 'inc-2035', title: 'Search cache evictions elevated', severity: 'medium' as const, status: 'resolved' as const, started_at: '2026-09-29T14:00:00Z' },
  ],
  events: [
    { id: 'evt_0007', source: 'deploy', timestamp: '2026-09-30T10:32:00Z', service: 'checkout', severity: 'info', message: 'Version v2.3 deployed to checkout', is_noise: false },
    { id: 'evt_0018', source: 'log', timestamp: '2026-09-30T10:39:30Z', service: 'checkout', severity: 'warning', message: 'Connection acquisition latency rising', is_noise: false },
    { id: 'evt_0027', source: 'log', timestamp: '2026-09-30T10:41:45Z', service: 'checkout', severity: 'error', message: 'DB connection pool exhausted', is_noise: false },
    { id: 'evt_0390', source: 'log', timestamp: '2026-09-30T10:42:11Z', service: 'checkout', severity: 'error', message: '5xx error rate crossed critical threshold', is_noise: false },
    { id: 'evt_0200', source: 'log', timestamp: '2026-09-30T10:42:40Z', service: 'payments', severity: 'error', message: 'Upstream checkout returned 503', is_noise: false },
    { id: 'evt_0300', source: 'ticket', timestamp: '2026-09-30T10:43:00Z', service: 'checkout', severity: 'error', message: 'TICKET-1024: Customers cannot complete checkout', is_noise: false },
  ],
  proposals: [
    { id: 'prop_001', title: 'Check DB connection pool metrics', check_text: 'View current pool use, wait time, and rejected connections.', why: 'Confirms whether the pool is exhausted.', expected_result: 'Pool usage near 100 percent', risk: 'low', status: 'pending', guardrail_decision: 'allowed', guardrail_reason: 'Matches the read-only diagnostic allowlist.', evidence_ids: ['evt_0412', 'evt_0390'] },
    { id: 'prop_002', title: 'Compare v2.3 configuration with v2.2', check_text: 'Read the deployment configuration diff for checkout.', why: 'Validates the suspected setting change.', expected_result: 'MAX_DB_CONNECTIONS changed from 50 to 10', risk: 'low', status: 'pending', guardrail_decision: 'allowed', guardrail_reason: 'Matches the read-only diagnostic allowlist.', evidence_ids: ['evt_0007'] },
  ],
  timeline: [
    { id: 'tl_0001', timestamp: '2026-09-30T10:32:00Z', actor: 'system' as const, action: 'Checkout v2.3 deployed', evidence_ids: ['evt_0007'] },
    { id: 'tl_0002', timestamp: '2026-09-30T10:42:00Z', actor: 'system' as const, action: 'Incident created from error spike', evidence_ids: ['evt_0390'] },
    { id: 'tl_0003', timestamp: '2026-09-30T10:44:00Z', actor: 'ai' as const, action: 'Noise Filter removed 184 duplicate alerts', evidence_ids: [] },
    { id: 'tl_0004', timestamp: '2026-09-30T10:45:00Z', actor: 'ai' as const, action: 'Root Cause ranked: Deploy v2.3 reduced DB pool (85% confidence)', evidence_ids: ['evt_0007', 'evt_0390', 'evt_0412'] },
    { id: 'tl_0005', timestamp: '2026-09-30T10:46:00Z', actor: 'ai' as const, action: 'Safe diagnostics prepared — passed guardrail', evidence_ids: ['prop_001', 'prop_002'] },
  ],
  metrics: {
    total_events: 207,
    noise_removed: 184,
    noise_reduction_percentage: 88.9,
    unsafe_blocked: 12,
    unsafe_total: 12,
    unsafe_blocked_percentage: 100.0,
  },
}
