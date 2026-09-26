# VisualG — Exercícios

Site estático para estudar algoritmos de **VisualG / Portugol Estruturado**, com o
interpretador rodando dentro do navegador. Os exercícios vêm das apostilas
**Manzano** e **Faccat**; você abre um exercício, edita o código e executa sem
instalar nada.

- **95 exercícios** em 10 grupos (Manzano p. 25/26/46/50/66 e Faccat p. 4 a 8+)
- **Interpretador próprio** em JavaScript — lexer, parser e avaliador
- **Playground** para escrever e rodar um algoritmo livre
- **Zero dependências**: sem build, sem `npm install`, sem CDN, sem framework

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
script.js             roteador por hash, editor com realce, console e execução
styles/               CSS em 5 camadas (ver "Design system")
data/exercises.js     GERADO — não edite à mão
interpreter/          lexer.js, parser.js, interpreter.js
tools/                gerar-exercicios.mjs, testar.mjs
faccat/*.alg          exercícios da apostila Faccat (ex05–ex39, ex41)
manzano/*.alg         exercícios da apostila Manzano (ex25/26/46/50/66)
```

O `data/exercises.js` é **gerado** a partir dos `.alg`. Para mudar um exercício,
edite o `.alg` e regere.

## Comandos

```bash
# regerar data/exercises.js a partir dos .alg
node tools/gerar-exercicios.mjs

# suíte do interpretador: parse + smoke de todos os .alg + 21 casos de comportamento
node tools/testar.mjs
# modo estrito: entrada cíclica sem adaptar o valor ao tipo da variável
node tools/testar.mjs --literal
```

Estado atual: `117 testes | 117 pass | 0 fail` e `95/95` arquivos parseando.

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

A cada 250 linhas de saída o laço cede o event loop (`setTimeout`), para o botão
Parar responder. Por isso o CSS **nunca anima propriedade de layout** — só
`transform` e `opacity`.

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
