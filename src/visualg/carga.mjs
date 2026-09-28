// Contrato de ordem de carga do engine.
//
// O projeto não usa bundler nem módulos ES no browser: a engine é montada por
// `<script>` clássicos em `index.html`, e a ordem importa porque cada arquivo
// publica no escopo global (`window.VgLexer`, `window.VgParser`, `window.Vg`).
// Uma tag fora de ordem falha em silêncio ou em runtime, com mensagem ruim.
//
// Este arquivo é a fonte da verdade. `node tools/verificar-carga.mjs` faz parse
// de `index.html` e exige que a sequência de `<script src>` seja EXATAMENTE esta.
//
// Ondas futuras do `backlog.md` ampliam a lista na medida em que a engine nova
// entra. Nada aqui é lido pelo browser: é contrato de build, não runtime.
//
// Nota de nomenclatura: `.mjs` e não `.js` porque o projeto não tem
// `package.json`, e portanto não existe onde declarar um `.js` como ESM.

// `noNode` marca as entradas que dependem de `window`/`document` e por isso não
// podem ser importadas pelo `tools/testar.mjs`. As demais são a engine, e o
// harness de teste as carrega na MESMA ordem do browser — se a ordem divergir, o
// navegador funciona e o teste não (ou o inverso), que é a pior combinação
// possível num projeto sem build.
export const CARGA = [
  { src: "data/exercises.js", motivo: "catálogo window.GRUPOS / window.EXERCICIOS", noNode: true },
  { src: "src/visualg/diagnostics.js", motivo: "W.VG.Diagnostics (§46)", noNode: false },
  { src: "src/visualg/tokens.js", motivo: "W.VG.Tokens — não depende de nada", noNode: false },
  { src: "src/visualg/ast.js", motivo: "W.VG.Ast — não depende de nada", noNode: false },
  { src: "src/visualg/lexer.js", motivo: "W.VG.Lexer (consome Diagnostics e Tokens)", noNode: false },
  { src: "src/visualg/parser.js", motivo: "W.VG.Parser (consome Ast, Tokens e Diagnostics)", noNode: false },
  { src: "src/visualg/values.js", motivo: "W.VG.Values — tipos, coerção, vetores e matrizes", noNode: false },
  { src: "src/visualg/environment.js", motivo: "W.VG.Environment (consome Values)", noNode: false },
  { src: "src/visualg/stdlib/math.js", motivo: "W.VG.StdlibMath — builtins de matemática (§29)", noNode: false },
  { src: "src/visualg/stdlib/string.js", motivo: "W.VG.StdlibString — builtins de texto (§30)", noNode: false },
  { src: "src/visualg/extensions/extensions.js", motivo: "W.VG.Extensoes — comandos §31–§39 (consome Diagnostics; o runtime consulta seus hooks)", noNode: false },
  { src: "src/visualg/scheduler.js", motivo: "W.VG.Scheduler — estados e orçamentos", noNode: false },
  { src: "src/visualg/runtime.js", motivo: "W.VG.Runtime (consome Values, Environment, Scheduler e os builtins)", noNode: false },
  { src: "src/visualg/api.js", motivo: "W.VG.Api — superfície pública (§58)", noNode: false },
  { src: "src/visualg/semantic.js", motivo: "W.VG.Semantica — análise estática (§47); lido por api.js no momento da chamada, então precisa vir antes do agregador", noNode: false },
  { src: "src/visualg/index.js", motivo: "W.Vg — agregador, fecha a engine", noNode: false },
  // Instrumentação do debugger (§40–§45). Fica no NÍVEL DA ENGINE, e não em
  // `src/playground/`, por um motivo concreto: ele não tem uma linha de DOM, e
  // `W.VG.Debugger` dirige o `Execucao` de `api.js` — ou seja, é código de
  // execução, não de tela. `noNode: false` porque a §40–§45 é testável em Node.
  { src: "src/visualg/debugger.js", motivo: "W.VG.Debugger (§40–§45) — consome Scheduler, Values e o agregador; sem DOM", noNode: false },
  // Camada de UI. Independentes entre si; `noNode: false` porque todos se
  // provedem de lógica pura e são testáveis em Node, onde não existe `document`.
  { src: "src/playground/editor-formatter.js", motivo: "W.VGPlay.Formatter (§49)", noNode: false },
  { src: "src/playground/editor-highlight.js", motivo: "W.VGPlay.Highlight (§51)", noNode: false },
  { src: "src/playground/editor-autocomplete.js", motivo: "W.VGPlay.Autocomplete (§50)", noNode: false },
  { src: "src/playground/persistence.js", motivo: "W.VGPlay.Persistence (§61)", noNode: false },
  { src: "src/playground/share.js", motivo: "W.VGPlay.Share (§62)", noNode: false },
  { src: "src/playground/worker-client.js", motivo: "W.VGPlay.WorkerClient (§52)", noNode: false },
  { src: "src/playground/debug-panels.js", motivo: "W.VGPlay.DebugPanels (§43–§45) — camada pura + `criar(doc)` injetável; nada é montado no carregamento", noNode: false },
  { src: "script.js", motivo: "UI; consome tudo acima", noNode: true },
];

/** Lista plana de caminhos, na ordem exigida. */
export const ORDEM = CARGA.map((c) => c.src);

/** Só a engine, na ordem exigida — o que o harness de teste importa. */
export const ORDEM_ENGINE = CARGA.filter((c) => !c.noNode).map((c) => c.src);
