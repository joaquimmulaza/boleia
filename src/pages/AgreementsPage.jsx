import React, { useState, useEffect } from 'react';
import { Car, Clock, CreditCard, MapPin, Plus, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Formata um valor numérico em Kwanzas com separador de milhar.
 * ex: 25000 → "25 000 Kz/mês"
 */
const formatKz = (value) => {
  const num = Number(value);
  if (isNaN(num)) return `${value} Kz/mês`;
  return `${num.toLocaleString('pt-PT')} Kz/mês`;
};

/**
 * Devolve as classes CSS de estilo do badge de estado.
 */
const getBadgeClasses = (estado) => {
  switch (estado) {
    case 'Ativo':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'Pendente':
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'Cancelado':
      return 'bg-red-100 text-red-600 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
};

/**
 * Devolve a inicial do nome do motorista (placeholder de avatar).
 */
const getInitial = (nome) => (nome ? nome.charAt(0).toUpperCase() : '?');

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/**
 * Card de um acordo individual.
 */
const AcordoCard = ({ acordo }) => {
  const isCancelado = acordo.estado === 'Cancelado';

  return (
    <article
      data-testid="agreement-card"
      className={`bg-white rounded-2xl p-4 space-y-3 transition-opacity ${
        isCancelado ? 'opacity-60' : 'opacity-100'
      }`}
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}
    >
      {/* Cabeçalho do card: avatar + nome + badge */}
      <div className="flex items-center gap-3">
        {/* Avatar com inicial */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base shrink-0 ${
            acordo.estado === 'Ativo'
              ? 'bg-emerald-500'
              : acordo.estado === 'Pendente'
              ? 'bg-amber-400'
              : 'bg-gray-400'
          }`}
          aria-hidden="true"
        >
          {getInitial(acordo.nome_motorista)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[#1A202C] font-bold text-sm leading-tight truncate">
            {acordo.nome_motorista ?? 'Motorista'}
          </p>
          <span
            className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${getBadgeClasses(
              acordo.estado
            )}`}
          >
            {acordo.estado}
          </span>
        </div>
      </div>

      {/* Rota */}
      <div className="flex items-center gap-2 text-[#1A202C] text-sm font-medium">
        <MapPin size={15} className="text-emerald-500 shrink-0" />
        <span>
          {acordo.ponto_partida} → {acordo.ponto_chegada}
        </span>
      </div>

      {/* Hora e valor */}
      <div className="flex items-center gap-4 text-[#718096] text-sm">
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="shrink-0" />
          <span>{acordo.hora_recolha}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard size={14} className="shrink-0" />
          <span className="text-[#1A202C] font-semibold">
            {formatKz(acordo.valor_mensal)}
          </span>
        </div>
      </div>
    </article>
  );
};

/**
 * Estado vazio — nenhum acordo encontrado.
 */
const EmptyState = ({ onPedirBoleia }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
    <div className="bg-emerald-50 rounded-full p-6">
      <Car size={56} className="text-emerald-400" aria-hidden="true" />
    </div>
    <h2 className="text-[#1A202C] font-bold text-xl">Ainda não tens boleias</h2>
    <p className="text-[#718096] text-sm leading-relaxed max-w-xs">
      Pede a tua primeira boleia e começa a poupar na deslocação diária!
    </p>
    <button
      onClick={onPedirBoleia}
      className="mt-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25"
    >
      Pedir Boleia
    </button>
  </div>
);

/**
 * Modal de confirmação para pedir nova boleia.
 */
const ModalPedirBoleia = ({ onConfirmar, onFechar }) => (
  <div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onFechar}
      aria-hidden="true"
    />

    {/* Conteúdo */}
    <div
      data-testid="modal-pedir-boleia"
      className="relative z-10 bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-2xl mx-4 sm:mx-auto"
    >

      {/* Ícone */}
      <div className="flex justify-center">
        <div className="bg-emerald-50 rounded-full p-4">
          <Car size={32} className="text-emerald-500" aria-hidden="true" />
        </div>
      </div>

      {/* Títulos */}
      <div className="text-center space-y-1">
        <h3 id="modal-title" className="text-[#1A202C] font-bold text-lg">
          Pedir Nova Boleia
        </h3>
        <p className="text-[#718096] text-sm">
          Confirmas que queres solicitar uma nova boleia mensal?
        </p>
      </div>

      {/* Botões */}
      <div className="flex flex-col gap-3 pt-1">
        <button
          onClick={onConfirmar}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
        >
          <Check size={18} />
          Confirmar
        </button>
        <button
          onClick={onFechar}
          className="w-full bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-[#1A202C] font-semibold py-4 rounded-xl transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────

/**
 * @typedef {Readonly<{}>} AgreementsPageProps
 * Página "Meus Acordos" — sem props externas.
 */
const AgreementsPage = () => {
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  // ─── Carrega acordos ao montar ──────────────────────────────────────────────
  useEffect(() => {
    const carregarAcordos = async () => {
      setIsLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('acordos')
        .select(
          'id, id_passageiro, ponto_partida, ponto_chegada, estado, valor_mensal, hora_recolha, nome_motorista'
        )
        .eq('id_passageiro', user.id);

      if (!error && data) {
        setAcordos(data);
      }

      setIsLoading(false);
    };

    carregarAcordos();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleAbrirModal = () => setModalAberto(true);
  const handleFecharModal = () => setModalAberto(false);
  const handleConfirmarBoleia = () => {
    // TODO: lógica de criação de acordo no Supabase (próxima iteração)
    handleFecharModal();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="font-[Plus_Jakarta_Sans,sans-serif] min-h-screen bg-[#F2F4F7] text-gray-800 antialiased"
    >
      {/* ── Header sticky ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-white/80 backdrop-blur-md px-4 py-3 border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg">
            <Car size={22} className="text-emerald-500" aria-hidden="true" />
          </div>
          <span className="text-[#1A202C] text-lg font-bold tracking-tight">
            Boleia Certa
          </span>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[#718096] text-xs font-medium">Passageiro</p>
          <p className="text-[#1A202C] text-sm font-bold">Luanda, AO</p>
        </div>
      </header>

      {/* ── Conteúdo principal ── */}
      <main className="px-4 py-6 pb-28 space-y-5">
        {/* Título da página */}
        <div className="space-y-0.5">
          <h1 className="text-[#1A202C] text-3xl font-bold tracking-tight">
            Meus Acordos
          </h1>
          <p className="text-[#718096] text-sm">As tuas boleias do mês</p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3" aria-busy="true" aria-label="A carregar acordos">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 h-32 animate-pulse"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}
              />
            ))}
          </div>
        )}

        {/* Estado vazio */}
        {!isLoading && acordos.length === 0 && (
          <EmptyState onPedirBoleia={handleAbrirModal} />
        )}

        {/* Lista de acordos */}
        {!isLoading && acordos.length > 0 && (
          <section className="space-y-3" aria-label="Lista de acordos">
            {acordos.map((acordo) => (
              <AcordoCard key={acordo.id} acordo={acordo} />
            ))}
          </section>
        )}
      </main>

      {/* ── FAB — Pedir Nova Boleia ── */}
      <div className="fixed bottom-6 right-4 z-40">
        <button
          onClick={handleAbrirModal}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white font-bold py-3.5 px-5 rounded-full transition-all shadow-xl shadow-emerald-500/35"
          aria-label="Pedir Boleia"
        >
          <Plus size={20} />
          <span className="text-sm">Pedir Boleia</span>
        </button>
      </div>

      {/* ── Modal ── */}
      {modalAberto && (
        <ModalPedirBoleia
          onConfirmar={handleConfirmarBoleia}
          onFechar={handleFecharModal}
        />
      )}
    </div>
  );
};

export default AgreementsPage;
