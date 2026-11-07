export type Status = 'active' | 'frozen' | 'cancelled'
export type View = 'painel' | 'alunos' | 'checkin' | 'cobrancas' | 'renovacoes' | 'campanhas' | 'planos'

export interface Plan { id: string; name: string; price: number; months: number; perks: string }
export interface Member {
  id: string; name: string; phone: string; planId: string; status: Status
  joined: string; renewsOn: string; goal: string
}
export interface Invoice { id: string; memberId: string; due: string; amount: number; paidOn?: string }
/** m = member id, t = epoch ms */
export interface Checkin { m: string; t: number }
export type SegmentKey = 'inativos' | 'inadimplentes' | 'vencendo' | 'trancados' | 'cancelados'
export interface Campaign {
  id: string; name: string; segment: SegmentKey; message: string
  sentAt: number; recipients: string[]
}
export interface Data {
  plans: Plan[]; members: Member[]; invoices: Invoice[]; checkins: Checkin[]; campaigns: Campaign[]
  seededOn: string
}
