# VisualG — Exercícios

Site estático para estudar algoritmos de **VisualG / Portugol Estruturado**, com o
interpretador rodando dentro do navegador. Os exercícios vêm das apostilas
**Manzano** e **Faccat**; você abre um exercício, edita o código e executa sem
instalar nada.

- **95 exercícios** em 10 grupos (Manzano p. 25/26/46/50/66 e Faccat p. 4 a 8+)
- **Interpretador próprio** em JavaScript — lexer, parser e avaliador
- **Playground** para escrever e rodar um algoritmo livre
- **Zero dependências**: sem build, sem `npm install`, sem CDN, sem framework

## Onde está no ar

**https://matheuscoletti08.github.io/visualg-exercises/**

Basta abrir o endereço — não precisa clonar nem instalar nada. É a mesma página
que o `index.html` serve localmente, sem etapa de build: os scripts são clássicos,
então o que funciona no repositório funciona publicado.

## Como abrir

Abrir o `index.html` direto no navegador já funciona:

```
index.html
```

Não precisa de servidor. O projeto **não usa ES modules, `fetch` nem `import`**,
então o `file://` não bloqueia nada. (Se algum dia virar module, aí sim precisa de
servidor local.)

Rodar por servidor local, se preferir:

```bash
python -m http.server 8000
```

## Estrutura

```
index.html            SPA: home, tela de exercício e playground
script.js             roteador por hash, editor, console, debugger e execução
styles/               CSS em 5 camadas (ver "Design system")
data/exercises.js     GERADO — não edite à mão

src/visualg/          motor, em ordem de carga
  carga.mjs            CONTRATO de ordem de <script> (verificado por build)
  diagnostics.js       hierarquia de erros, com linha/coluna/comprimento
  tokens.js            vocabulário: palavras-chave, com acento e sem
  ast.js               nós da AST; todo nó carrega linha e coluna
  lexer.js             lexador com coluna
  parser.js            precedência da §13 do task.md
  values.js            tipos, coerção, vetores e matrizes
  environment.js       ambientes, frames, passagem por referência
  scheduler.js         estados e orçamento de passos (sem teto de relógio)
  runtime.js           executor sobre a AST
  api.js               superfície pública
  semantic.js          análise estática (opt-in)
  index.js             agregador → window.Vg
  stdlib/              matemática (§29) e texto (§30)
  extensions/          comandos do VisuAlg (§31–§39)
  debugger.js          breakpoint, passo a passo, perfil

src/playground/       camada de UI, com lógica separada do DOM
  editor-formatter.js  §49
  editor-highlight.js  §51
  editor-autocomplete.js §50
  persistence.js       §61
  share.js             §62
  worker-client.js     §52, com fallback
  debug-panels.js      §43–§45

tools/                gerar-exercicios.mjs, testar.mjs, testar-tudo.mjs,
                      verificar-carga.mjs
tests/                suítes por camada; tests/lib/harness.mjs é o harness
faccat/*.alg          exercícios da apostila Faccat (ex05–ex39, ex41)
manzano/*.alg         exercícios da apostila Manzano (ex25/26/46/50/66)
```

O `data/exercises.js` é **gerado** a partir dos `.alg`. Para mudar um exercício,
edite o `.alg` e regere.

A ordem dos `<script>` em `index.html` é **contrato**, não convenção:
`src/visualg/carga.mjs` declara a ordem e `tools/verificar-carga.mjs` falha se o
`index.html` divergir. Ele também reprova `eval`, `new Function`,
`type="module"` e qualquer recurso remoto — as três proibições que o `file://`
e a regra nº 1 do spec exigem.

## Comandos

```bash
# TUDO: contrato + 10 suítes
node tools/testar-tudo.mjs

# regerar data/exercises.js a partir dos .alg
node tools/gerar-exercicios.mjs

# só o contrato de carga e as proibições
node tools/verificar-carga.mjs

# cola entre script.js e a API do Debugger, e renderização dos painéis
node tests/playground/glue.test.mjs

# suíte do interpretador: parse + smoke de todos os .alg + 21 casos
node tools/testar.mjs
# modo estrito: entrada cíclica sem adaptar o valor ao tipo da variável
node tools/testar.mjs --literal

# regerar o baseline de ouro do corpus (§56)
node tests/compat/corpus.test.mjs --atualizar
```

Estado atual: **10 suítes, 800 testes, 0 falhas** e `95/95` arquivos parseando.

