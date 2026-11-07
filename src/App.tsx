import { Suspense, lazy, type ComponentType } from 'react'
import { Alunos } from './Alunos'
import { Painel } from './Painel'
import { useStore } from './store'
import type { View } from './types'
import { Icon } from './ui'

const G = (k: 'Campanhas' | 'Checkin' | 'Cobrancas' | 'Planos' | 'Renovacoes') => lazy(() => import('./Gestao').then(m => ({ default: m[k] })))
const NAV: [View, string][] = [['painel', 'Painel'], ['alunos', 'Alunos'], ['checkin', 'Check-in'], ['cobrancas', 'Cobranças'], ['renovacoes', 'Renovações'], ['campanhas', 'Campanhas'], ['planos', 'Planos']]
const VIEWS: Record<View, ComponentType> = { painel: Painel, alunos: Alunos, checkin: G('Checkin'), cobrancas: G('Cobrancas'), renovacoes: G('Renovacoes'), campanhas: G('Campanhas'), planos: G('Planos') }

export default function App() {
  const { view, setView, reset, toasts } = useStore()
  const Page = VIEWS[view] ?? Painel
  return (
    <div className="shell">
      <nav className="side" aria-label="Principal">
        <div className="brand"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#ff6a3d" /><path d="M5 17h5l3-8 5 15 3-9h6" fill="none" stroke="#14161b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Ritmo<small>CRM fitness</small></span></div>
        <ul>
          {NAV.map(([k, l]) => (
            <li key={k}><button className={view === k ? 'nav on' : 'nav'} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}><Icon n={k} /><span>{l}</span></button></li>
          ))}
        </ul>
        <div className="side-f">
          <p>Dados fictícios de demonstração, gerados no seu navegador.</p>
          <button className="btn ghost-dark" onClick={reset}><Icon n="reset" s={15} />Restaurar demo</button>
        </div>
      </nav>
      <main id="main">
        <div className="demo-bar">Demonstração com dados fictícios. Nada aqui é de aluno real.</div>
        <Suspense fallback={null}><Page /></Suspense>
      </main>
      <div className="toasts" role="status" aria-live="polite">{toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}</div>
    </div>
  )
}
