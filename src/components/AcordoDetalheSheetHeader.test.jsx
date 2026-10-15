import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AcordoDetalheSheetHeader from './AcordoDetalheSheetHeader';
import { CHIP_LUGAR_SAiu_JUSTA_CAUSA } from '../constants/acordoFollowup278Copy.js';

vi.mock('./AcordoDetalheKebabMenu', () => ({
  default: () => <div data-testid="kebab-mock" />,
}));

describe('AcordoDetalheSheetHeader — chips sticky', () => {
  it('chip justa causa não usa truncate e partilha flex-wrap com o título', () => {
    render(
      <AcordoDetalheSheetHeader
        acordoId="acordo-jc"
        estadoAcordo="activo"
        acordosPassageiros={[
          { passenger_id: 'pax-jc', estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
        ]}
        nPassageirosContrato={2}
        tipoPerfil="Passageiro"
        viewerUserId="pax-jc"
        minhaLinha={{
          passenger_id: 'pax-jc',
          estado: 'saiu',
          lugar_rescisao_modo: 'justa_causa',
        }}
        onClose={() => {}}
        podeRegistarFaltas={false}
        podeEncerrar={false}
        onRegistarFalta={() => {}}
        onEncerrar={() => {}}
        titulo="Detalhe do acordo"
      />,
    );

    const wrap = screen.getByTestId('acordo-detalhe-titulo-chips');
    expect(wrap.className).toMatch(/flex-wrap/);

    const lugarChip = screen.getByTestId('acordo-lugar-saiu-chip-acordo-jc');
    expect(lugarChip).toHaveTextContent(CHIP_LUGAR_SAiu_JUSTA_CAUSA);
    expect(lugarChip.className).toMatch(/whitespace-nowrap/);
    expect(lugarChip.className).not.toMatch(/truncate/);

    expect(screen.getByTestId('acordo-detalhe-fechar')).toBeInTheDocument();
  });
});
