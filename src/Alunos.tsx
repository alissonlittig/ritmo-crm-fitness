import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { brl, brl2, dateBR, diffDays } from './lib'
import { useStore } from './store'
import { Avatar, Badge, Card, Empty, Icon, PageHead, StatusBadge, useDerived } from './ui'

type Filter = 'todos' | 'ativos' | 'inadimplentes' | 'inativos' | 'trancados' | 'cancelados'
const FILTERS: [Filter, string][] = [['todos', 'Todos'], ['ativos', 'Ativos'], ['inadimplentes', 'Inadimplentes'], ['inativos', 'Sumidos'], ['trancados', 'Trancados'], ['cancelados', 'Cancelados']]

export function Alunos() {
  const { data, debt, since, plans } = useDerived()
  const { select, selected } = useStore()
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filter>('todos')
  const [adding, setAdding] = useState(false)
  const [limit, setLimit] = useState(25)

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return data.members.filter(m => {
      if (s && !m.name.toLowerCase().includes(s) && !m.phone.includes(s)) return false
      switch (f) {
        case 'ativos': return m.status === 'active'
        case 'inadimplentes': return debt.has(m.id) && m.status !== 'cancelled'
        case 'inativos': return m.status === 'active' && since(m.id) >= 14
        case 'trancados': return m.status === 'frozen'
        case 'cancelados': return m.status === 'cancelled'
        default: return true
      }
    })
  }, [data.members, q, f, debt, since])

  return (
    <>
      <PageHead title="Alunos" sub={`${rows.length} de ${data.members.length} matrículas`}>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} />Nova matrícula</button>
      </PageHead>
      <div className="toolbar">
        <label className="search"><Icon n="search" s={16} /><input value={q} onChange={e => { setQ(e.target.value); setLimit(25) }} placeholder="Buscar por nome ou telefone" aria-label="Buscar aluno" /></label>
        <div className="chips" role="tablist">
          {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'chip on' : 'chip'} onClick={() => { setF(k); setLimit(25) }}>{l}</button>)}
        </div>
      </div>
      <Card className="flush">
        {rows.length === 0 ? <Empty text="Nenhum aluno com esse filtro." /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Aluno</th><th>Plano</th><th>Situação</th><th>Último treino</th><th>Renova em</th><th className="r">Em aberto</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map(m => {
                  const d = since(m.id); const owe = debt.get(m.id)
                  return (
                    <tr key={m.id} onClick={() => select(m.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && select(m.id)}>
                      <td data-l="Aluno"><span className="who"><Avatar name={m.name} /><span><b>{m.name}</b><small>{m.phone}</small></span></span></td>
                      <td data-l="Plano">{plans.get(m.planId)!.name}</td>
                      <td data-l="Situação"><StatusBadge m={m} overdue={!!owe} /></td>
                      <td data-l="Último treino">{m.status === 'cancelled' ? '—' : Number.isFinite(d) ? (d === 0 ? 'Hoje' : `há ${d} d`) : 'Nunca'}</td>
                      <td data-l="Renova em">{m.status === 'cancelled' ? '—' : dateBR(m.renewsOn)}</td>
                      <td data-l="Em aberto" className="r">{owe ? <b className="neg">{brl(owe.total)}</b> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && <div className="more"><span>Mostrando {limit} de {rows.length}</span><button className="btn sm" onClick={() => setLimit(l => l + 25)}>Ver mais</button></div>}
      </Card>
      {selected && <Drawer id={selected} />}
      {adding && <NewMember onClose={() => setAdding(false)} />}
    </>
  )
}

function Drawer({ id }: { id: string }) {
  const { data, today, debt, since, plans } = useDerived()
  const { select, checkIn, payInvoices, renew, setStatus } = useStore()
  const m = data.members.find(x => x.id === id)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && select(null)
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [select])
  if (!m) return null
  const plan = plans.get(m.planId)!
  const owe = debt.get(m.id)
  const mine = data.checkins.filter(c => c.m === id)
  const d30 = mine.filter(c => c.t > Date.now() - 30 * 86_400_000).length
  const days = since(id)
  const invs = data.invoices.filter(i => i.memberId === id).sort((a, b) => b.due.localeCompare(a.due)).slice(0, 6)
  const toRenew = diffDays(m.renewsOn, today)

  return (
    <div className="scrim" onClick={() => select(null)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Ficha de ${m.name}`} onClick={e => e.stopPropagation()}>
        <header>
          <Avatar name={m.name} size={52} />
          <div className="grow"><h2>{m.name}</h2><p><Icon n="phone" s={13} /> {m.phone}</p></div>
          <button className="icon-btn" onClick={() => select(null)} aria-label="Fechar"><Icon n="close" /></button>
        </header>
        <div className="drawer-badges"><StatusBadge m={m} overdue={!!owe} />{days >= 14 && m.status === 'active' && <Badge tone="warn">Risco de evasão</Badge>}</div>
        <dl className="facts">
          <div><dt>Plano</dt><dd>{plan.name} · {brl(plan.price)}/mês</dd></div>
          <div><dt>Objetivo</dt><dd>{m.goal}</dd></div>
          <div><dt>Aluno desde</dt><dd>{dateBR(m.joined)}</dd></div>
          <div><dt>{m.status === 'cancelled' ? 'Cancelou em' : 'Renovação'}</dt><dd>{dateBR(m.renewsOn)}{m.status !== 'cancelled' && ` (${toRenew < 0 ? `venceu há ${-toRenew} d` : `em ${toRenew} d`})`}</dd></div>
          <div><dt>Treinos em 30 dias</dt><dd>{d30}</dd></div>
          <div><dt>Último treino</dt><dd>{Number.isFinite(days) ? (days === 0 ? 'Hoje' : `há ${days} dias`) : 'Nunca'}</dd></div>
        </dl>
        {owe && <div className="alert"><Icon n="alert" /><span><b>{brl2(owe.total)}</b> em atraso ({owe.count} cobrança{owe.count > 1 ? 's' : ''}), a mais antiga vence {dateBR(owe.oldest)}.</span></div>}
        <h4>Cobranças recentes</h4>
        <ul className="mini">
          {invs.map(i => <li key={i.id}><span>{dateBR(i.due)}</span><span>{brl2(i.amount)}</span>{i.paidOn ? <Badge tone="ok">Pago</Badge> : i.due < today ? <Badge tone="bad">Atrasado</Badge> : <Badge tone="mute">A vencer</Badge>}</li>)}
        </ul>
        <div className="drawer-actions">
          <button className="btn primary" disabled={m.status !== 'active'} onClick={() => checkIn(id)}>Registrar check-in</button>
          {owe && <button className="btn" onClick={() => payInvoices(id)}>Baixar em atraso</button>}
          {m.status !== 'cancelled' && <button className="btn" onClick={() => renew(id)}>Renovar plano</button>}
          {m.status === 'active' && <button className="btn" onClick={() => setStatus(id, 'frozen')}>Trancar</button>}
          {m.status !== 'active' && <button className="btn" onClick={() => setStatus(id, 'active')}>Reativar</button>}
          {m.status !== 'cancelled' && <button className="btn danger" onClick={() => setStatus(id, 'cancelled')}>Cancelar matrícula</button>}
        </div>
      </aside>
    </div>
  )
}

function NewMember({ onClose }: { onClose: () => void }) {
  const { data } = useDerived()
  const { addMember, select } = useStore()
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [planId, setPlanId] = useState(data.plans[0].id); const [goal, setGoal] = useState('Condicionamento')
  const ok = name.trim().length >= 3 && phone.replace(/\D/g, '').length >= 10
  const submit = (e: FormEvent) => { e.preventDefault(); if (!ok) return; const id = addMember({ name: name.trim(), phone, planId, goal }); onClose(); select(id) }
  return (
    <div className="scrim center" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={e => e.stopPropagation()} aria-label="Nova matrícula">
        <h2>Nova matrícula</h2>
        <label>Nome completo<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Marina Souza" /></label>
        <label>Telefone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(41) 90000-0000" inputMode="tel" /></label>
        <label>Plano<select value={planId} onChange={e => setPlanId(e.target.value)}>{data.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {brl(p.price)}/mês</option>)}</select></label>
        <label>Objetivo<select value={goal} onChange={e => setGoal(e.target.value)}>{['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Reabilitação', 'Saúde e bem-estar', 'Preparação para corrida'].map(g => <option key={g}>{g}</option>)}</select></label>
        <div className="modal-a"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok}>Matricular</button></div>
      </form>
    </div>
  )
}
