import { describe, expect, it } from 'vitest'
import { addMonths, debtByMember, diffDays, fillTemplate, lastMonths, segmentMembers } from './lib'
import { buildSeed } from './seed'

const TODAY = '2026-11-06'

describe('datas', () => {
  it('addMonths respeita fim de mês', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-06', 12)).toBe('2027-11-06')
  })
  it('diffDays', () => expect(diffDays('2026-11-06', '2026-10-30')).toBe(7))
  it('lastMonths', () => expect(lastMonths(TODAY, 3)).toEqual(['2026-09', '2026-10', '2026-11']))
})

describe('seed', () => {
  const d = buildSeed(TODAY)
  it('é determinística', () => expect(buildSeed(TODAY).members[7]).toEqual(d.members[7]))
  it('tem todos os segmentos com alguém', () => {
    for (const k of ['inativos', 'inadimplentes', 'vencendo', 'trancados', 'cancelados'] as const)
      expect(segmentMembers(k, d, TODAY).length, k).toBeGreaterThan(0)
  })
  it('inadimplente tem dívida', () => {
    const debt = debtByMember(d.invoices, TODAY)
    for (const m of segmentMembers('inadimplentes', d, TODAY)) expect(debt.get(m.id)!.total).toBeGreaterThan(0)
  })
  it('template troca todas as variáveis', () => {
    const m = segmentMembers('inativos', d, TODAY)[0]
    expect(fillTemplate('Oi {nome} {dias} {valor} {estudio}', m, d, TODAY)).not.toMatch(/[{}]/)
  })
})