O que o número 800 cobre, e o que **não** cobre: a fase smoke alimenta os `.alg`
com entrada falsa, que não satisfaz o `leia`, então ela prova que a engine não
trava, não que o algoritmo do exercício está certo. O baseline de
`tests/compat/baseline.json` congela a saída atual de cada um dos 95 para pegar
deriva futura, mas congela o comportamento **de hoje**, não o correto. Os 2
arquivos que só param por orçamento de passos estão registrados como
`limite-passos`, que é expectativa explícita e não aprovação.

## Orçamentos e o que protege o navegador

O único orçamento que derruba um programa é o **contador de passos**
(`maxPassos`, padrão 2 000 000). Ele conta trabalho, não tempo.

Não existe teto de relógio de parede por padrão. Um `maxExecutionTime` fixo mede
a máquina de quem roda, não o programa, e não distingue "programa lento" de
"trava" — derrubando o caso legítimo, que é o programa lento que se quer
depurar. Quem precisa de teto (worker, CI, servidor) passa
`maxExecutionTime` em ms e continua sendo obedecido; o padrão `0` significa
"sem teto".

## Debugger

O botão **Debug** marca a execução, e o debugger é o mesmo runtime: `passo`,
`continuar` e `parar` seguram e soltam uma barreira dentro do executor. **Nada
é reexecutado** — um `Continuar` não volta ao começo do programa, não repete
`leia`, não re-sorteia `aleatorio` e não zera `cronometro`.

A call stack e as variáveis do painel são lidas do runtime
(`getCallStack`/`getVariables`), e não de uma segunda estrutura mantida pelo
debugger: o que aparece na tela é literalmente o `Environment` que o executor
está usando.

## Como a execução funciona

O editor é um **overlay de duas camadas**: um `<pre>` com o código realceado
(visível) e um `<textarea>` transparente por cima, que é quem recebe o teclado e o
scroll. Isso significa que **as duas camadas precisam de métricas idênticas** de
fonte — `padding`, `font-family`, `font-size`, `line-height`, `tab-size` e
`white-space` estão fixados numa **regra CSS compartilhada** e via custom
properties (`--md-ext-code-*`). Alterar essas métricas em só uma das duas
desalinha o realce.

O console tem entrada interativa: quando o programa chega num `leia`, a linha de
prompt aparece e o `Enter` resolve a promise de entrada.

A cada 50 000 comandos o laço cede o event loop (`setTimeout`), para o botão
Parar responder e a aba não travar. Por isso o CSS **nunca anima propriedade de
layout** — só `transform` e `opacity`.

## Design system

Redesign para **Material 3 Expressive**, em CSS puro sobre custom properties.

| arquivo | conteúdo |
|---|---|
| `tokens.css` | 233 tokens: tipografia, shape, elevação, motion, espaçamento |
| `theme.css` | color roles do M3 (seed `#6750A4`), claro e escuro |
| `base.css` | reset, base tipográfica, utilitários, acessibilidade |
| `components.css` | componentes: cards, botões, editor, console, badges |
| `motion.css` | transições, `@keyframes` e `prefers-reduced-motion` |

Decisões que valem saber:

- **Molas em CSS.** O M3 Expressive usa molas, mas não há implementação na Web.
  O caminho oficial é a tabela de conversão em `cubic-bezier`; nos momentos de
  maior destaque isso sobe para `linear()` com pontos que passam de `1.0`,
  dentro de `@supports` com fallback.
- **Sem `@layer`, sem `:has()`, sem view transitions.** `file://` e
  compatibilidade valem mais que elegância.
- **A sintaxe do realce** é um scanner próprio (`script.js`), independente do
  lexer do interpretador.
- **Forced colors:** em alto contraste o realce é sacrificado de propósito —
  manter a paleta faria a seleção tapar o código.
- **Foco na troca de tela** não é corrigido: exigiria mexer no roteador. O
  teclado não trava, só recomeça do topo.

Cada exercício tem um **badge de categoria** com cor e um marcador
não-cromático (ponto, anel, barra, losango), para não depender só de cor.

## Limitações conhecidas

- Editar e recarregar **perde o código** — não há `localStorage`
- A busca não persiste e é reconstruída a cada tecla
- Existe **um** botão de diálogo ausente: "Restaurar original" descarta as
  edições sem confirmação
- O F9 não é atalho (removido); execute pelo botão

## Créditos

Apostilas de referência:

- **Faccat** — *Exercícios*, Profª. Flávia Pereira de Carvalho (`faccat.br`)
- **Manzano** — *Livro de Algoritmos*, José Augusto N. G. Manzano

Os PDFs originais estão versionados em `faccat/` e `manzano/`. As extrações de
texto (`.txt`) são artefato de pesquisa e não estão no repositório.
