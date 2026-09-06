# Boleia Certa — Visão e Fluxo de Produto
## Documento de referência do modelo Oferta ↔ Procura

> **Objetivo deste documento:** estabelecer a visão funcional e as regras centrais do marketplace do Boleia Certa para que produto, UX, frontend, backend, matching e agentes de IA implementem o mesmo comportamento.  
> **Princípio:** este documento define o comportamento desejado do produto; não deve ser reinterpretado de forma que a implementação técnica altere a lógica de negócio.

---

# 1. Visão do Produto

O Boleia Certa é um marketplace que conecta **oferta de capacidade de transporte** com **procura de transporte**.

O produto não deve ser entendido como um simples sistema de:

> 1 motorista ↔ 1 passageiro.

O modelo central é:

> **Oferta de capacidade ↔ Procura individual/coletiva ↔ Múltiplas propostas ↔ Acordo 1:N**

O objetivo é permitir que passageiros e motoristas encontrem-se através das suas necessidades reais, negociem condições e formem acordos de transporte com múltiplos passageiros.

O marketplace deve funcionar nos dois sentidos:

- o passageiro/grupo pode procurar motoristas;
- o motorista pode procurar passageiros/grupos;
- ambos podem iniciar uma proposta;
- apenas a contraparte pode aceitar ou rejeitar a proposta.

---

# 2. Tipos de utilizador e comportamento

## 2.1 Passageiro

O passageiro pode:

- criar uma procura individual;
- entrar num grupo;
- criar um grupo;
- procurar ofertas de motoristas;
- encontrar ofertas fixas;
- encontrar ofertas flexíveis;
- enviar propostas a motoristas;
- receber propostas de motoristas;
- aceitar ou rejeitar propostas recebidas;
- sair de um acordo conforme as regras do produto.

O passageiro não deve depender de contacto telefónico para entrar, negociar ou formar um acordo.

WhatsApp pode existir como mecanismo auxiliar de partilha e convite para criar ou entrar no grupo dentro do produto

---

## 2.2 Grupo de passageiros

Um grupo representa uma **procura coletiva viva**.

O grupo não precisa estar completo para começar a negociar.

Exemplo:

> Grupo desejado: 4 passageiros  
> Membros atuais: 2

O grupo continua válido, visível e negociável.

Um grupo com 2/4 membros pode receber uma proposta para os 2 passageiros atuais.

Se um terceiro passageiro entrar posteriormente:

> N_actual = 3

as propostas antigas **não devem ser alteradas automaticamente**.

Se existir interesse em negociar as novas condições para 3 passageiros, deve ser criada uma nova proposta/versão com:

> N_proposto = 3

O crescimento do grupo nunca deve reescrever silenciosamente um snapshot já criado.

---

# 3. Formação de grupos

Um grupo pode ser descoberto dentro da plataforma segundo as regras de visibilidade definidas pelo produto.

Um passageiro interessado pode solicitar entrada no grupo.

Fluxo:

> Encontrar grupo → Solicitar entrada → Owner/organizador aceita ou rejeita → membro torna-se ativo

O solicitante não deve conseguir aprovar a própria entrada.

A participação através da plataforma é o fluxo principal.

Partilha por link/WhatsApp pode facilitar a descoberta, mas a entrada deve continuar a ser processada pela plataforma.

---

# 4. Motoristas

Existem dois comportamentos principais de oferta.

## 4.1 Oferta fixa

É a oferta em que o motorista conhece antecipadamente a sua rota.

Exemplo:

> Kilamba → Talatona  
> 07:00  
> Segunda a sexta  
> 4 lugares

Neste caso, origem e destino fazem parte da oferta e podem ser usados pelo matching geográfico.

### Regras

- origem obrigatória;
- destino obrigatório;
- coordenadas válidas;
- horário;
- dias;
- capacidade;
- modalidade/preço.

---

# 5. Motorista flexível

## 5.1 Conceito

Um motorista flexível **não está preso a uma rota fixa previamente publicada**.

Ele pode indicar:

- capacidade;
- disponibilidade;
- dias;
- janela de horário;
- modalidade de preço;
- informação de que aceita trabalhar de forma flexível.

### Origem e destino NÃO são obrigatórios.

O motorista não precisa dizer previamente:

> Viana → Talatona

para existir no marketplace.

---

## 5.2 Residência do motorista

