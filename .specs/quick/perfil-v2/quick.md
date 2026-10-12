# Perfil v2 (Figma 262:1029 · P1–P12)

## Objetivo
Refazer `/perfil` alinhado aos frames P1–P12 (claro/escuro), copy aprovada, shadcn Card/Input/Button/Switch.

## Requisitos
- Dados pessoais: leitura + «Editar»; telefone +244; email read-only; guardar/sucesso/erro/descartar.
- Motorista: tipo «Motorista», link Dados bancários; linha «Recebimentos» visível desactivada (`aria-disabled`, sem navegação; ecrã = UX 5/6); sem veículo no perfil.
- Passageiro: «Passageiro»; sem banco/recebimentos.
- App no telemóvel: Instalar / iPhone Safari / ocultar se standalone.
- Notificações: Switch shadcn; bloqueado opacity-50 + linha única.
- Terminar sessão sem confirmação; padding inferior para BottomBar.
- IBAN: titular + AO06 via util partilhada; sub-rota `/perfil/dados-bancarios`.

## Verificação
- Vitest Profile + bank + push blocked copy.
- Capturas 320/390/430 light/dark mot+pax (12).
