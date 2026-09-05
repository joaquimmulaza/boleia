Seu assistente de programação com IA não conhece seu código-fonte. Ele conhece seus arquivos. Há uma diferença.
Abhinav Dobhal
Abhinav Dobhal

Seguir
7 minutos de leitura
·
28 de abril de 2026



Pressione Enter ou clique para ver a imagem em tamanho real.

O Graphify transforma sua base de código em um grafo de conhecimento consultável, reduzindo os tokens de contexto de IA em 71,5 vezes e resolvendo o problema de navegação que janelas maiores não conseguem solucionar.

Sempre que você pede a um assistente de IA para ajudar com uma refatoração, ele começa do zero. Lê alguns arquivos, tenta adivinhar o que é relevante e dá uma resposta sem ter noção do que não leu. Então você cola mais cinco arquivos e pede novamente.

Isso não é um problema de janela de contexto. Um milhão de tokens de contexto não ajuda se o modelo nunca descobrir que a chave de configuração que você renomeou depende estruturalmente de um módulo de faturamento três camadas abaixo — um módulo cujo nome não compartilha nenhuma palavra-chave com a chave de configuração. Você não pode usar busca semântica para descobrir essa dependência. Você precisa do grafo de chamadas.

O Graphify foi desenvolvido com base nessa ideia. Ele transforma uma base de código em um grafo de conhecimento persistente e consultável, permitindo que agentes de IA naveguem por ele estruturalmente, e não apenas semanticamente.

Por que janelas de contexto maiores não resolvem o problema de navegação?
A intuição é razoável: se um modelo consegue manter todo o código-fonte em contexto, ele deveria ser capaz de responder a qualquer pergunta sobre ele. Na prática, duas coisas dão errado.

Primeiro, inserir um código-fonte completo em um prompt é custoso. Se você consultar um assistente de IA dez vezes por dia e fornecer a ele 50.000 tokens de contexto a cada vez, você estará consumindo tokens rapidamente — mesmo que apenas 2.000 tokens sejam realmente relevantes para a pergunta.

Em segundo lugar, e menos óbvio: os modelos perdem o foco em contextos longos. Isso foi estudado empiricamente (degradação da atenção "perdida no meio") e significa que uma restrição arquitetônica embutida em um estímulo massivo pode simplesmente ser ignorada. Um contexto maior não garante uma melhor distribuição da atenção.

A pesquisa que fundamenta o Graphify chama isso de Paradoxo da Navegação : à medida que as janelas de contexto se expandem, o gargalo passa de quanto você consegue ler para se você consegue descobrir o que precisa ler . Uma busca semântica padrão retorna arquivos com termos semelhantes. Uma travessia estrutural de grafo retorna arquivos com relações reais de grafo de chamadas — que é o que você precisa para refatoração segura, análise de dependências e compreensão de falhas em cascata.

Como a Graphify constrói o grafo: três etapas, duas tecnologias, um registro de auditoria honesto
O Graphify processa uma base de código em três etapas distintas. Cada uma delas é focada naquilo que faz bem, e cada relação identificada recebe uma pontuação de confiança. Não há falsa precisão.

Etapa 1: Extração determinística de AST (gratuita, local, confiança: 1,0)
A primeira etapa utiliza o Tree-sitter — um analisador sintático incremental de alto desempenho — para extrair o esqueleto estrutural do código-fonte. Essa etapa é executada inteiramente em nível local, sem chamadas à API. Ela identifica funções, classes, interfaces, importações e grafos de chamadas entre arquivos em mais de 25 linguagens. Cada aresta produzida é marcada EXTRACTEDcom um nível de confiança de 1,0. Essa é a verdade fundamental.

Isso é importante porque as representações semânticas frequentemente omitem dependências estruturais. Uma chave de configuração renomeada que quebra um módulo de faturamento não aparecerá em uma busca vetorial, a menos que o módulo de faturamento mencione a chave pelo nome em algum lugar. O grafo de chamadas a detecta imediatamente.

