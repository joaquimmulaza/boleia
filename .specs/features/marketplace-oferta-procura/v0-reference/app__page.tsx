'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, MapPin, Menu, MoreHorizontal, Navigation, Plus, Search, ShieldCheck, Star, Users, X } from 'lucide-react'

const screens = [
  'As minhas ofertas', 'Publicar oferta', 'A minha procura', 'Ofertas compatíveis',
  'Lista de espera', 'Rever proposta', 'Acordos', 'Detalhe do acordo'
]

function Chip({ children, tone = 'green' }: { children: React.ReactNode, tone?: 'green' | 'amber' | 'red' | 'neutral' }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

function Button({ children, onClick, secondary = false }: { children: React.ReactNode, onClick?: () => void, secondary?: boolean }) {
  return <button className={secondary ? 'button button-secondary' : 'button'} onClick={onClick}>{children}</button>
}

function Header({ title, onBack, onMenu }: { title: string, onBack?: () => void, onMenu?: () => void }) {
  return <header className="app-header">
    {onBack ? <button className="icon-btn" aria-label="Voltar" onClick={onBack}><ArrowLeft size={20}/></button> : <div className="brand-mark">B<span>·</span>C</div>}
    <span className="header-title">{title}</span>
    {onMenu ? <button className="icon-btn" aria-label="Mais opções" onClick={onMenu}><MoreHorizontal size={21}/></button> : <button className="icon-btn" aria-label="Notificações"><Bell size={20}/></button>}
  </header>
}

function BottomNav({ screen, setScreen, driver = true }: { screen: number, setScreen: (n: number) => void, driver?: boolean }) {
  const items = [{ label: 'Início', icon: Navigation, to: 0 }, { label: driver ? 'Veículo' : 'Acordos', icon: driver ? MapPin : Check, to: driver ? 1 : 6 }, { label: 'Faltas', icon: CalendarDays, to: 4 }, { label: 'Perfil', icon: Users, to: 6 }]
  return <nav className="bottom-nav">{items.map(({ label, icon: Icon, to }) => <button key={label} className={(screen === to || (label === 'Início' && screen === 0)) ? 'nav-item active' : 'nav-item'} onClick={() => setScreen(to)}><Icon size={19}/><span>{label}</span></button>)}</nav>
}

function OfferHome({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="As minhas ofertas"/><main className="content"><div className="eyebrow">MOTORISTA</div><h1>As minhas ofertas</h1><p className="subtitle">Acompanha as tuas viagens e propostas.</p><section className="card offer-card"><div className="row-between"><Chip tone="amber">Parcial</Chip><span className="meta">Actualizada há 8 min</span></div><div className="route"><div><strong>Talatona</strong><span>Origem</span></div><ArrowRight className="route-arrow" size={19}/><div><strong>Mutual</strong><span>Destino</span></div></div><div className="time-row"><Clock3 size={16}/><strong>07:15</strong><span>•</span><Users size={16}/><span>3 lugares disponíveis</span></div><div className="price-row"><div><span className="label">Total do acordo</span><strong>120.000 Kz</strong></div><div className="proposals"><strong>2</strong><span>propostas</span></div></div><Button onClick={() => setScreen(5)}>Ver propostas <ChevronRight size={17}/></Button></section><button className="text-action" onClick={() => setScreen(1)}><Plus size={17}/> Nova oferta</button></main><BottomNav screen={0} setScreen={setScreen}/></>
}

function Publish({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Publicar oferta" onBack={() => setScreen(0)}/><main className="content"><h1>Publicar oferta</h1><p className="subtitle">Partilha a tua rota com pessoas de confiança.</p><div className="segmented"><button className="selected">Por passageiro</button><button>Total do acordo</button></div><section className="card form-card"><label>Valor <span>Kz</span><input value="40.000" readOnly/></label><label>Origem<div className="input-with-icon"><MapPin size={17}/><input value="Talatona" readOnly/></div></label><label>Destino<div className="input-with-icon"><Navigation size={17}/><input value="Mutual" readOnly/></div></label><div className="form-grid"><label>Hora<input value="07:15" readOnly/></label><label>Lugares<input value="3" readOnly/></label></div></section><Button onClick={() => setScreen(0)}>Publicar oferta</Button></main><BottomNav screen={1} setScreen={setScreen}/></>
}

function SearchHome({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="A minha procura"/><main className="content"><div className="eyebrow">PASSAGEIRO</div><h1>A minha procura</h1><p className="subtitle">Encontramos rotas que combinam contigo.</p><section className="card search-card"><div className="row-between"><Chip>Activa</Chip><span className="meta">Para amanhã</span></div><div className="route compact"><div><strong>Talatona</strong><span>Origem</span></div><ArrowRight className="route-arrow" size={19}/><div><strong>Mutual</strong><span>Destino</span></div></div><div className="detail-line"><Clock3 size={16}/><span>07:15</span><span className="dot">•</span><Users size={16}/><strong>Grupo · 3 pessoas</strong></div><div className="match-summary"><div><strong>4 ofertas compatíveis</strong><span>+ 1 na lista de espera</span></div><Button onClick={() => setScreen(3)}>Ver ofertas <ChevronRight size={17}/></Button></div></section><section className="tip"><ShieldCheck size={19}/><div><strong>Viaja com confiança</strong><p>Todos os acordos ficam registados para maior tranquilidade.</p></div></section></main><BottomNav screen={2} setScreen={setScreen} driver={false}/></>
}

function Matches({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Ofertas compatíveis" onBack={() => setScreen(2)}/><main className="content"><h1>Ofertas compatíveis</h1><p className="subtitle">Escolhe a opção que melhor se adapta ao teu grupo.</p><div className="result-count">4 ofertas compatíveis</div><section className="card person-card"><div className="person-main"><div className="avatar">JP</div><div><strong>João Pedro</strong><div className="rating"><Star size={13} fill="currentColor"/> 4,9 <span>· 24 viagens</span></div></div><Chip>Disponível</Chip></div><div className="offer-info"><span><Users size={15}/> 4 lugares</span><span><Clock3 size={15}/> 07:15</span><strong>40.000 Kz / pessoa</strong></div><Button onClick={() => setScreen(5)}>Propor acordo</Button></section><section className="card person-card waiting"><div className="person-main"><div className="avatar muted-avatar">MS</div><div><strong>Maria Santos</strong><div className="rating"><Star size={13} fill="currentColor"/> 4,8 <span>· 18 viagens</span></div></div><Chip tone="amber">1 lugar</Chip></div><div className="offer-info"><span><Users size={15}/> 1 lugar disponível</span><span><Clock3 size={15}/> 07:10</span></div><Button secondary onClick={() => setScreen(4)}>Entrar na lista de espera</Button></section></main><BottomNav screen={3} setScreen={setScreen} driver={false}/></>
}

function Waiting({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Lista de espera" onBack={() => setScreen(3)}/><main className="content centered-content"><div className="wait-icon"><Bell size={25}/></div><h1>Ficaste na lista de espera</h1><p className="subtitle">Avisamos-te assim que houver um lugar disponível nesta rota.</p><section className="card explanation"><div><Bell size={18}/><strong>Recebes uma notificação</strong><p>Quando alguém sair do acordo, serás avisado antes de o lugar ser disponibilizado.</p></div><div><Users size={18}/><strong>O teu lugar está protegido</strong><p>Entrar na lista de espera não ocupa nenhum lugar.</p></div></section><Button onClick={() => setScreen(2)}>Voltar à minha procura</Button></main><BottomNav screen={4} setScreen={setScreen} driver={false}/></>
}

function Review({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Rever proposta" onBack={() => setScreen(0)}/><main className="content"><h1>Rever proposta</h1><p className="subtitle">Confirma os detalhes antes de aceitar.</p><section className="card review-card"><div className="person-main"><div className="avatar">AC</div><div><strong>Ana Costa</strong><span className="meta">Propôs um acordo</span></div><Chip>Nova</Chip></div><div className="route compact"><div><strong>Talatona</strong><span>07:15</span></div><ArrowRight className="route-arrow" size={19}/><div><strong>Mutual</strong><span>Segunda a sexta</span></div></div><div className="review-total"><span>3 passageiros</span><div><span>Total do acordo</span><strong>120.000 Kz</strong></div><div><span>Por passageiro</span><strong>40.000 Kz / pessoa</strong></div></div></section><div className="button-stack"><Button onClick={() => setScreen(6)}><Check size={18}/> Aceitar proposta</Button><Button secondary onClick={() => setScreen(0)}><X size={18}/> Recusar</Button></div></main><BottomNav screen={5} setScreen={setScreen}/></>
}

function Agreements({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Acordos"/><main className="content"><h1>Acordos</h1><p className="subtitle">As tuas viagens combinadas num só lugar.</p><div className="section-label">ACTIVOS · 1</div><section className="card agreement-card" onClick={() => setScreen(7)}><div className="row-between"><Chip>Activo</Chip><ChevronRight size={19} className="muted"/></div><div className="agreement-route"><strong>Talatona</strong><ArrowRight size={17}/><strong>Mutual</strong></div><div className="agreement-meta"><span><Clock3 size={15}/> 07:15</span><span><Users size={15}/> Grupo · 3 pessoas</span></div><div className="agreement-bottom"><strong>40.000 Kz / pessoa</strong><span>Seg–Sex</span></div></section><div className="empty-note"><CircleHelp size={18}/><span>Precisas de ajuda com um acordo?</span><ChevronRight size={16}/></div></main><BottomNav screen={6} setScreen={setScreen} driver={false}/></>
}

function AgreementDetail({ setScreen }: { setScreen: (n:number)=>void }) {
  return <><Header title="Detalhe do acordo" onBack={() => setScreen(6)} onMenu={() => {}}/><main className="content"><div className="row-between detail-heading"><div><Chip>Activo</Chip><h1>Talatona → Mutual</h1></div><span className="meta">Desde 12 Jun</span></div><section className="card detail-card"><div className="detail-route"><div><span>Partida</span><strong>07:15</strong><small>Talatona</small></div><div className="line"/><div><span>Chegada</span><strong>~07:45</strong><small>Mutual</small></div></div><div className="frozen"><ShieldCheck size={17}/><div><strong>Preço combinado</strong><p>O valor fica congelado durante este acordo.</p></div><strong>40.000 Kz</strong></div></section><div className="section-label">PASSAGEIROS · 3</div><section className="card passenger-list"><div className="passenger"><div className="avatar small">AC</div><div><strong>Ana Costa</strong><span>Confirmada</span></div><strong>40.000 Kz</strong></div><div className="passenger"><div className="avatar small">JP</div><div><strong>João Pedro</strong><span>Confirmado</span></div><strong>40.000 Kz</strong></div><div className="passenger"><div className="avatar small">MS</div><div><strong>Maria Santos</strong><span>Confirmada</span></div><strong>40.000 Kz</strong></div></section><div className="button-stack"><Button secondary onClick={() => setScreen(6)}>Sair do acordo</Button><button className="absence-link" onClick={() => {}}>Registar falta</button></div></main><BottomNav screen={7} setScreen={setScreen} driver={false}/></>
}

export default function Page() {
  const [screen, setScreen] = useState(0)
  const render = [<OfferHome key="offer" setScreen={setScreen}/>, <Publish key="publish" setScreen={setScreen}/>, <SearchHome key="search" setScreen={setScreen}/>, <Matches key="matches" setScreen={setScreen}/>, <Waiting key="waiting" setScreen={setScreen}/>, <Review key="review" setScreen={setScreen}/>, <Agreements key="agreements" setScreen={setScreen}/>, <AgreementDetail key="detail" setScreen={setScreen}/>][screen]
  return <div className="prototype"><div className="screen-switcher"><span>Pré-visualização</span><select value={screen} onChange={(e) => setScreen(Number(e.target.value))} aria-label="Escolher vista">{screens.map((name, i) => <option key={name} value={i}>{i + 1}. {name}</option>)}</select></div><div className="phone">{render}</div></div>
}
