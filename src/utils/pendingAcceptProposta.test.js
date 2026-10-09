import { describe, expect, it } from 'vitest';
import {
  collectPendingAcceptPropostaIds,
  COPY_ERRO_ACEITE_GENERICO,
  COPY_ERRO_ACEITE_OFERTA_MUDOU,
  isErroAceiteOfertaInvalida,
  mensagemErroAceiteInbox,
} from './pendingAcceptProposta';

describe('pendingAcceptProposta', () => {
  it('collectPendingAcceptPropostaIds ignora outras RPCs', () => {
    const ids = collectPendingAcceptPropostaIds([
      { rpc: 'leave_passenger', args: { p_acordo_id: 'a1' } },
      { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-1' } },
    ]);
    expect([...ids]).toEqual(['prop-1']);
  });

  it('isErroAceiteOfertaInvalida detecta mensagens RPC de oferta inválida', () => {
    expect(isErroAceiteOfertaInvalida(new Error('Sem vagas'))).toBe(true);
    expect(isErroAceiteOfertaInvalida(new Error('Proposta não está aberta.'))).toBe(true);
    expect(isErroAceiteOfertaInvalida(new Error('Só a contraparte pode aceitar'))).toBe(false);
    expect(isErroAceiteOfertaInvalida(new Error('Timeout interno'))).toBe(false);
  });

  it('mensagemErroAceiteInbox mapeia oferta inválida vs genérico', () => {
    expect(mensagemErroAceiteInbox(new Error('Proposta já não está aberta'))).toBe(
      COPY_ERRO_ACEITE_OFERTA_MUDOU,
    );
    expect(mensagemErroAceiteInbox(new Error('Erro inesperado'))).toBe(COPY_ERRO_ACEITE_GENERICO);
    expect(mensagemErroAceiteInbox(new Error('Sessão necessária para guardar'))).toContain(
      'Sessão necessária',
    );
  });
});
