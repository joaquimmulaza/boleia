import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('build produção exclui rotas DEV de captura', () => {
  it('dist não referencia __dev/acordos-chips nem DevAcordosChipCapture', () => {
    execSync('npm run build', { cwd: path.resolve(import.meta.dirname, '../..'), stdio: 'pipe' });
    const distDir = path.resolve(import.meta.dirname, '../../dist');
    const files = fs.readdirSync(distDir, { recursive: true });
    const entryFiles = files.filter((f) => /^assets\/index-.*\.js$/.test(String(f)));
    let entryBundle = '';
    for (const file of entryFiles) {
      entryBundle += fs.readFileSync(path.join(distDir, String(file)), 'utf8');
    }
    expect(entryBundle).not.toMatch(/__dev\/acordos-chips/);
    expect(entryBundle).not.toMatch(/DevAcordosChipCapture/);
  }, 120_000);
});