Etapa 2: Transcrição local de áudio/vídeo (gratuita, local)
As decisões de arquitetura não se limitam ao código. Elas também estão presentes em revisões de design gravadas, demonstrações no Loom e retrospectivas de sprint que ninguém transcreveu. O Graphify utiliza o Faster Whisper para processar essas informações localmente, usando termos dos nós mais centrais da base de código como um recurso de consulta ao domínio para melhorar a precisão do jargão técnico. O resultado é indexado no grafo junto com o código.

Etapa 3: Inferência semântica via Claude (custo da API, confiança: 0,4–0,9)
A etapa final envia dados não estruturados — documentos Markdown, PDFs, diagramas de arquitetura, capturas de tela — para subagentes do Claude que operam em paralelo. Eles extraem conexões conceituais e o raciocínio por trás de decisões específicas. Essas conexões são marcadas INFERREDcom pontuações de confiança que refletem a incerteza do modelo. A implementação de um componente React pode acabar diretamente conectada a uma captura de tela da interface do usuário pretendida e a um PDF de sua especificação original.

O gráfico combinado é armazenado em formato JSON no disco. Ele persiste entre as sessões. Seu assistente de IA não inicia do zero.

A redução de 71,5x nos tokens, explicada
A matemática é simples. Em um fluxo de trabalho padrão, o modelo lê os arquivos relevantes para cada consulta: o contexto usado é aproximadamente do tamanho total do código-fonte. Com o Graphify, o modelo interage com um subgrafo focado — a vizinhança estrutural de 1 ou 2 saltos do problema — além de um relatório resumido. Esse subgrafo é ordens de magnitude menor que o código-fonte completo.

A redução alegada é de 71,5x em corpora mistos. O mecanismo funciona da seguinte forma: em vez de tentar adivinhar quais arquivos ler, a IA consulta os dados de adjacência do grafo para recuperar apenas os nós estruturalmente conectados. Você não está pagando para que o modelo vasculhe todo o seu utils/diretório para encontrar os três arquivos que realmente importam.

Em uma base de código empresarial de grande porte, isso também representa uma redução de latência. Menos contexto significa respostas mais rápidas. O custo inicial de construção do grafo é amortizado em cada consulta subsequente.

O que o gráfico realmente revela
Além da eficiência bruta dos tokens, o gráfico produz alguns resultados específicos que merecem destaque.

Receba as histórias de Abhinav Dobhal na sua caixa de entrada.
Cadastre-se gratuitamente no Medium para receber atualizações deste autor.

Insira seu e-mail
Inscreva-se

Lembre-se de mim para um login mais rápido

Nós Divinos — entidades com centralidade excepcionalmente alta (identificadas via PageRank). Esses são os gargalos da sua arquitetura: as utilidades que são chamadas por tudo, os módulos dos quais tudo depende. O Graphify os identifica automaticamente. Antes mesmo de você mexer em um deles, você já sabe o que vem depois.

Comunidades de Leiden — agrupamentos de módulos derivados da densidade de arestas, não da similaridade semântica. O grafo agrupa automaticamente sua base de código em comunidades funcionais ( auth, billing, infra, etc.) da mesma forma que um engenheiro sênior particionaria um sistema mentalmente. Isso é útil tanto para arquitetos humanos quanto para agentes que precisam entender os limites dos módulos.

Dependências circulares — identificadas pelo algoritmo SCC do Tarjan. Elas são uma fonte silenciosa de complexidade na compilação e fragilidade na implantação. Identificá-las antes de uma refatoração, em vez de descobri-las durante a integração contínua, economiza tempo real.

Conexões surpreendentes — arestas entre módulos que não são óbvias apenas pela estrutura de arquivos. São essas coisas que quebram em produção quando se assume que dois módulos são independentes.

Onde se integra
O Graphify foi projetado como uma habilidade universal, e não como um plugin específico para IDEs. A integração varia conforme a plataforma:

VSCode : Uma extensão da Anytechie Studio adiciona um comando "Criar Gráfico de Conhecimento" acessível com o botão direito do mouse e um visualizador interativo baseado em vis.js com navegação para o código.
Cursor : Instala um arquivo de regras em .cursor/rules/graphify.mdc, alwaysApply: truetornando o gráfico permanentemente disponível durante todas as conversas.
Código Claude : Utiliza um PreToolUsegancho — integração mais profunda com os subagentes Claude.
Aider / Neovim / CLI : Funciona através de AGENTS.mdcomandos e --watchmodos, reconstruindo o grafo à medida que os arquivos são salvos.
Para projetos com alta rotatividade, um gancho git ( graphify hook install) mantém o gráfico sincronizado a cada commit.

O caminho de implementação
Se você quiser testar isso em um projeto existente:

bash

# Instale (o pipx isola tudo corretamente)
 pipx install graphifyy 
# Configure os padrões de ignorar - trate isso como .gitignore 
cat > .graphifyignore << EOF 
node_modules/ 
dist/ 
*.min.js 
vendor/ 
EOF 
# Construa o grafo
 graphify vscode install    # ou: graphify claude install 
# Clique com o botão direito na pasta do seu projeto no VSCode > "Graphify: Construir Grafo de Conhecimento" 
# Ou no seu chat de IA: /graphify.
Após a primeira compilação, verifique graphify-out/GRAPH_REPORT.mdprimeiro. Isso resume os nós principais e as conexões inesperadas — as decisões arquitetônicas que seu assistente de IA deve conhecer antes de fazer qualquer alteração.

Para projetos grandes (mais de 5.000 nós), o visualizador HTML atinge os limites de desempenho do navegador. Use -o graphify querypara gerar subgrafos com escopo comunitário.

Um detalhe importante: se GET()`or` logger()estiver aparecendo como God Nodes, seus padrões de ignorar estão sem bibliotecas de terceiros. Atualize .graphifyignoree execute novamente com --update`.

O que isso não resolve
Graphify é uma camada de navegação, não de raciocínio. Ela informa ao modelo o que está conectado; não diz ao modelo o que fazer . Agentes com planejamento deficiente ainda tomam decisões ruins mesmo com dados de grafo perfeitos.

As arestas inferidas (Passo 3) possuem pontuações de confiança por um motivo. Os links conceituais extraídos por modelos de linguagem podem estar incorretos, especialmente em bases de código grandes e mal documentadas. Trate as arestas INFERIDAS como hipóteses a serem verificadas, não como verdades absolutas.

E o gráfico só está atualizado até a última versão. Em uma base de código em constante evolução, um gráfico com alguns dias de desatualização pode apontar para dependências que já foram removidas por refatoração. O --watchmodo e os hooks do Git resolvem esse problema, mas apenas se forem executados consistentemente.

O turno real
A premissa fundamental é que a navegação estrutural e a busca semântica resolvem problemas diferentes. A busca semântica recupera arquivos que parecem relacionados. A travessia de grafos recupera arquivos que são estruturalmente relacionados — conectados por grafos de chamadas, árvores de importação e cadeias de dependência reais. Para depuração, refatoração e compreensão de como as alterações se propagam, o grafo é a melhor opção.

A estrutura do Paradoxo da Navegação é precisa: temos nos concentrado tanto em expandir o que os modelos conseguem ler que investimos pouco em ajudá-los a descobrir o que deveriam ler . O Graphify é uma tentativa direta de corrigir isso.

Se você estiver trabalhando em uma base de código com mais do que alguns módulos, vale a pena construir o gráfico pelo menos uma vez, apenas para ler o GRAPH_REPORT. Você aprenderá algo sobre sua própria arquitetura.

→ GitHub: safishamsi/graphify → Extensão VSCode: Graphify por Anytechie Studio → Pesquisa: O Paradoxo da Navegação na Codificação Agêntica de Grande Contexto (arXiv)