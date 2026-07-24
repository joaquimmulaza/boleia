Como o teu Engenheiro de Testes Sénior, preparei o terreno seguindo estritamente a nossa metodologia de "TDD Red Phase".

O que foi feito:

Criei um componente dummy em src/components/UpdatePrompt.jsx para garantir que o teste consegue importar a referência.
Criei a suíte de testes em src/components/UpdatePrompt.test.jsx, onde fizemos um mock da função useRegisterSW proveniente de virtual:pwa-register/react (do plugin do Vite PWA).
Implementei testes focados nas interações, nos botões do ecrã com Material Design 3 e nas lógicas do Service Worker.
Corri o Vitest para comprovar que a suíte funciona e falha intencionalmente nos locais esperados (fase RED).
Aqui está o código da suite de testes (src/components/UpdatePrompt.test.jsx):

jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdatePrompt from './UpdatePrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';
import React from 'react';
// Mock the virtual module
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));
describe('UpdatePrompt Component (PWA)', () => {
  let updateServiceWorkerMock;
  let setNeedRefreshMock;
  beforeEach(() => {
    vi.clearAllMocks();
    updateServiceWorkerMock = vi.fn();
    setNeedRefreshMock = vi.fn();
    
    // Default mock setup
    useRegisterSW.mockReturnValue({
      needRefresh: [false, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });
  });
  it('Estado 1: não deve renderizar o prompt se needRefresh for false', () => {
    render(<UpdatePrompt />);
    
    expect(screen.queryByText(/Atualização disponível/i)).not.toBeInTheDocument();
  });
  it('Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });
    render(<UpdatePrompt />);
    
    expect(screen.getByText(/Atualização disponível/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar agora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mais tarde/i })).toBeInTheDocument();
  });
  it('Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora"', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });
    render(<UpdatePrompt />);
    
    const updateButton = screen.getByRole('button', { name: /Atualizar agora/i });
    fireEvent.click(updateButton);
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });
  it('Interação: deve fechar localmente sem disparar a atualização ao clicar em "Mais tarde"', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateServiceWorkerMock,
    });
    render(<UpdatePrompt />);
    
    const laterButton = screen.getByRole('button', { name: /Mais tarde/i });
    fireEvent.click(laterButton);
    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });
});
Aqui está a prova da execução (Vitest Log) a falhar a vermelho nos cenários principais:

text
RUN  v4.1.1 C:/boleia-certa
 ❯ src/components/UpdatePrompt.test.jsx (4 tests | 3 failed) 112ms
     ✓ Estado 1: não deve renderizar o prompt se needRefresh for false 42ms
     × Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true 40ms
     × Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora" 11ms
     × Interação: deve fechar localmente sem disparar a atualização ao clicar em "Mais tarde" 12ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/UpdatePrompt.test.jsx > UpdatePrompt Component (PWA) > Estado 2: deve renderizar o prompt com as mensagens e botões se needRefresh for true
TestingLibraryElementError: Unable to find an element with the text: /Atualização disponível/i.
 FAIL  src/components/UpdatePrompt.test.jsx > UpdatePrompt Component (PWA) > Interação: deve chamar updateServiceWorker(true) ao clicar em "Atualizar agora"
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/Atualizar agora/i`
 FAIL  src/components/UpdatePrompt.test.jsx > UpdatePrompt Component (PWA) > Interação: deve fechar localmente sem disparar a atualização ao clicar em "Mais tarde"
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/Mais tarde/i`
Gerei também o ficheiro update_prompt_tdd_plan.md no sistema de artifacts que contém as diretrizes prontas para o agente implementador executar a fase verde, o qual podes consultar aqui: 
update_prompt_tdd_plan.md
.

Estamos prontos para acionar o próximo agente e virar isto para verde!