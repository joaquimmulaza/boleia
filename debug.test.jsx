import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PublishRoute from './src/pages/PublishRoute';

describe('Debug PublishRoute', () => {
  it('prints dom', () => {
    render(<MemoryRouter><PublishRoute /></MemoryRouter>);
    console.log("LABELS:");
    document.querySelectorAll('label').forEach(l => {
        console.log("LABEL TEXT:", l.textContent);
        console.log("LABEL HTMLFOR:", l.htmlFor);
    });
    console.log("INPUTS:");
    document.querySelectorAll('input').forEach(i => {
        console.log("INPUT ID:", i.id);
        console.log("INPUT NAME:", i.name);
    });
    // Let's print out what getByLabelText('Ida', { exact: false }) finds:
    try {
        const els = screen.getAllByLabelText(/Ida/i);
        console.log("FOUND FOR /Ida/i:", els.length, els.map(e => e.id));
    } catch(e) {
        console.log("ERROR /Ida/i:", e.message);
    }
  });
});
