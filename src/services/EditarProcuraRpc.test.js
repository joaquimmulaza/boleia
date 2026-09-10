import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(
  join(ROOT, '../../supabase/migrations/20260908225833_editar_procura_update_cancel_rpc.sql'),
  'utf8',
);

describe('RPC editar/cancelar procura — contrato SQL', () => {
  it('update_procura não escreve return_time nem n_candidato', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.update_procura/);
    expect(SQL).not.toMatch(/n_candidato\s*=/);
    expect(SQL).not.toMatch(/return_time\s*=/);
  });

  it('invalida só estado da proposta aberta incompatível', () => {
    expect(SQL).toMatch(/SET estado = 'invalidada'/);
    expect(SQL).toMatch(/proposal_invalidated/);
    expect(SQL).not.toMatch(/valor_mensal_ask_kz\s*=/);
    expect(SQL).not.toMatch(/n_passageiros_propostos\s*=/);
  });

  it('cancel_procura cancela procura, propostas abertas e waitlist', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.cancel_procura/);
    expect(SQL).toMatch(/estado = 'cancelada'/);
    expect(SQL).toMatch(/proposal_cancelled/);
  });

  it('gate recusa fechada e acordo activo', () => {
    expect(SQL).toMatch(/Não é possível editar esta procura/);
    expect(SQL).toMatch(/cancelamento_pendente/);
  });

  it('matching SQL ignora teto e flex ignora OD', () => {
    expect(SQL).toMatch(/oferta_compativel_com_procura/);
    expect(SQL).not.toMatch(/teto_mensal_kz.*>/);
    expect(SQL).toMatch(/flexibilidade_rota/);
  });

  it('helpers internos não têm EXECUTE para PUBLIC, anon nem authenticated', () => {
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\._notify_proposta_driver_evento\(public\.propostas, text, text\) FROM PUBLIC/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\._notify_proposta_driver_evento\(public\.propostas, text, text\) FROM authenticated/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\._assert_procura_editavel\(public\.procuras, uuid\) FROM authenticated/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.oferta_compativel_com_procura\(public\.ofertas_capacidade, public\.procuras\) FROM authenticated/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\._haversine_meters\(double precision, double precision, double precision, double precision\) FROM authenticated/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.update_procura\([\s\S]*?\) FROM anon/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.cancel_procura\(uuid\) FROM anon/,
    );
    expect(SQL).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\._notify_proposta_driver_evento/,
    );
    expect(SQL).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\._assert_procura_editavel/,
    );
    expect(SQL).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.oferta_compativel_com_procura/,
    );
    expect(SQL).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\._haversine_meters/,
    );
  });
});