A residência/localização do motorista **não define a sua área de atuação**.

Exemplo:

> Motorista mora em Viana.

Isso não significa:

> “Só pode receber passageiros em Viana.”

Ele pode decidir aceitar uma procura em:

- Viana;
- Kilamba;
- Talatona;
- Benfica;
- Luanda;
- ou outra zona.

A plataforma não deve bloquear a procura apenas porque o motorista vive longe.

### Regra fundamental

> **A decisão de aceitar uma procura distante pertence ao motorista.**

O sistema pode ajudar o motorista a descobrir oportunidades compatíveis, mas não deve impor uma “zona residencial” como limite comercial.

---

# 6. Descoberta do motorista flexível

O motorista flexível deve ser descoberto por passageiros e grupos que tenham procuras compatíveis com a sua disponibilidade.

Exemplo:

### Procura

> Kilamba → Talatona  
> 07:00  
> 3 passageiros

### Oferta flexível

> Motorista X  
> Oferta flexível  
> 4 lugares  
> Disponível 06:30–08:30  
> Segunda a sexta

O passageiro deve poder visualizar a oferta e:

> **Enviar proposta**

Não deve ser necessário que o motorista tenha previamente criado uma rota fixa correspondente.

---

# 7. Descoberta de procura pelo motorista

O fluxo também funciona no sentido inverso.

O motorista flexível pode consultar procuras/grupos compatíveis.

Exemplo:

> Grupo: Kilamba → Talatona  
> 3 passageiros  
> 07:00  
> Segunda a sexta

O motorista pode decidir:

> “Consigo atender esta procura.”

E então:

> **Enviar proposta**

O sistema não assume que o motorista aceita apenas porque existe compatibilidade.

A compatibilidade gera uma oportunidade; a decisão final continua humana.

---

# 8. Matching

O matching deve facilitar a descoberta, não substituir a decisão do utilizador.

## 8.1 Oferta fixa

A compatibilidade considera, conforme as regras definidas:

- horário;
- dias;
- origem;
- destino;
- distância/raio configurado;
- capacidade.

## 8.2 Oferta flexível

A compatibilidade não depende de uma rota fixa do motorista.

Considera principalmente:

- horário;
- dias;
- capacidade;
- disponibilidade;
- características da procura que sejam aplicáveis ao matching flexível.

Não utilizar a residência do motorista como bloqueio.

Não exigir OD apenas porque a oferta é flexível.

---

# 9. Propostas

Uma procura/grupo pode receber várias propostas de diferentes motoristas.

Exemplo:

> Grupo com 3 passageiros  
> ↓  
> Motorista A → proposta  
> Motorista B → proposta  
> Motorista C → proposta

As propostas coexistem até que uma seja aceite ou seja cancelada/rejeitada conforme as regras do produto.

O modelo é:

> **1 procura → M propostas → 1 proposta aceite → 1 acordo**

Não:

> 1 procura → 1 motorista obrigatório

---

# 10. Propostas bidirecionais

O marketplace deve suportar dois sentidos.

## A. Passageiro/grupo inicia

> Passageiro/grupo → escolhe oferta → envia proposta → motorista aceita/rejeita

## B. Motorista inicia

> Motorista → encontra procura/grupo → envia proposta → passageiro/grupo aceita/rejeita

### Regra de contraparte

Quem cria a proposta é o:

> **iniciador**

Quem recebe a proposta é a:

> **contraparte**

Somente a contraparte pode aceitar ou rejeitar.

O criador nunca deve poder aceitar a própria proposta.

Esta regra deve ser protegida:

- na UI;
- no serviço;
- na RPC;
- no backend/RLS.

Não basta esconder o botão na interface.

---

# 11. Snapshot da proposta

Cada proposta deve congelar os dados relevantes no momento em que é criada.

Entre eles:

- oferta/procura;
- criador;
- contraparte;
- preço proposto;
- modalidade de preço;
- N_proposto;
- estado;
- demais campos necessários ao acordo.

Uma proposta existente não deve ser recalculada silenciosamente porque o grupo mudou posteriormente.

---

# 12. Os quatro N

O sistema deve distinguir explicitamente quatro quantidades.

## N_actual

Número atual de membros do grupo.

Pode mudar.

---

## N_proposto

Número de passageiros abrangidos por uma proposta específica.

É um snapshot da proposta.

Não deve mudar automaticamente.

