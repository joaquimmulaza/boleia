import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Diretório de saída para capturas (repo-local por defeito).
 * @param {string[]} [argv]
 * @returns {string}
 */
export function resolveCaptureOutDir(argv = process.argv) {
  const flag = argv.find((arg) => arg.startsWith('--out='));
  if (flag) {
    const custom = flag.slice('--out='.length);
    return path.isAbsolute(custom) ? custom : path.resolve(ROOT, custom);
  }
  if (process.env.CAPTURE_OUT_DIR) {
    const envPath = process.env.CAPTURE_OUT_DIR;
    return path.isAbsolute(envPath) ? envPath : path.resolve(ROOT, envPath);
  }
  return path.join(ROOT, 'artifacts');
}

/**
 * @param {string} outDir
 */
export function ensureCaptureOutDir(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
}
