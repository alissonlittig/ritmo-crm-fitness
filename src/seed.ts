import { DAY, addDays, addMonths, isoDay, parseDay } from './lib'
import type { Campaign, Checkin, Data, Invoice, Member, Plan } from './types'

/** Deterministic PRNG so the demo looks the same for everyone. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const PLANS: Plan[] = [
  { id: 'mensal', name: 'Mensal Livre', price: 149, months: 1, perks: 'Musculação e aulas coletivas, sem fidelidade' },
  { id: 'tri', name: 'Trimestral', price: 129, months: 3, perks: 'Tudo do Mensal + 1 avaliação física' },
  { id: 'sem', name: 'Semestral', price: 109, months: 6, perks: 'Tudo do Trimestral + 2 convites por mês' },
  { id: 'anual', name: 'Anual Black', price: 89, months: 12, perks: 'Acesso 24h, armário fixo e avaliação trimestral' },
  { id: 'pilates', name: 'Pilates 2x', price: 249, months: 1, perks: 'Duas aulas semanais de Pilates em turma pequena' },
]
const WEIGHT = [30, 22, 18, 20, 10]

const FIRST = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isadora', 'João', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Queila', 'Rafael', 'Sofia', 'Tiago', 'Úrsula', 'Vítor', 'Yasmin', 'Zélia', 'Beatriz', 'Caio', 'Dalila', 'Enzo', 'Flávia', 'Gustavo', 'Helena', 'Igor', 'Júlia', 'Kauê', 'Letícia', 'Murilo', 'Natália', 'Otávio', 'Paula', 'Renato']
const LAST = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Farias', 'Gomes', 'Henrique', 'Ibrahim', 'Jardim', 'Klein', 'Lima', 'Matos', 'Nogueira', 'Oliveira', 'Prado', 'Queiroz', 'Ramos', 'Siqueira', 'Teixeira', 'Uchoa', 'Vieira', 'Werner', 'Xavier', 'Zanetti', 'Moura', 'Borges', 'Pacheco']
const GOALS = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Reabilitação', 'Saúde e bem-estar', 'Preparação para corrida']

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)]
function weighted(r: () => number) {
  let x = r() * WEIGHT.reduce((a, b) => a + b, 0)
  for (let i = 0; i < WEIGHT.length; i++) { x -= WEIGHT[i]; if (x < 0) return PLANS[i] }
  return PLANS[0]
}
const HOUR_W = [[6, 9], [7, 14], [8, 9], [9, 6], [10, 4], [11, 4], [12, 9], [13, 6], [17, 8], [18, 14], [19, 15], [20, 9], [21, 4]]
function hour(r: () => number) {
  let x = r() * HOUR_W.reduce((a, b) => a + b[1], 0)
  for (const [h, w] of HOUR_W) { x -= w; if (x < 0) return h }
  return 18
}
const DOW_W = [0.35, 1, 1, 1, 0.95, 0.8, 0.45, 0.35] // index by getDay(), Sunday first

export function buildSeed(today: string, count = 150): Data {
  const r = rng(4747)
  const members: Member[] = []
  const invoices: Invoice[] = []
  const checkins: Checkin[] = []
  const used = new Set<string>()
  const todayMs = parseDay(today).getTime()

  for (let i = 0; i < count; i++) {
    let name = ''
    do name = `${pick(r, FIRST)} ${pick(r, LAST)}`; while (used.has(name))
    used.add(name)
    const id = `m${String(i + 1).padStart(3, '0')}`
    const plan = weighted(r)
    const joined = addDays(today, -Math.floor(r() * r() * 620) - 10)
    const roll = r()
    let status: Member['status'] = roll < 0.07 ? 'frozen' : roll < 0.2 ? 'cancelled' : 'active'

    // next renewal: step through plan terms from the join date
    let renewsOn = addMonths(joined, plan.months)
    while (renewsOn < today) renewsOn = addMonths(renewsOn, plan.months)
    if (status === 'active' && r() < 0.06) renewsOn = addDays(today, -1 - Math.floor(r() * 12)) // expired, not renewed yet
    if (status === 'cancelled') renewsOn = addDays(today, -4 - Math.floor(r() * 150)) // reused as cancellation date
    if (status === 'cancelled' && renewsOn < joined) renewsOn = addDays(joined, 30)

    const phone = `(41) 9${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}`
    members.push({ id, name, phone, planId: plan.id, status, joined, renewsOn, goal: pick(r, GOALS) })

    // check-ins
    if (status !== 'cancelled') {
      const freq = status === 'frozen' ? 0 : 0.5 + r() * 4.5
      const atRisk = status === 'active' && r() < 0.2
      const stopDays = atRisk ? 15 + Math.floor(r() * 35) : -1
      for (let k = 90; k >= 0; k--) {
        if (atRisk && k < stopDays) continue
        if (status === 'frozen' && k < 40) continue
        const day = addDays(today, -k)
        if (day < joined) continue
        const dow = parseDay(day).getDay()
        if (r() < (freq / 7) * DOW_W[dow] * 1.15) {
          const h = k === 0 ? Math.min(hour(r), new Date().getHours()) : hour(r)
          checkins.push({ m: id, t: parseDay(day).getTime() + h * 3_600_000 + Math.floor(r() * 3_000_000) })
        }
      }
    }

    // monthly invoices, last 12 months
    const endAt = status === 'cancelled' ? renewsOn : addDays(today, 30)
    const delinquent = status !== 'cancelled' && r() < 0.14
    const owed = delinquent ? 1 + Math.floor(r() * 3) : 0
    const dueDay = Math.min(parseDay(joined).getDate(), 28)
    const dues: string[] = []
    for (let k = 11; k >= -1; k--) {
      const base = addMonths(today.slice(0, 7) + '-01', -k)
      const due = `${base.slice(0, 7)}-${String(dueDay).padStart(2, '0')}`
      if (due >= joined && due <= endAt) dues.push(due)
    }
    const pastDues = dues.filter(d => d < today)
    pastDues.forEach((due, idx) => {
      const unpaid = idx >= pastDues.length - owed
      const late = r() < 0.12 ? Math.floor(r() * 6) : 0
      invoices.push({
        id: `i${id}-${due.slice(0, 7)}`, memberId: id, due, amount: plan.price,
        paidOn: unpaid ? undefined : addDays(due, late),
      })
    })
    const next = dues.find(d => d >= today)
    if (next && status !== 'frozen') invoices.push({ id: `i${id}-${next.slice(0, 7)}`, memberId: id, due: next, amount: plan.price })
  }
  checkins.sort((a, b) => a.t - b.t)

  const seededAt = todayMs - 30 * DAY
  // members who had been away for 2 weeks at the time of the campaign
  const awayAt = (t: number) => {
    const recent = new Set(checkins.filter(k => k.t > t - 14 * DAY && k.t <= t).map(k => k.m))
    return (m: Member) => m.status === 'active' && m.joined < isoDay(new Date(t - 20 * DAY)) && !recent.has(m.id)
  }
  const pickIds = (n: number, pred: (m: Member) => boolean) => members.filter(pred).slice(0, n).map(m => m.id)
  const campaigns: Campaign[] = [
    { id: 'c1', name: 'Volta ao treino de outubro', segment: 'inativos', message: 'Oi {nome}, sentimos sua falta no {estudio}! Faz {dias} dias desde o seu último treino.', sentAt: seededAt, recipients: pickIds(22, awayAt(seededAt)) },
    { id: 'c2', name: 'Regularize e ganhe a taxa de volta', segment: 'inadimplentes', message: 'Oi {nome}, identificamos uma mensalidade em aberto no valor de {valor}.', sentAt: seededAt + 9 * DAY, recipients: pickIds(14, m => m.status !== 'cancelled' && m.joined < addDays(today, -200)).reverse() },
  ]
  return { plans: PLANS, members, invoices, checkins, campaigns, seededOn: today }
}

export const todayISO = () => isoDay(new Date())