---

## N_contrato

Número de passageiros congelado no momento em que a proposta é aceite e o acordo é criado.

É parte do contrato.

---

## N_activos

Número de passageiros atualmente ativos no acordo.

Pode diminuir quando passageiros saem.

Não deve reescrever N_contrato.

---

# 13. Preço

Existem duas modalidades.

## 13.1 POR_PASSAGEIRO

O valor informado é o valor mensal por passageiro.

Fórmula:

> valor individual = valor proposto

> valor total = valor individual × N_proposto

---

## 13.2 TOTAL_ACORDO

O valor informado é o total mensal do acordo.

Fórmula:

> valor total = valor proposto

> valor individual = valor total ÷ N_proposto

### Regra fundamental

Nunca usar:

- capacidade do veículo;
- N_activos;
- número total de lugares;
- número arbitrário de passageiros;

como divisor do preço.

O divisor correto no momento da proposta é:

> **N_proposto**

No acordo aceite, o valor congelado corresponde ao:

> **N_contrato**

---

# 14. Congelamento do preço

No momento da aceitação:

> preço + N_contrato + valor individual + valor total

ficam congelados no acordo conforme a regra do produto.

A saída posterior de um passageiro não deve recalcular retroativamente as quotas dos passageiros restantes.

---

# 15. Saída de passageiro

Exemplo:

> Acordo com 4 passageiros  
> Valor individual = 30.000 Kz

Um passageiro sai.

Resultado:

> N_activos = 3

Mas:

> os 3 passageiros restantes mantêm as suas quotas atuais.

Não recalcular o preço automaticamente.

A capacidade disponibilizada pelo veículo aumenta.

Se for necessário alterar preço ou composição no futuro, deve existir um processo explícito de renegociação/adenda.

---

# 16. Capacidade

A capacidade disponível deve obedecer à seguinte lógica:

> vagas_disponiveis = vagas_totais - passageiros ativos

Exemplo:

> veículo = 4 vagas  
> passageiros ativos = 3  
> vagas disponíveis = 1

A aceitação de uma proposta deve ser atómica.

Se:

> N_proposto > vagas disponíveis

não existe acordo parcial.

Resultado esperado:

> proposta não é aceite diretamente / entra no mecanismo de waitlist quando aplicável.

---

# 17. Waitlist

A waitlist é uma alternativa quando a capacidade disponível não é suficiente.

Exemplo:

> veículo = 4 vagas  
> 4 ocupadas  
> novo grupo = 2 passageiros

O sistema não deve aceitar 1 e rejeitar o outro.

Não deve haver acordo parcial.

A entrada em waitlist não cria automaticamente um acordo.

A promoção da waitlist deve seguir o fluxo definido pelo produto e não deve significar:

> “a plataforma aceitou automaticamente por mim”.

---

# 18. Crescimento do grupo depois da proposta

Este é um cenário crítico.

Exemplo:

> Grupo = 2/4  
> Motorista envia proposta  
> N_proposto = 2

Depois entra um novo membro.

Agora:

> N_actual = 3

A proposta continua:

> N_proposto = 2

O sistema não deve alterar essa proposta para 3 automaticamente.

Para negociar 3 passageiros:

> criar nova proposta/versão com N_proposto = 3

---

# 19. Grupo menor que a proposta

Exemplo:

> Proposta N_proposto = 3

Mas, antes do aceite:

> grupo agora possui apenas 2 membros elegíveis.

O sistema não deve criar silenciosamente um acordo diferente.

A proposta deve ser considerada inválida/inelegível para aquele N conforme a regra de aceite definida, exigindo nova proposta ou correção explícita.

---

# 20. Grupo maior que a proposta

Exemplo:

> Proposta N_proposto = 2

Grupo agora possui:

> N_actual = 4

O sistema deve deixar claro que a proposta contempla apenas os passageiros previstos no snapshot.

Nunca escolher silenciosamente passageiros arbitrários sem que a UI deixe explícita a composição coberta.

Se o objetivo passar a ser transportar 4:

> nova proposta N_proposto = 4

---

# 21. Acordo

Quando uma proposta válida é aceite:

> 1 motorista → 1 acordo → N passageiros

O acordo não deve ser modelado como vários acordos independentes, um por passageiro.

A estrutura lógica é:

### Acordo

Contém os dados principais do contrato.

### Passageiros do acordo

