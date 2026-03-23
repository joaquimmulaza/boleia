import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestSeat, approveAgreement, rejectAgreement } from './AgreementsService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('AgreementsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestSeat insere um registo na tabela acordos com o estado Pendente', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 1, estado: 'Pendente' }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    supabase.from.mockReturnValue({ insert: mockInsert });

    const result = await requestSeat('route-1', 'passenger-1');

    expect(supabase.from).toHaveBeenCalledWith('acordos');
    expect(mockInsert).toHaveBeenCalledWith([
      { route_id: 'route-1', passenger_id: 'passenger-1', estado: 'Pendente' }
    ]);
    expect(result.estado).toEqual('Pendente');
  });

  it('approveAgreement altera o estado do acordo para Ativo e diminui available_seats em 1', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    
    const mockSingleSelect = vi.fn().mockResolvedValue({ data: { route_id: 'route-1' }, error: null });
    const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingleSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect, select: vi.fn().mockReturnThis() });
    
    const mockSingleRouteSelect = vi.fn().mockResolvedValue({ data: { available_seats: 4 }, error: null });
    const mockEqRouteSelect = vi.fn().mockReturnValue({ single: mockSingleRouteSelect });
    const mockRouteSelect = vi.fn().mockReturnValue({ eq: mockEqRouteSelect, select: vi.fn().mockReturnThis() });

    supabase.from.mockImplementation((table) => {
      if (table === 'acordos') {
        return {
          update: mockUpdate,
          select: mockSelect
        };
      }
      if (table === 'routes') {
        return {
          select: mockRouteSelect,
          update: mockUpdate
        };
      }
      return {};
    });

    await approveAgreement('agreement-1');

    expect(supabase.from).toHaveBeenCalledWith('acordos');
    expect(mockUpdate).toHaveBeenCalledWith({ estado: 'Ativo' });
    expect(mockEq).toHaveBeenCalledWith('id', 'agreement-1');
    
    expect(supabase.from).toHaveBeenCalledWith('routes');
    expect(mockUpdate).toHaveBeenCalledWith({ available_seats: 3 });
    expect(mockEq).toHaveBeenCalledWith('id', 'route-1');
  });

  it('rejectAgreement altera o estado para Cancelado', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    
    supabase.from.mockReturnValue({ update: mockUpdate });

    await rejectAgreement('agreement-1');

    expect(supabase.from).toHaveBeenCalledWith('acordos');
    expect(mockUpdate).toHaveBeenCalledWith({ estado: 'Cancelado' });
    expect(mockEq).toHaveBeenCalledWith('id', 'agreement-1');
  });
});
