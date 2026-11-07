import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, addMonths, planOf, segmentMembers } from './lib'
import { buildSeed, todayISO } from './seed'
import type { Data, Member, SegmentKey, View } from './types'

interface Toast { id: number; text: string }
interface State {
  data: Data
  view: View
  selected: string | null
  toasts: Toast[]
  setView: (v: View) => void
  select: (id: string | null) => void
  toast: (text: string) => void
  checkIn: (id: string) => void
  payInvoices: (memberId: string) => void
  renew: (id: string) => void
  setStatus: (id: string, s: Member['status']) => void
  addMember: (m: Pick<Member, 'name' | 'phone' | 'planId' | 'goal'>) => string
  sendCampaign: (name: string, segment: SegmentKey, message: string) => number
  reset: () => void
}

const fresh = () => buildSeed(todayISO())
const KEY = 'ritmo-crm-v1'
/** Reuse today's saved demo, so the seed only runs on a cold start. */
function load(): Data {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null')?.state?.data as Data | undefined
    if (d && d.seededOn === todayISO()) return d
  } catch { /* corrupt storage: fall through to a fresh seed */ }
  return fresh()
}
let tid = 0

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      data: load(),
      view: (location.hash.slice(1) as View) || 'painel',
      selected: null,
      toasts: [],
      setView: view => { location.hash = view; set({ view, selected: null }) },
      select: selected => set({ selected }),
      toast: text => {
        const id = ++tid
        set(s => ({ toasts: [...s.toasts, { id, text }] }))
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200)
      },
      checkIn: id => {
        const { data, toast } = get()
        const m = data.members.find(x => x.id === id)!
        if (m.status !== 'active') return toast(`${m.name}: matrícula ${m.status === 'frozen' ? 'trancada' : 'cancelada'}, check-in bloqueado.`)
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
        if (data.checkins.some(c => c.m === id && c.t >= dayStart.getTime())) return toast(`${m.name} já fez check-in hoje.`)
        set({ data: { ...data, checkins: [...data.checkins, { m: id, t: Date.now() }] } })
        toast(`Check-in de ${m.name} registrado.`)
      },
      payInvoices: memberId => {
        const { data, toast } = get(); const t = todayISO()
        const n = data.invoices.filter(i => i.memberId === memberId && !i.paidOn && i.due < t).length
        set({ data: { ...data, invoices: data.invoices.map(i => i.memberId === memberId && !i.paidOn && i.due < t ? { ...i, paidOn: t } : i) } })
        toast(`${n} cobrança${n === 1 ? '' : 's'} baixada${n === 1 ? '' : 's'}.`)
      },
      renew: id => {
        const { data, toast } = get(); const t = todayISO()
        const m = data.members.find(x => x.id === id)!
        const plan = planOf(data.plans, m.planId)
        const from = m.renewsOn > t ? m.renewsOn : t
        const members = data.members.map(x => x.id === id ? { ...x, status: 'active' as const, renewsOn: addMonths(from, plan.months) } : x)
        const invoices = [...data.invoices, { id: `i${id}-r${Date.now()}`, memberId: id, due: addDays(t, 5), amount: plan.price * plan.months }]
        set({ data: { ...data, members, invoices } })
        toast(`${m.name} renovou ${plan.name}. Nova cobrança gerada.`)
      },
      setStatus: (id, status) => {
        const { data, toast } = get()
        set({ data: { ...data, members: data.members.map(m => m.id === id ? { ...m, status, ...(status === 'cancelled' ? { renewsOn: todayISO() } : {}) } : m) } })
        toast(status === 'frozen' ? 'Matrícula trancada.' : status === 'cancelled' ? 'Matrícula cancelada.' : 'Matrícula reativada.')
      },
      addMember: m => {
        const { data, toast } = get(); const t = todayISO()
        const plan = planOf(data.plans, m.planId)
        const id = `m${String(data.members.length + 1).padStart(3, '0')}`
        const member: Member = { ...m, id, status: 'active', joined: t, renewsOn: addMonths(t, plan.months) }
        const inv = { id: `i${id}-first`, memberId: id, due: t, amount: plan.price, paidOn: t }
        set({ data: { ...data, members: [member, ...data.members], invoices: [...data.invoices, inv] } })
        toast(`${m.name} matriculado(a) no ${plan.name}.`)
        return id
      },
      sendCampaign: (name, segment, message) => {
        const { data, toast } = get(); const t = todayISO()
        const recipients = segmentMembers(segment, data, t).map(m => m.id)
        set({ data: { ...data, campaigns: [{ id: `c${Date.now()}`, name, segment, message, sentAt: Date.now(), recipients }, ...data.campaigns] } })
        toast(`Campanha simulada para ${recipients.length} alunos. Nenhuma mensagem real foi enviada.`)
        return recipients.length
      },
      reset: () => { set({ data: fresh(), selected: null }); get().toast('Dados de demonstração restaurados.') },
    }),
    {
      name: KEY,
      partialize: s => ({ data: s.data }),
      // reseed when the stored demo is from another day, so "today" stays meaningful
      merge: (saved, cur) => {
        const d = (saved as Partial<State> | undefined)?.data
        return d && d.seededOn === todayISO() ? { ...cur, data: d } : cur
      },
    },
  ),
)

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1) as View
  if (v && v !== useStore.getState().view) useStore.setState({ view: v, selected: null })
})