Contém N registos de passageiros associados ao mesmo acordo.

---

# 22. Renegociação

# Boleia Certa — Especificação de Arquitetura: Fluxo de Renegociação Bilateral & Resolução de Impasses

---

A renegociação de preços, quotas ou condições nunca deve ser unilateral, as alterações exigem o consentimento expresso da contraparte, nunca entram em vigor de forma retroativa, e devem respeitar estritamente a data definida pelo produto (a regra de vigência para o **"próximo mês"**). 

Este documento formaliza as regras para que o passageiro e o motorista tenham a liberdade de **propor, aceitar, recusar, contrapropor ou rescindir** o contrato de transporte diário de forma estruturada, justa e segura.

---

## 2. A Máquina de Estados de Renegociação (`acordos_adendas`)

Quando uma das partes (seja o motorista que deseja reajustar o preço devido ao aumento do combustível, ou o passageiro que deseja renegociar devido a uma alteração de frequência) inicia um pedido de reajuste, o sistema não altera o acordo ativo diretamente [19]. Em vez disso, cria um registo de adenda versionado na tabela `acordos_adendas`.

```
                     [ Início da Proposta ]
                                │
                                ▼
                       ( PROPOSTA_CRIADA )
                                │
                                ▼
                     ( PENDENTE_CONTRAPARTE )
                     ┌──────────┼──────────┐
                     │          │          │
                     ▼          ▼          ▼
                 [ ACEITAR ] [ REJEITAR ] [ CONTRAPROPOSTA ]
                     │          │          │
                     ▼          ▼          ▼
             ( ACEITE_AGENDADA ) ( REJEITADA ) ( CANCELADA_SUBSTITUÍDA )
                     │          │
        [ 1º Dia do Próximo Mês ] │
                     │          │
                     ▼          ▼
                 ( EM_VIGOR )   [ Mantém Acordo Antigo ]
```

### Estados do Ciclo de Vida da Adenda:

1.  **`PENDENTE_CONTRAPARTE`**: A adenda foi registada pelo iniciador. O acordo original mantém-se ativo sob as condições vigentes. A contraparte é notificada via Push Notification (PWA) e tem a oportunidade de tomar uma ação ativa na UI.
2.  **`REJEITADA`**: A contraparte recusa a alteração de preço ou quota. O acordo antigo mantém-se 100% em vigor sem qualquer modificação.
3.  **`CANCELADA_INICIADOR`**: O criador decide anular a proposta de renegociação antes de a contraparte responder.
4.  **`CANCELADA_SUBSTITUÍDA`**: Uma nova proposta é emitida pela mesma parte ou pela contraparte, invalidando e substituindo automaticamente a adenda anterior que estava pendente.
5.  **`ACEITE_AGENDADA`**: A contraparte consente com os novos termos. No entanto, para evitar quebras de planeamento financeiro a meio do mês de uso corrente, as novas regras **não entram em vigor de imediato nem de forma retroativa**. A adenda fica programada para entrar em vigor no dia 1 do mês subsequente.
6.  **`EM_VIGOR`**: No primeiro segundo do primeiro dia do mês seguinte, o estado da adenda transita para `EM_VIGOR`. O acordo original é mutado de forma atómica para refletir o novo preço e quotas, gerando um novo snapshot contratual (`N_contrato`).

---

## 3. Resolução de Impasses: O Fluxo de Cancelamento de Acordos

O que acontece se uma das partes rejeitar a adenda (passando a `REJEITADA`) e o iniciador considerar inviável continuar o trajeto nas condições antigas? Ou se houver um desalinhamento irreconciliável? 

O sistema deve disponibilizar um **Mecanismo de Rescisão Contratual Seguro** para evitar que motoristas fiquem sem receber a quota mensal acumulada ou que passageiros fiquem subitamente apeados nas vias rápidas de Luanda sem alternativa de transporte.

### Modalidades de Rescisão:

#### A. Rescisão Amigável Bilateral (Consensual)
*   **Comportamento**: Ambas as partes acordam em dar o contrato por terminado.
*   **Vigência**: Pode ser agendada para o fim do mês corrente ou executada de imediato com partilha proporcional (pro-rata) das quotas remanescentes.

