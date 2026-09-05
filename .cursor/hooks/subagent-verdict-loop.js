#!/usr/bin/env node
/**
 * subagentStop hook: if subagent output has VERDICT: REJECT and loop not exhausted,
 * ask the parent agent to resume the NEXT role with ISSUES.
 */
import { readFileSync } from 'node:fs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

const raw = readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

const text = [
  payload.status,
  payload.summary,
  payload.result,
  payload.message,
  payload.agentMessage,
  payload.output,
  typeof payload === 'object' ? JSON.stringify(payload) : '',
]
  .filter(Boolean)
  .join('\n');

const reject = /VERDICT:\s*REJECT/i.test(text);
const approve = /VERDICT:\s*APPROVE/i.test(text);

if (!reject || approve) {
  process.stdout.write('{}\n');
  process.exit(0);
}

const nextMatch = text.match(/NEXT:\s*(.+)/i);
const nextHint = nextMatch ? nextMatch[1].trim().slice(0, 400) : 'Corrige as ISSUES e reenvia ao papel indicado.';

const issuesBlock = (() => {
  const m = text.match(/ISSUES:\s*([\s\S]*?)(?=\nNEXT:|\nVERDICT:|$)/i);
  return m ? m[1].trim().slice(0, 1200) : '(ver output do subagente)';
})();

const followup = [
  'Loop multi-agente: o subagente devolveu VERDICT: REJECT.',
  `ISSUES:\n${issuesBlock}`,
  `NEXT: ${nextHint}`,
  'Retoma o papel correcto (ui-designer ou implementer), aplica as correcções, e volta a pedir review com VERDICT.',
  'Não excedas 2 ciclos; se já esgotaste, escala ao utilizador. Não faças commit.',
].join('\n');

process.stdout.write(
  JSON.stringify({
    followup_message: followup,
  }),
);
process.stdout.write('\n');
process.exit(0);
