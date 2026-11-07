import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SEGMENTS, brl, brl2, dateBR, diffDays, fillTemplate, reactivated, segmentMembers } from './lib'
import { useStore } from './store'
import type { SegmentKey } from './types'
import { Avatar, Badge, Card, Empty, Icon, Kpi, PageHead, useDerived } from './ui'

/* ---------- Check-in ---------- */
export function Checkin() {
  const { data, today, byId, since } = useDerived()
  const { checkIn, select, setView } = useStore()
  const [q, setQ] = useState('')
  const start = new Date(today + 'T00:00:00').getTime()
  const todays = data.checkins.filter(c => c.t >= start).sort((a, b) => b.t - a.t)
  const hits = q.trim().length < 2 ? [] : data.members.filter(m => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
  const doneToday = new Set(todays.map(c => c.m))
  return (
    <>
      <PageHead title="Check-in" sub="Recepção: busque o aluno e registre a entrada em um toque." />
      <div className="grid g-two">
        <Card title="Registrar entrada">
          <label className="search big"><Icon n="search" s={18} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Digite o nome do aluno" aria-label="Nome do aluno" /></label>
          <ul className="list">
            {hits.map(m => (
              <li key={m.id} className="row">
                <Avatar name={m.name} /><span className="grow"><b>{m.name}</b><small>{m.status === 'active' ? (Number.isFinite(since(m.id)) ? `último treino há ${since(m.id)} d` : 'primeiro treino') : m.status === 'frozen' ? 'matrícula trancada' : 'cancelado'}</small></span>
                {doneToday.has(m.id) ? <Badge tone="ok">Já entrou</Badge> : <button className="btn primary sm" disabled={m.status !== 'active'} onClick={() => { checkIn(m.id); setQ('') }}>Check-in</button>}
              </li>
            ))}
            {q.trim().length >= 2 && hits.length === 0 && <Empty text="Ninguém com esse nome." />}
            {q.trim().length < 2 && <li className="hint">Dica: digite 2 letras ou mais. Alunos trancados ou cancelados não podem entrar.</li>}
          </ul>
        </Card>
        <Card title={`Entradas de hoje · ${todays.length}`} sub="Mais recentes primeiro">
          {todays.length === 0 ? <Empty text="Ainda sem entradas hoje." /> : (
            <ul className="list scroll">
              {todays.slice(0, 40).map(c => { const m = byId.get(c.m)!; return (
                <li key={c.t + c.m}><button className="row-btn" onClick={() => { setView('alunos'); select(m.id) }}><Avatar name={m.name} size={30} /><span className="grow"><b>{m.name}</b></span><time>{new Date(c.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></button></li>
              ) })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/* ---------- Cobranças ---------- */
export function Cobrancas() {
  const { data, today, debt, byId } = useDerived()
  const { payInvoices, select, setView } = useStore()
  const rows = [...debt.entries()].map(([id, d]) => ({ m: byId.get(id)!, ...d, age: diffDays(today, d.oldest) })).sort((a, b) => b.age - a.age)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const bucket = (lo: number, hi: number) => rows.filter(r => r.age >= lo && r.age <= hi).reduce((s, r) => s + r.total, 0)
  const aging = [{ f: '1–7 dias', v: bucket(1, 7), c: '#d9a441' }, { f: '8–30 dias', v: bucket(8, 30), c: '#ff6a3d' }, { f: '31–60 dias', v: bucket(31, 60), c: '#d9573a' }, { f: '60+ dias', v: bucket(61, 9999), c: '#8c2f1d' }]
  const billed = data.invoices.filter(i => i.due.slice(0, 7) === today.slice(0, 7) && i.due < today)
  const rate = billed.length ? (billed.filter(i => i.paidOn).length / billed.length) * 100 : 100
  return (
    <>
      <PageHead title="Cobranças" sub="Inadimplência por tempo de atraso e baixa em um clique." />
      <div className="kpis three">
        <Kpi label="Total em atraso" value={brl(total)} note={`${rows.length} alunos`} />
        <Kpi label="Ticket médio em atraso" value={brl(rows.length ? total / rows.length : 0)} note="por aluno inadimplente" />
        <Kpi label="Adimplência do mês" value={`${rate.toFixed(0)}%`} note="cobranças vencidas e pagas" />
      </div>
      <div className="grid g-main">
        <Card title="Lista de inadimplentes" sub="Mais antigos primeiro" className="flush">
          {rows.length === 0 ? <Empty text="Nenhuma cobrança em atraso." /> : (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Aluno</th><th>Atraso</th><th>Cobranças</th><th className="r">Valor</th><th /></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.m.id}>
                  <td data-l="Aluno"><button className="link who" onClick={() => { setView('alunos'); select(r.m.id) }}><Avatar name={r.m.name} /><span><b>{r.m.name}</b><small>{r.m.phone}</small></span></button></td>
                  <td data-l="Atraso"><Badge tone={r.age > 30 ? 'bad' : 'warn'}>{r.age} {r.age === 1 ? 'dia' : 'dias'}</Badge></td>
                  <td data-l="Cobranças">{r.count}</td>
                  <td data-l="Valor" className="r"><b>{brl2(r.total)}</b></td>
                  <td className="r act"><button className="btn sm" onClick={() => payInvoices(r.m.id)}>Dar baixa</button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Envelhecimento da dívida" sub="Valor por faixa de atraso">
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="f" width={78} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b6f78' }} />
                <Tooltip cursor={{ fill: 'rgba(20,22,27,.04)' }} formatter={(v: unknown) => brl(Number(v))} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                <Bar isAnimationActive={false} dataKey="v" radius={6} barSize={22}>{aging.map((a, i) => <Cell key={i} fill={a.c} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ---------- Renovações ---------- */
export function Renovacoes() {
  const { data, today, plans } = useDerived()
  const { renew, select, setView } = useStore()
  const list = data.members.filter(m => m.status === 'active').map(m => ({ m, d: diffDays(m.renewsOn, today) })).filter(x => x.d <= 30).sort((a, b) => a.d - b.d)
  const expired = list.filter(x => x.d < 0)
  const groups = [{ t: 'Vencidos, sem renovar', items: expired, tone: 'bad' as const }, { t: 'Próximos 7 dias', items: list.filter(x => x.d >= 0 && x.d <= 7), tone: 'warn' as const }, { t: '8 a 30 dias', items: list.filter(x => x.d > 7), tone: 'mute' as const }]
  const value = list.reduce((s, x) => s + plans.get(x.m.planId)!.price * plans.get(x.m.planId)!.months, 0)
  return (
    <>
      <PageHead title="Renovações" sub="Quem vence nos próximos 30 dias e quem já passou do prazo." />
      <div className="kpis three">
        <Kpi label="Para renovar" value={String(list.length)} note="vencem em até 30 dias" />
        <Kpi label="Já vencidos" value={String(expired.length)} note="resgatar antes de virar cancelamento" />
        <Kpi label="Receita em jogo" value={brl(value)} note="valor dos planos a renovar" />
      </div>
      {groups.map(g => (
        <Card key={g.t} title={`${g.t} · ${g.items.length}`} className="flush gap">
          {g.items.length === 0 ? <Empty text="Nada por aqui." /> : (
            <ul className="list pad">
              {g.items.map(({ m, d }) => (
                <li key={m.id} className="row">
                  <button className="link who" onClick={() => { setView('alunos'); select(m.id) }}><Avatar name={m.name} /><span><b>{m.name}</b><small>{plans.get(m.planId)!.name} · {dateBR(m.renewsOn)}</small></span></button>
                  <span className="grow" /><Badge tone={g.tone}>{d < 0 ? `venceu há ${-d} d` : d === 0 ? 'vence hoje' : `em ${d} d`}</Badge>
                  <button className="btn sm" onClick={() => renew(m.id)}>Renovar</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </>
  )
}

/* ---------- Campanhas ---------- */
export function Campanhas() {
  const { data, today, byId } = useDerived()
  const send = useStore(s => s.sendCampaign)
  const [seg, setSeg] = useState<SegmentKey>('inativos')
  const [msg, setMsg] = useState(SEGMENTS.inativos.template)
  const [name, setName] = useState('Volta ao treino')
  const people = useMemo(() => segmentMembers(seg, data, today), [seg, data, today])
  const preview = people[0] ? fillTemplate(msg, people[0], data, today) : ''
  const pick = (k: SegmentKey) => { setSeg(k); setMsg(SEGMENTS[k].template); setName(SEGMENTS[k].label) }
  return (
    <>
      <PageHead title="Campanhas de reativação" sub="Segmente a base, ajuste a mensagem e acompanhe quem voltou a treinar." />
      <div className="grid g-two">
        <Card title="Nova campanha">
          <div className="seg-list" role="radiogroup" aria-label="Público">
            {(Object.keys(SEGMENTS) as SegmentKey[]).map(k => (
              <button key={k} role="radio" aria-checked={seg === k} className={seg === k ? 'seg on' : 'seg'} onClick={() => pick(k)}>
                <span><b>{SEGMENTS[k].label}</b><small>{SEGMENTS[k].hint}</small></span><em>{segmentMembers(k, data, today).length}</em>
              </button>
            ))}
          </div>
          <div className="form">
            <label>Nome da campanha<input value={name} onChange={e => setName(e.target.value)} /></label>
            <label>Mensagem<textarea rows={5} value={msg} onChange={e => setMsg(e.target.value)} /></label>
            <p className="vars">Variáveis: {'{nome}'} {'{dias}'} {'{valor}'} {'{estudio}'}</p>
            {preview && <div className="bubble"><small>Prévia para {people[0].name}</small>{preview}</div>}
            <button className="btn primary" disabled={!people.length || !msg.trim() || !name.trim()} onClick={() => send(name.trim(), seg, msg)}><Icon n="send" s={16} />Simular envio para {people.length}</button>
            <p className="demo-note">Demonstração: o envio é simulado. Nenhuma mensagem sai do navegador.</p>
          </div>
        </Card>
        <Card title="Resultados" sub="Alunos que voltaram a treinar depois do envio">
          {data.campaigns.length === 0 ? <Empty text="Nenhuma campanha ainda." /> : (
            <ul className="camp">
              {data.campaigns.map(c => {
                const back = reactivated(c, data.checkins); const pct = c.recipients.length ? (back / c.recipients.length) * 100 : 0
                return (
                  <li key={c.id}>
                    <div className="camp-h"><b>{c.name}</b><Badge tone="mute">{SEGMENTS[c.segment].label}</Badge></div>
                    <small>{new Date(c.sentAt).toLocaleDateString('pt-BR')} · {c.recipients.length} alunos · {c.recipients.slice(0, 2).map(r => byId.get(r)?.name.split(' ')[0]).join(', ')}{c.recipients.length > 2 ? '…' : ''}</small>
                    <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                    <span className="camp-r"><b>{back}</b> voltaram · {pct.toFixed(0)}%</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/* ---------- Planos ---------- */
export function Planos() {
  const { data, plans } = useDerived()
  const active = data.members.filter(m => m.status === 'active')
  return (
    <>
      <PageHead title="Planos" sub="Catálogo, base ativa e receita mensal por plano." />
      <div className="plans">
        {data.plans.map(p => {
          const n = active.filter(m => m.planId === p.id).length
          return (
            <Card key={p.id} className="plan">
              <h2>{p.name}</h2>
              <p className="price"><b>{brl(plans.get(p.id)!.price)}</b><span>/mês</span></p>
              <p className="perks">{p.perks}</p>
              <dl><div><dt>Ciclo</dt><dd>{p.months === 1 ? 'mensal' : `${p.months} meses`}</dd></div><div><dt>Alunos</dt><dd>{n}</dd></div><div><dt>Receita/mês</dt><dd>{brl(n * p.price)}</dd></div></dl>
            </Card>
          )
        })}
      </div>
      <Card title="Receita mensal por plano" sub="Alunos ativos × preço do plano" className="gap-top">
        <div className="chart short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.plans.map(p => ({ plano: p.name, receita: active.filter(m => m.planId === p.id).length * p.price }))} margin={{ top: 8, right: 8, left: -8 }}>
              <XAxis dataKey="plano" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b6f78' }} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 12, fill: '#6b6f78' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip cursor={{ fill: 'rgba(20,22,27,.04)' }} formatter={(v: unknown) => brl(Number(v))} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
              <Bar isAnimationActive={false} dataKey="receita" fill="#ff6a3d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}
