import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';

describe('MainLayout Component', () => {
  it('renders a Bottom Navigation with Procurar, Viagens and Perfil links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<div>Página Filha</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /procurar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /viagens/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
    
    expect(screen.getByText('Página Filha')).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    
    links.forEach(link => {
      expect(link.querySelector('svg')).toBeInTheDocument();
    });
  });
});
