'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, setToken } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { access_token } = await login(username, password)
      setToken(access_token)
      if (typeof window !== 'undefined') localStorage.setItem('sentinel_token', access_token)
      router.push('/dashboard')
    } catch {
      setError('Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 60% 30%, rgba(59,130,246,0.08) 0%, #080c14 60%)',
    }}>
      <div style={{
        width: 380, background: 'var(--bg-1)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)', padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 20 }}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.4px' }}>Sentinel</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Incident Commander</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Welcome back</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Sign in to your incident workspace.</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="incident_lead"
              required
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '10px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14,
                outline: 'none', transition: 'border-color 0.18s',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '10px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, outline: 'none',
              }}
            />
          </label>

          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" className="primary-button" disabled={loading} style={{ marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo credentials:</strong><br />
          Lead: <code style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>incident_lead / changeme</code><br />
          Viewer: <code style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>viewer / viewonly</code>
        </div>
      </div>
    </div>
  )
}
