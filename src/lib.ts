import type { Campaign, Checkin, Data, Invoice, Member, Plan, SegmentKey } from './types'

export const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day as YYYY-MM-DD. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return isoDay(d) }
export const addMonths = (s: string, n: number) => {
  const d = parseDay(s); const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + n)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return isoDay(d)
}
export const diffDays = (a: string, b: string) => Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / DAY)

// Intl formatters are expensive to build; create each once.
const F0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const F2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const FD = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
const FM = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
export const brl = (n: number) => F0.format(n)
export const brl2 = (n: number) => F2.format(n)
export const dateBR = (s: string) => FD.format(parseDay(s)).replace(/\./g, '').replace(/ de /g, ' ')
export const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export const planOf = (plans: Plan[], id: string) => plans.find(p => p.id === id)!

export function lastCheckinMap(checkins: Checkin[]) {
  const m = new Map<string, number>()
  for (const c of checkins) if ((m.get(c.m) ?? 0) < c.t) m.set(c.m, c.t)
  return m
}
export const daysSince = (t: number | undefined, today: string) =>
  t === undefined ? Infinity : diffDays(today, isoDay(new Date(t)))

export const overdueInvoices = (invs: Invoice[], today: string) => invs.filter(i => !i.paidOn && i.due < today)
export function debtByMember(invs: Invoice[], today: string) {
  const m = new Map<string, { total: number; oldest: string; count: number }>()
  for (const i of overdueInvoices(invs, today)) {
    const c = m.get(i.memberId)
    if (!c) m.set(i.memberId, { total: i.amount, oldest: i.due, count: 1 })
    else { c.total += i.amount; c.count++; if (i.due < c.oldest) c.oldest = i.due }
  }
  return m
}

export function mrr(members: Member[], plans: Plan[]) {
  return members.filter(m => m.status === 'active').reduce((s, m) => s + planOf(plans, m.planId).price, 0)
}

export const SEGMENTS: Record<SegmentKey, { label: string; hint: string; template: string }> = {
  inativos: { label: 'Sumiram há 14+ dias', hint: 'Ativos sem check-in nas últimas 2 semanas', template: 'Oi {nome}, sentimos sua falta no {estudio}! Faz {dias} desde o seu último treino. Que tal voltar essa semana? Sua aula experimental de retorno é por nossa conta.' },
  inadimplentes: { label: 'Mensalidade em atraso', hint: 'Com cobrança vencida e não paga', template: 'Oi {nome}, tudo bem? Identificamos uma mensalidade em aberto no valor de {valor}. Se já pagou, desconsidere. Se precisar, negociamos o melhor jeito de regularizar.' },
  vencendo: { label: 'Plano vence em 30 dias', hint: 'Ativos com renovação nos próximos 30 dias', template: 'Oi {nome}, seu plano vence em {dias}. Renovando agora você mantém o valor atual e ganha uma avaliação física gratuita.' },
  trancados: { label: 'Matrícula trancada', hint: 'Alunos com plano congelado', template: 'Oi {nome}, que tal destrancar sua matrícula? Preparamos um plano de retorno gradual com 2 treinos por semana nas primeiras 3 semanas.' },
  cancelados: { label: 'Cancelados recentes', hint: 'Cancelaram nos últimos 90 dias', template: 'Oi {nome}, a turma sente sua falta. Temos novidades no {estudio} e uma condição especial de volta: matrícula isenta neste mês.' },
}

export function segmentMembers(key: SegmentKey, d: Data, today: string): Member[] {
  const last = lastCheckinMap(d.checkins)
  const debt = debtByMember(d.invoices, today)
  return d.members.filter(m => {
    switch (key) {
      case 'inativos': return m.status === 'active' && daysSince(last.get(m.id), today) >= 14
      case 'inadimplentes': return m.status !== 'cancelled' && debt.has(m.id)
      case 'vencendo': { const x = diffDays(m.renewsOn, today); return m.status === 'active' && x >= 0 && x <= 30 }
      case 'trancados': return m.status === 'frozen'
      case 'cancelados': return m.status === 'cancelled' && diffDays(today, m.renewsOn) <= 90
    }
  })
}

export function fillTemplate(t: string, m: Member, d: Data, today: string) {
  const last = lastCheckinMap(d.checkins).get(m.id)
  const debt = debtByMember(d.invoices, today).get(m.id)
  const dias = t.includes('vence') ? Math.max(diffDays(m.renewsOn, today), 0) : daysSince(last, today)
  return t
    .replaceAll('{nome}', m.name.split(' ')[0])
    .replaceAll('{estudio}', 'Ritmo Studio')
    .replaceAll('{dias}', !Number.isFinite(dias) ? 'muito tempo' : dias === 1 ? '1 dia' : `${dias} dias`)
    .replaceAll('{valor}', brl2(debt?.total ?? 0))
}

/** Recipients with a check-in after the campaign was sent. */
export const reactivated = (c: Campaign, checkins: Checkin[]) => {
  const back = new Set(checkins.filter(k => k.t > c.sentAt).map(k => k.m))
  return c.recipients.filter(r => back.has(r)).length
}

export const monthKey = (s: string) => s.slice(0, 7)
export function lastMonths(today: string, n: number) {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(today.slice(0, 7) + '-01', -i)))
  return out
}
export const monthLabel = (k: string) => FM.format(parseDay(k + '-01')).replace('.', '')
