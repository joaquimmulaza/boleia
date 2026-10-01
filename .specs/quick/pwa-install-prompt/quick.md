# PWA Install Prompt — Quick Spec

## Objetivo

Permitir ao utilizador adicionar a Boleia Certa ao ecrã inicial (PWA) com botão nativo onde o browser suporta `beforeinstallprompt`, e fallback guiado para iOS/Safari e browsers sem API.

## Touchpoints

1. **Perfil** — secção persistente «App no telemóvel» (`InstallAppCard`)
2. **Bottom sheet** — 1x após onboarding de permissões (`InstallAppPrompt`)
3. **Modal** — passos Safari / manual (`InstallAppInstructionsModal`)

## Estados UI

| Estado | Comportamento |
| ------ | ------------- |
| `standalone` | Card «App no ecrã»; sem bottom sheet |
| `native` | Botão «Adicionar ao ecrã» → `beforeinstallprompt` |
| `ios` | Botão «Ver como adicionar» → modal 3 passos |
| `manual` | Instruções genéricas / in-app browser |
| `dismissed` | Bottom sheet não reaparece (`pwa-install-dismissed-v1`) |

## Copy (PT-PT)

- Título: App no telemóvel
- Subtítulo: Acede mais rápido aos acordos, propostas e alertas — mesmo com internet instável.
- CTA nativo: Adicionar ao ecrã
- CTA iOS: Ver como adicionar
- Bottom sheet: Tens a app no ecrã?
- Secundário: Agora não

## Aceitação

- [ ] Android Chrome: botão dispara diálogo nativo
- [ ] iOS Safari: modal com passos Partilhar → Adicionar ao ecrã inicial
- [ ] Standalone: CTAs de instalação ocultos
- [ ] Bottom sheet só após onboarding; dismiss persiste
- [ ] Perfil mantém secção acessível (excepto standalone)
- [ ] Testes Vitest verdes

## Fora de scope

- Landing pública, Play/App Store, banners pós-acordo (fase 2)
