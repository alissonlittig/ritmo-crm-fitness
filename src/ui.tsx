import { useMemo, type ReactNode } from 'react'
import { debtByMember, initials, lastCheckinMap, daysSince } from './lib'
import { todayISO } from './seed'
import { useStore } from './store'
import type { Member } from './types'

const P: Record<string, string> = {
  painel: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  alunos: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6',
  checkin: 'm5 12.5 4.2 4.2L19 7M3 3h4M3 21h4M21 3h-4M21 21h-4',
  cobrancas: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h3',
  renovacoes: 'M20 11a8 8 0 0 0-14.5-4.6L4 8m0-4v4h4M4 13a8 8 0 0 0 14.5 4.6L20 16m0 4v-4h-4',
  campanhas: 'M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Zm13-1.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12',
  planos: 'm12 3 2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.8 6.5 19.7l1.1-6.1L3.2 9.4l6.1-.8L12 3Z',
  search: 'm21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7L4 8m0-4v4h4',
  send: 'm21 3-9.5 18-2.5-7.5L1.5 11 21 3Zm-12 10.5L21 3',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  up: 'M7 17 17 7M8 7h9v9',
  down: 'M7 7l10 10M17 8v9H8',
}
export const Icon = ({ n, s = 18 }: { n: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>
)

const HUES = [14, 38, 160, 200, 262, 330]
export const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => {
  const h = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: `oklch(0.93 0.05 ${h})`, color: `oklch(0.38 0.1 ${h})` }}>{initials(name)}</span>
}

export const Badge = ({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'mute' | 'info'; children: ReactNode }) => <span className={`badge ${tone}`}>{children}</span>

export function StatusBadge({ m, overdue }: { m: Member; overdue?: boolean }) {
  if (m.status === 'cancelled') return <Badge tone="mute">Cancelado</Badge>
  if (m.status === 'frozen') return <Badge tone="info">Trancado</Badge>
  if (overdue) return <Badge tone="bad">Inadimplente</Badge>
  return <Badge tone="ok">Ativo</Badge>
}

export const Card = ({ title, sub, action, children, className = '' }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`card ${className}`}>
    {(title || action) && <header className="card-h"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</header>}
    {children}
  </section>
)

export const Kpi = ({ label, value, delta, tone, note }: { label: string; value: string; delta?: string; tone?: 'up' | 'down'; note?: string }) => (
  <div className="kpi card">
    <span className="kpi-l">{label}</span>
    <strong className="kpi-v">{value}</strong>
    <span className="kpi-f">{delta && <em className={tone}><Icon n={tone === 'down' ? 'down' : 'up'} s={13} />{delta}</em>}{note}</span>
  </div>
)

export const Empty = ({ text }: { text: string }) => <div className="empty">{text}</div>

export function PageHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <div className="page-h"><div><h1>{title}</h1><p>{sub}</p></div><div className="page-a">{children}</div></div>
}

/** Derived maps shared by the views. `today` is stable per session. */
export function useDerived() {
  const data = useStore(s => s.data)
  const today = todayISO()
  return useMemo(() => {
    const last = lastCheckinMap(data.checkins)
    const debt = debtByMember(data.invoices, today)
    const byId = new Map(data.members.map(m => [m.id, m]))
    const plans = new Map(data.plans.map(p => [p.id, p]))
    return { data, today, last, debt, byId, plans, since: (id: string) => daysSince(last.get(id), today) }
  }, [data, today])
}
