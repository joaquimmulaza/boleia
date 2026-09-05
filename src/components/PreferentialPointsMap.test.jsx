import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PreferentialPointsMap from './PreferentialPointsMap';

const mapRemove = vi.fn();
const mapFitBounds = vi.fn();
const mapSetCenter = vi.fn();
const mapSetZoom = vi.fn();
const markerAddTo = vi.fn().mockReturnThis();
const markerSetLngLat = vi.fn().mockReturnThis();
const markerRemove = vi.fn();

const MapMock = vi.fn(function MapMock() {
  this.remove = mapRemove;
  this.fitBounds = mapFitBounds;
  this.setCenter = mapSetCenter;
  this.setZoom = mapSetZoom;
  this.on = vi.fn();
});

const MarkerMock = vi.fn(function MarkerMock() {
  this.setLngLat = markerSetLngLat;
  this.addTo = markerAddTo;
  this.remove = markerRemove;
});

const LngLatBoundsMock = vi.fn(function LngLatBoundsMock() {
  this.extend = vi.fn().mockReturnThis();
});

vi.mock('maplibre-gl', () => ({
  default: {
    Map: MapMock,
    Marker: MarkerMock,
    LngLatBounds: LngLatBoundsMock,
  },
  Map: MapMock,
  Marker: MarkerMock,
  LngLatBounds: LngLatBoundsMock,
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

const samplePoints = [
  {
    id: 'p1-recolha',
    label: 'Ana — Talatona',
    kind: 'recolha',
    lat: -8.917,
    lng: 13.188,
    memberIndex: 1,
  },
  {
    id: 'p1-desembarque',
    label: 'Ana — Miramar',
    kind: 'desembarque',
    lat: -8.812,
    lng: 13.234,
    memberIndex: 1,
  },
];

describe('PreferentialPointsMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markerSetLngLat.mockReturnThis();
    markerAddTo.mockReturnThis();
  });

  it('mostra skeleton acessível quando loading é true', () => {
    render(<PreferentialPointsMap points={samplePoints} loading />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass('h-[190px]');
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('mostra mensagem vazia sem inicializar o mapa', () => {
    render(<PreferentialPointsMap points={[]} />);

    expect(
      screen.getByText('Pontos de recolha sem localização no mapa')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Mapa dos pontos preferenciais')).not.toBeInTheDocument();
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('com pontos mostra região com aria-label e chama o construtor Map', async () => {
    render(<PreferentialPointsMap points={samplePoints} />);

    expect(screen.getByLabelText('Mapa dos pontos preferenciais')).toBeInTheDocument();

    await waitFor(() => {
      expect(MapMock).toHaveBeenCalled();
    });

    expect(MarkerMock).toHaveBeenCalled();
  });

  it('com um único ponto centra e aplica zoom ~14', async () => {
    render(<PreferentialPointsMap points={[samplePoints[0]]} />);

    await waitFor(() => {
      expect(MapMock).toHaveBeenCalled();
    });

    expect(mapSetCenter).toHaveBeenCalledWith([samplePoints[0].lng, samplePoints[0].lat]);
    expect(mapSetZoom).toHaveBeenCalledWith(14);
  });

  it('cria marcadores com índice 1-based no título', async () => {
    render(<PreferentialPointsMap points={samplePoints} />);

    await waitFor(() => {
      expect(MarkerMock).toHaveBeenCalled();
    });

    const firstOpts = MarkerMock.mock.calls[0][0];
    expect(firstOpts.element.title).toMatch(/^1 · /);
    expect(firstOpts.element.textContent).toBe('1');
  });

  it('mostra erro PT-PT quando o MapLibre falha ao iniciar', async () => {
    MapMock.mockImplementationOnce(function MapFail() {
      throw new Error('tiles offline');
    });

    render(<PreferentialPointsMap points={samplePoints} />);

    await waitFor(() => {
      expect(
        screen.getByText('Não foi possível carregar o mapa.'),
      ).toBeInTheDocument();
    });
  });

  it('não reinicializa o mapa se os pontos forem semanticamente iguais', async () => {
    const { rerender } = render(<PreferentialPointsMap points={samplePoints} />);

    await waitFor(() => {
      expect(MapMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <PreferentialPointsMap
        points={[
          { ...samplePoints[0] },
          { ...samplePoints[1] },
        ]}
      />,
    );

    await waitFor(() => {
      expect(MapMock).toHaveBeenCalledTimes(1);
    });
  });
});