#### B. Rescisão Unilateral com Aviso Prévio (Fim do Ciclo)
*   **Comportamento**: O motorista ou o passageiro decide sair do acordo de forma unilateral.
*   **Vigência**: Para manter a previsibilidade, o acordo entra em estado `CANCELAMENTO_PENDENTE`. O serviço de transporte e a partilha continuam ativos até ao último dia do mês corrente. No dia 1 do mês seguinte, o acordo torna-se fisicamente `CANCELADO`, libertando a vaga no veículo do motorista e permitindo ao passageiro procurar um novo trajeto.

#### C. Rescisão Unilateral Imediata (Com Justificação Justa)
*   Permitida apenas em cenários extremos que impossibilitam a continuidade física da boleia diária:
    *   *Avaria Catastrófica do Veículo*: O motorista comprova que o carro está imobilizado.
    *   *Problema Crítico de Segurança*: Relato de conduta inadequada de qualquer uma das partes.
    *   *Faltas Excessivas Sistemáticas*: O passageiro ou o motorista faltou a mais de 50% dos trajetos acordados no mês (validado pelo registo de faltas) [28].
*   **Vigência**: O acordo é marcado imediatamente como `CANCELADO_JUSTIFICADO`. O pagamento mensal é interrompido de imediato, e as quotas do mês corrente são recalculadas proporcionalmente aos dias úteis efetivamente realizados até ao dia do cancelamento.

---

## 4. Engenharia de Base de Dados e Segurança RLS (Supabase)

Para garantir que estas regras são invioláveis na infraestrutura técnica (Invariante 20: *"Nenhuma regra crítica deve existir apenas na UI"*), as mutações ocorrem exclusivamente através de **RPCs com contexto DEFINER**. As políticas RLS proíbem qualquer `UPDATE` direto pelas tabelas do cliente.

### Modelo de Dados Auxiliar (`acordos_adendas`):
```sql
CREATE TABLE acordos_adendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acordo_id UUID REFERENCES acordos(id) ON DELETE CASCADE,
    iniciador_id UUID REFERENCES auth.users(id),
    contraparte_id UUID REFERENCES auth.users(id),
    preco_proposto_kz NUMERIC NOT NULL CHECK (preco_proposto_kz > 0),
    modalidade_preco TEXT CHECK (modalidade_preco IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO')),
    estado TEXT DEFAULT 'PENDENTE_CONTRAPARTE' CHECK (estado IN (
        'PENDENTE_CONTRAPARTE', 'REJEITADA', 'CANCELADA_INICIADOR', 
        'CANCELADA_SUBSTITUÍDA', 'ACEITE_AGENDADA', 'EM_VIGOR'
    )),
    idempotency_key UUID UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE -- Programado para dia 1 do próximo mês
);
```

### RPCs Seguras de Execução:

1.  **`propose_agreement_adenda(p_acordo_id, p_preco, p_modalidade, p_idempotency_key)`**:
    *   Valida se o invocador é membro ativo do acordo (motorista ou passageiro).
    *   Garante que não existem outras adendas pendentes para este acordo (se existirem, marca-as como `CANCELADA_SUBSTITUÍDA`).
    *   Regista a nova adenda com `PENDENTE_CONTRAPARTE`.
2.  **`respond_agreement_adenda(p_adenda_id, p_accept, p_idempotency_key)`**:
    *   Garante que apenas o utilizador registado em `contraparte_id` pode executar a ação (RLS estrito).
    *   Se `p_accept` for `true`:
        *   Muda o estado para `ACEITE_AGENDADA`.
        *   Define `effective_from` para o primeiro dia do mês subsequente (ex: `date_trunc('month', now() + interval '1 month')`) [19].
    *   Se `p_accept` for `false`:
        *   Muda o estado da adenda para `REJEITADA`. O acordo ativo original mantém-se intacto [19].
3.  **`terminate_agreement(p_acordo_id, p_immediate, p_justificativa, p_idempotency_key)`**:
    *   Executa a rescisão contratual.
    *   Se `p_immediate` for `true`, avalia os requisitos de justa causa. Se válidos, altera o status do acordo imediatamente para `CANCELADO` e liberta as vagas.
    *   Se `p_immediate` for `false`, muda o estado do acordo para `CANCELAMENTO_PENDENTE` (ativo até ao fim do mês) [19].

---

## 5. Cobertura de Testes TDD (Marketplace Audit)

Para blindar o pipeline contra regressões na renegociação e cancelamento, a suite de testes Vitest deve cobrir deterministicamente os seguintes cenários:

```javascript
describe("Marketplace Renegotiation and Termination Audit", () => {

  it("G13: Não deve aplicar alterações de preço retroativas ou imediatas de adendas", async () => {
    // 1. Criar um acordo com quota de 30.000 Kz
    // 2. Propor uma adenda de 35.000 Kz
    // 3. Contraparte aceita a adenda
    // 4. Assert: O preço atual do acordo ativo deve manter-se em 30.000 Kz durante o mês corrente
    // 5. Assert: O campo effective_from da adenda deve apontar para o dia 1 do próximo mês
  });

  it("G14: Deve manter as condições intactas se a contraparte rejeitar a adenda", async () => {
    // 1. Criar acordo com quota de 30.000 Kz
    // 2. Propor adenda de 40.000 Kz
    // 3. Contraparte rejeita
    // 4. Assert: Estado da adenda = 'REJEITADA'
    // 5. Assert: Acordo mantém-se 'ATIVO' com quota de 30.000 Kz
  });

  it("G15: Cancelamento unilateral agendado deve reter o acordo ativo até ao fim do ciclo mensal", async () => {
    // 1. Passageiro pede cancelamento sem justa causa
    // 2. Assert: Acordo passa para estado 'CANCELAMENTO_PENDENTE'
    // 3. Assert: Passageiro continua ativo no grupo e quota é cobrada até ao fim do mês
    // 4. Assert: Vaga na oferta mantém-se ocupada até ao dia 1 do próximo mês
  });
});
```

---


# 23. Contacto telefónico

WhatsApp é apenas recurso complementar.

Não usar como mecanismo principal para:

- ativar grupos;
- adicionar passageiros;
- formar acordos;
- contornar propostas;
- substituir o matching.

Fluxo principal:

> plataforma → descoberta → pedido/proposta → aceite → acordo

Partilha via WhatsApp pode ser usada para levar pessoas à página do grupo/oferta.

---

# 24. Princípios de UX

A interface deve representar fielmente o domínio.

Nunca mostrar uma informação que sugira uma regra inexistente.

Exemplos:

### Oferta flexível

Mostrar:

> **Oferta flexível**

e os dados de disponibilidade/capacidade.

Não inventar:

> Origem → Destino

quando não existe OD.

Não mostrar:

> Zona: Viana

como se fosse uma restrição se essa regra não existir.

---

# 25. Estados devem ser claros

A UI deve distinguir claramente:

- proposta enviada;
- proposta recebida;
- proposta aberta;
- proposta aceite;
- proposta rejeitada;
- proposta cancelada;
- acordo ativo;
- waitlist;
- pedido de entrada no grupo;
- membro ativo;
- membro pendente;
- adenda pendente;
- adenda aceite.

Os CTAs devem aparecer apenas para quem possui autorização para executar aquela ação.

---

# 26. Visão completa do marketplace

## Fluxo 1 — Passageiro procura motorista

> Passageiro cria procura  
> ↓  
> plataforma encontra ofertas compatíveis  
> ↓  
> passageiro vê ofertas fixas e flexíveis elegíveis  
> ↓  
> passageiro escolhe uma oferta  
> ↓  
> envia proposta  
> ↓  
> motorista recebe  
> ↓  
> motorista aceita/rejeita  
> ↓  
> aceite atómico  
> ↓  
> acordo 1:N criado

---

## Fluxo 2 — Grupo procura motorista

> Grupo cria procura coletiva  
> ↓  
> grupo permanece negociável mesmo incompleto  
> ↓  
> plataforma encontra motoristas  
> ↓  
> motoristas podem enviar propostas  
> ↓  
> grupo recebe múltiplas propostas  
> ↓  
> grupo escolhe uma  
> ↓  
> contraparte aceita  
> ↓  
> acordo 1:N criado

---

## Fluxo 3 — Motorista flexível procura passageiros

> Motorista flexível publica disponibilidade  
> ↓  
> sem rota fixa obrigatória  
> ↓  
> plataforma apresenta procuras/grupos compatíveis  
> ↓  
> motorista analisa cada procura  
> ↓  
> motorista decide se consegue atender  
> ↓  
> envia proposta  
> ↓  
> passageiro/grupo recebe  
> ↓  
> aceita/rejeita  
> ↓  
> acordo 1:N criado

---

## Fluxo 4 — Grupo cresce durante a negociação

