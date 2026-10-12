import { describe, it, expect } from 'vitest';
import {
  labelEstadoAcordo,
  labelChipListaEstadoAcordo,
  variantChipListaEstadoAcordo,
  variantChipEstadoAcordo,
  chipClassEstadoAcordoVariant,
  isAcordoEncerradoSemLugaresVivos,
  isChipEncerramentoPedidoConsensual,
  rescisaoPermiteEncerramentoMotivoSemLugares,
  rescisaoBloqueiaLabelEncerrado,
} from './acordoEstadoDisplay';

/** Fixture tipo cd4a92aa (prod QA #257). */
const ACORDO_CD4A92AA = {
  estado: 'cancelado',
  encerramento_motivo: 'sem_lugares_vivos',
  rescisao_modo: 'consensual',
  rescisao_confirmada_em: null,
  rescisao_solicitada_por: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
};

describe('rescisaoPermiteEncerramentoMotivoSemLugares', () => {
  it('alinhado ao SQL leave_passenger (NULL ou consensual pendente)', () => {
    expect(rescisaoPermiteEncerramentoMotivoSemLugares(null, null)).toBe(true);
    expect(rescisaoPermiteEncerramentoMotivoSemLugares(undefined, null)).toBe(true);
    expect(rescisaoPermiteEncerramentoMotivoSemLugares('consensual', null)).toBe(true);
    expect(rescisaoPermiteEncerramentoMotivoSemLugares('consensual', '2026-10-01')).toBe(false);
    expect(rescisaoPermiteEncerramentoMotivoSemLugares('justa_causa', null)).toBe(false);
    expect(rescisaoBloqueiaLabelEncerrado('justa_causa', null)).toBe(true);
    expect(rescisaoBloqueiaLabelEncerrado('consensual', '2026-10-01')).toBe(true);
  });
});

describe('labelEstadoAcordo', () => {
  it('mapeia enums conhecidos para copy humana', () => {
    expect(labelEstadoAcordo('activo')).toBe('Activo');
    expect(labelEstadoAcordo('cancelamento_pendente')).toBe('Cancelamento pendente');
    expect(labelEstadoAcordo('cancelado')).toBe('Cancelado');
    expect(labelEstadoAcordo('cancelado_justificado')).toBe('Cancelado por justa causa');
    expect(labelEstadoAcordo('suspenso')).toBe('Suspenso');
  });

  it('cancelado com encerramento_motivo sem_lugares_vivos mostra Encerrado', () => {
    expect(
      labelEstadoAcordo('cancelado', 'sem_lugares_vivos'),
    ).toBe('Encerrado');
    expect(
      labelEstadoAcordo({ estado: 'cancelado', encerramento_motivo: 'sem_lugares_vivos' }),
    ).toBe('Encerrado');
  });

  it('cancelado real (rescisão confirmada ou justa causa) mantém Cancelado', () => {
    expect(labelEstadoAcordo('cancelado', null)).toBe('Cancelado');
    expect(labelEstadoAcordo('cancelado', undefined)).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: '2026-10-01T12:00:00Z',
      }),
    ).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
        rescisao_modo: 'justa_causa',
      }),
    ).toBe('Cancelado');
  });

  it('cd4a92aa: consensual não confirmado + sem_lugares_vivos → Encerrado (não Encerramento pedido)', () => {
    expect(labelEstadoAcordo(ACORDO_CD4A92AA)).toBe('Encerrado');
    expect(labelEstadoAcordo(ACORDO_CD4A92AA)).not.toBe('Encerramento pedido');
    expect(isAcordoEncerradoSemLugaresVivos(ACORDO_CD4A92AA)).toBe(true);
    expect(isChipEncerramentoPedidoConsensual(ACORDO_CD4A92AA)).toBe(false);
    expect(variantChipEstadoAcordo(ACORDO_CD4A92AA)).toBe('encerrado');
  });

  it('activo com pedido consensual aberto mostra Encerramento pedido', () => {
    const acordo = {
      estado: 'activo',
      rescisao_modo: 'consensual',
      rescisao_confirmada_em: null,
      rescisao_solicitada_por: 'driver-1',
    };
    expect(labelEstadoAcordo(acordo)).toBe('Encerramento pedido');
    expect(variantChipEstadoAcordo(acordo)).toBe('pendente');
  });

  it('cancelado com consensual pendente mas sem sem_lugares_vivos mantém Cancelado', () => {
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: null,
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: null,
        rescisao_solicitada_por: 'driver-1',
      }),
    ).toBe('Cancelado');
    expect(
      labelEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: null,
        rescisao_modo: 'consensual',
        rescisao_confirmada_em: null,
        rescisao_solicitada_por: 'driver-1',
      }),
    ).not.toBe('Encerramento pedido');
  });

  it('não devolve snake_case cru', () => {
    expect(labelEstadoAcordo('cancelamento_pendente')).not.toMatch(/_/);
  });

  it('estado desconhecido (objecto ou string) não rebenta e capitaliza e', () => {
    expect(labelEstadoAcordo({ estado: 'em_revisao_ops' })).toBe('Em revisao ops');
    expect(labelEstadoAcordo('em_revisao_ops')).toBe('Em revisao ops');
    expect(labelEstadoAcordo(null)).toBe('—');
    expect(labelEstadoAcordo({ estado: null })).toBe('—');
  });
});

describe('labelChipListaEstadoAcordo', () => {
  const pedidoConsensual = {
    estado: 'activo',
    rescisao_modo: 'consensual',
    rescisao_confirmada_em: null,
    rescisao_solicitada_por: 'driver-1',
  };

  it('requerente vê Encerramento pedido', () => {
    expect(labelChipListaEstadoAcordo(pedidoConsensual, 'driver-1')).toBe('Encerramento pedido');
  });

  it('contraparte vê Falta a tua confirmação', () => {
    expect(labelChipListaEstadoAcordo(pedidoConsensual, 'pax-1')).toBe('Falta a tua confirmação');
  });

  it('contraparte usa variante aviso (warning)', () => {
    expect(variantChipListaEstadoAcordo(pedidoConsensual, 'pax-1')).toBe('aviso');
    expect(variantChipListaEstadoAcordo(pedidoConsensual, 'driver-1')).toBe('pendente');
  });

  it('cancelamento_pendente mostra Termina a {data}', () => {
    const acordo = {
      estado: 'cancelamento_pendente',
      rescisao_effective_on: '2026-11-01',
    };
    expect(labelChipListaEstadoAcordo(acordo, 'user-1')).toMatch(/^Termina a 31 de outubro de 2026$/);
    expect(variantChipListaEstadoAcordo(acordo, 'user-1')).toBe('pendente');
  });
});

describe('variantChipEstadoAcordo', () => {
  it('cancelamento_pendente usa variante pendente', () => {
    expect(variantChipEstadoAcordo('cancelamento_pendente')).toBe('pendente');
  });

  it('encerrado distingue de cancelado inactivo', () => {
    expect(
      variantChipEstadoAcordo({
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
      }),
    ).toBe('encerrado');
    expect(variantChipEstadoAcordo('cancelado')).toBe('inactivo');
    expect(chipClassEstadoAcordoVariant('encerrado')).not.toBe(
      chipClassEstadoAcordoVariant('inactivo'),
    );
  });
});
