import { brl } from './lib'
import { Card } from './ui'

const PLAN_COLORS = ['#ff6a3d', '#14161b', '#2f8f7b', '#d9a441', '#7a6ff0']
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

interface Rev { mes: string; Recebido: number; 'Em aberto': number }
interface Flow { mes: string; Novos: number; Cancelamentos: number }

/** Lightweight CSS charts: the home screen stays fast; Recharts is used on the other screens. */
const niceMax = (v: number) => Math.max(Math.ceil(v / 4000) * 4000, 4000)

function Revenue({ data }: { data: Rev[] }) {
  const max = niceMax(Math.max(...data.map(d => d.Recebido + d['Em aberto'])))
  const ticks = [1, 0.75, 0.5, 0.25, 0]
  return (
    <div className="bars" role="img" aria-label="Faturamento mensal: recebido e em aberto">
      <div className="bars-y">{ticks.map(t => <span key={t}>{Math.round((max * t) / 1000)}k</span>)}</div>
      <div className="bars-plot">
        <div className="gls">{ticks.map(t => <i key={t} className="gl" style={{ bottom: `${t * 100}%` }} />)}</div>
        {data.map(d => (
          <div className="bars-col" key={d.mes} title={`${d.mes}: recebido ${brl(d.Recebido)}, em aberto ${brl(d['Em aberto'])}`}>
            <div className="stack"><i className="open" style={{ height: `${(d['Em aberto'] / max) * 100}%` }} /><i className="paid" style={{ height: `${(d.Recebido / max) * 100}%` }} /></div>
            <span>{d.mes}</span>
          </div>
        ))}
      </div>
      <div className="bars-key"><span><i className="paid" />Recebido</span><span><i className="open" />Em aberto</span></div>
    </div>
  )
}

function Diverge({ data }: { data: Flow[] }) {
  const max = Math.max(...data.flatMap(d => [d.Novos, d.Cancelamentos]), 1)
  return (
    <div className="div" role="img" aria-label="Matrículas novas e cancelamentos por mês">
      {data.map(d => (
        <div className="div-col" key={d.mes} title={`${d.mes}: ${d.Novos} novos, ${Math.abs(d.Cancelamentos)} cancelamentos`}>
          <div className="up"><b>{d.Novos}</b><i style={{ height: `${(d.Novos / max) * 100}%` }} /></div>
          <div className="dn"><i style={{ height: `${(Math.abs(d.Cancelamentos) / max) * 100}%` }} /><b>{Math.abs(d.Cancelamentos) || ''}</b></div>
          <span>{d.mes}</span>
        </div>
      ))}
    </div>
  )
}

export default function PainelCharts({ revenue, flow, byPlan, grid, max }: { revenue: Rev[]; flow: Flow[]; byPlan: { name: string; value: number }[]; grid: number[][]; max: number }) {
  return (
    <>
      <div className="grid g-main">
        <Card title="Faturamento por mês" sub="Recebido e em aberto, por mês de vencimento (últimos 8 meses)"><Revenue data={revenue} /></Card>
        <Card title="Base por plano" sub="Alunos ativos">
          <div className="donut-wrap">
            <div className="donut" role="img" aria-label="Distribuição de alunos ativos por plano" style={{ background: `conic-gradient(${(() => { let acc = 0; const t = byPlan.reduce((x, p) => x + p.value, 0) || 1; return byPlan.map((p, i) => { const from = acc; acc += (p.value / t) * 100; return `${PLAN_COLORS[i]} ${from}% ${acc}%` }).join(', ') })()})` }}><span><b>{byPlan.reduce((x, p) => x + p.value, 0)}</b>ativos</span></div>
            <ul className="legend">{byPlan.map((p, i) => <li key={p.name}><i style={{ background: PLAN_COLORS[i] }} />{p.name}<b>{p.value}</b></li>)}</ul>
          </div>
        </Card>
      </div>
      <div className="grid g-two">
        <Card title="Entradas e saídas" sub="Matrículas novas e cancelamentos por mês"><Diverge data={flow} /></Card>
        <Card title="Horários de pico" sub="Check-ins por dia da semana e hora, últimos 90 dias">
          <div className="heat" role="img" aria-label="Mapa de calor de check-ins por dia da semana e hora">
            <div className="heat-row heat-head"><span />{HOURS.map(h => <span key={h}>{h % 2 === 0 ? h : ''}</span>)}</div>
            {DOW.map((d, r) => (
              <div className="heat-row" key={d}>
                <span className="heat-d">{d}</span>
                {grid[r].map((v, c) => <i key={c} title={`${d} ${HOURS[c]}h: ${v} check-ins`} style={{ background: `color-mix(in oklab, #ff6a3d ${Math.round((v / max) * 100)}%, #f1ece1)` }} />)}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