> Grupo 2/4  
> ↓  
> proposta N=2  
> ↓  
> terceiro membro entra  
> ↓  
> N_actual=3  
> ↓  
> proposta antiga permanece N=2  
> ↓  
> nova proposta N=3, caso necessário

---

## Fluxo 5 — Capacidade insuficiente

> Oferta 4 lugares  
> ↓  
> proposta N=5  
> ↓  
> sem acordo parcial  
> ↓  
> waitlist conforme regra  
> ↓  
> capacidade disponível posteriormente  
> ↓  
> utilizador decide participar do fluxo de promoção

---

# 27. Invariantes que NÃO podem ser quebradas

1. **Grupo é uma procura coletiva viva.**

2. **Grupo incompleto pode negociar.**

3. **Grupo pode continuar crescendo.**

4. **Mudança de N_actual não muta proposta antiga.**

5. **N_proposto é snapshot da proposta.**

6. **N_contrato é congelado no aceite.**

7. **N_activos representa apenas o estado atual.**

8. **Capacidade = lugares totais − passageiros ativos.**

9. **Não existe acordo parcial quando N excede a capacidade.**

10. **Preço TOTAL_ACORDO divide por N_proposto/N_contrato, nunca pela capacidade.**

11. **Saída de passageiro não recalcula retroativamente quotas.**

12. **Motorista flexível não é limitado pela residência.**

13. **Motorista flexível não precisa de rota fixa para existir no marketplace.**

14. **Oferta fixa usa OD no matching.**

15. **Oferta flexível não depende de OD fixo.**

16. **Passageiro e motorista podem iniciar propostas.**

17. **Somente a contraparte pode aceitar/rejeitar.**

18. **O criador não pode aceitar a própria proposta.**

19. **O telefone não substitui o fluxo da plataforma.**

20. **Nenhuma regra crítica deve existir apenas na UI; o backend deve protegê-la.**

---

# 28. Regra para desenvolvimento com agentes de IA

Qualquer agente que trabalhe no Boleia Certa deve:

- tratar este documento como referência de comportamento do produto;
- não inventar regras de negócio;
- não trocar uma regra de negócio por uma solução técnica mais simples;
- não alterar uma invariante para facilitar a implementação;
- distinguir sempre domínio, backend e UI;
- validar mudanças contra os quatro N;
- proteger regras importantes também no backend/RPC/RLS;
- executar testes relacionados à regra alterada;
- reportar qualquer ambiguidade antes de tomar uma decisão estrutural.

Quando houver conflito entre uma implementação existente e esta visão:

> primeiro identificar o conflito;
> depois propor a correção;
> não assumir automaticamente que o código existente é a verdade.

---

# 29. Critério de consistência do produto

O Boleia Certa está coerente quando o mesmo comportamento é verdadeiro em:

> **Produto → Spec → Banco de dados → RPC/RLS → Serviços → UI → Testes**

Uma funcionalidade não deve ser considerada “concluída” apenas porque:

- o botão existe;
- a tela aparece;
- o serviço funciona;
- o teste unitário passa.

Ela deve obedecer à mesma regra de negócio em todos os níveis.

---

# 30. Resumo executivo

O Boleia Certa deve funcionar como um marketplace bilateral de capacidade e procura.

### Passageiros

Criam procura, individual ou coletiva, descobrem motoristas e podem iniciar propostas.

### Grupos

São procuras coletivas vivas, podem estar incompletos, crescer e receber múltiplas propostas.

### Motoristas fixos

Publicam ofertas associadas a rotas específicas.

### Motoristas flexíveis

Publicam disponibilidade/capacidade sem precisar de rota fixa e podem tanto receber procura como procurar grupos.

### Propostas

Funcionam nos dois sentidos e uma procura pode receber várias propostas.

### Acordos

Uma proposta aceite gera um acordo:

> **1 motorista → N passageiros**

com preço e composição congelados no momento do aceite.

### Regra central

O sistema deve ajudar as pessoas a encontrar oportunidades e estruturar a negociação, mas não deve impor limitações comerciais que não façam parte da regra de negócio.

---

# 31. Frase de referência do produto

> **O Boleia Certa conecta quem precisa de transporte com quem tem capacidade para oferecer transporte, permitindo que passageiros, grupos e motoristas se encontrem, proponham, negociem e formem acordos de forma flexível e estruturada.**
