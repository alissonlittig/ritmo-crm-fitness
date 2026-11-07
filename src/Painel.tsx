import { Suspense, lazy } from 'react'
const PainelCharts = lazy(() => import('./PainelCharts'))
import { DAY, brl, diffDays, lastMonths, monthKey, monthLabel, mrr } from './lib'
import { useStore } from './store'
import { Avatar, Badge, Card, Empty, Kpi, PageHead, useDerived } from './ui'

const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

export function Painel() {
  const { data, today, debt, since, byId } = useDerived()
  const setView = useStore(s => s.setView)
  const select = useStore(s => s.select)
  const active = data.members.filter(m => m.status === 'active')
  const months = lastMonths(today, 8)

  const revenue = months.map(k => {
    const inv = data.invoices.filter(i => monthKey(i.due) === k)
    return {
      k, mes: monthLabel(k),
      Recebido: inv.filter(i => i.paidOn).reduce((s, i) => s + i.amount, 0),
      'Em aberto': inv.filter(i => !i.paidOn).reduce((s, i) => s + i.amount, 0),
    }
  })
  // cash received this month vs last month up to the same day, so a partial month is not compared with a full one
  const cutoff = Number(today.slice(8))
  const paidIn = (k: string, upTo: number) => data.invoices.filter(i => i.paidOn && monthKey(i.paidOn) === k && Number(i.paidOn.slice(8)) <= upTo).reduce((s, i) => s + i.amount, 0)
  const flow = months.map(k => ({
    mes: monthLabel(k),
    Novos: data.members.filter(m => monthKey(m.joined) === k).length,
    Cancelamentos: -data.members.filter(m => m.status === 'cancelled' && monthKey(m.renewsOn) === k).length,
  }))
  const byPlan = data.plans.map(p => ({ name: p.name, value: active.filter(m => m.planId === p.id).length }))

  const todayStart = new Date(today + 'T00:00:00').getTime()
  const checkinsToday = data.checkins.filter(c => c.t >= todayStart).length
  const week = data.checkins.filter(c => c.t >= todayStart - 6 * DAY).length / 7
  const cur = paidIn(months[7], cutoff)
  const prev = paidIn(months[6], cutoff)
  const debtTotal = [...debt.values()].reduce((s, d) => s + d.total, 0)
  const renewals = active.filter(m => { const x = diffDays(m.renewsOn, today); return x >= 0 && x <= 30 }).length
  const cancelledMonth = data.members.filter(m => m.status === 'cancelled' && monthKey(m.renewsOn) === monthKey(today)).length

  // heatmap: weekday x hour, last 90 days
  const grid = DOW.map(() => HOURS.map(() => 0))
  for (const c of data.checkins) {
    const d = new Date(c.t); const row = (d.getDay() + 6) % 7; const col = HOURS.indexOf(d.getHours())
    if (col >= 0) grid[row][col]++
  }
  const max = Math.max(...grid.flat(), 1)

  const away = active.map(m => ({ m, d: since(m.id) })).filter(x => x.d >= 14).sort((a, b) => b.d - a.d).slice(0, 6)

  return (
    <>
      <PageHead title="Painel" sub="Visão do dia: receita, presença e quem precisa de um contato agora." />
      <div className="kpis">
        <Kpi label="Alunos ativos" value={String(active.length)} note={`${data.members.length} matrículas no total`} />
        <Kpi label="Receita recorrente (MRR)" value={brl(mrr(data.members, data.plans))} note="soma dos planos ativos" />
        <Kpi label="Recebido no mês" value={brl(cur)} delta={`${Math.round(((cur - prev) / (prev || 1)) * 100)}%`} note="vs mês anterior, mesmo período" tone={cur >= prev ? 'up' : 'down'} />
        <Kpi label="Em atraso" value={brl(debtTotal)} note={`${debt.size} alunos · ${((debt.size / Math.max(active.length, 1)) * 100).toFixed(1).replace('.', ',')}% da base`} />
        <Kpi label="Check-ins hoje" value={String(checkinsToday)} note={`média 7 dias: ${week.toFixed(0)}/dia`} />
        <Kpi label="Renovam em 30 dias" value={String(renewals)} note={`${cancelledMonth} cancelamento${cancelledMonth === 1 ? '' : 's'} no mês`} />
      </div>

      <Suspense fallback={<div className="charts-fallback" aria-hidden="true" />}>
        <PainelCharts revenue={revenue} flow={flow} byPlan={byPlan} grid={grid} max={max} />
      </Suspense>

      <Card title="Atenção hoje" sub="Alunos ativos que pararam de aparecer" action={<button className="btn ghost" onClick={() => setView('campanhas')}>Criar campanha</button>}>
        {away.length === 0 ? <Empty text="Ninguém sumido. Boa." /> : (
          <ul className="list">
            {away.map(({ m, d }) => (
              <li key={m.id}>
                <button className="row-btn" onClick={() => { setView('alunos'); select(m.id) }}>
                  <Avatar name={m.name} /><span className="grow"><b>{m.name}</b><small>{byId.get(m.id)!.goal}</small></span>
                  <Badge tone={d >= 30 ? 'bad' : 'warn'}>{Number.isFinite(d) ? `${d} dias sem treinar` : 'nunca treinou'}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
