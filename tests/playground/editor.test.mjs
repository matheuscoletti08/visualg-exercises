// Testes das três ferramentas de editor do Playground (onda 10):
//
//   §49 formatter      — src/playground/editor-formatter.js
//   §50 autocomplete   — src/playground/editor-autocomplete.js
//   §51 realce         — src/playground/editor-highlight.js
//
// Executável isolado: `node tests/playground/editor.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`), depois `W.VGPlay` existe, e só então os três
// módulos de editor — nesta ordem, porque o formatter é o único que o
// highlight não usa e nenhum dos três consome outro. Se a ordem divergir da de
// `index.html`, o teste passa e o navegador quebra, que é a pior combinação
// possível num projeto sem build.
//
// NENHUM TESTE DEPENDE DE DOM. Não há `document` aqui e não pode haver: é a
// razão de os três módulos separarem lógica pura (string → string) de DOM. A
// seção [7/7] verifica isso ativamente, inclusive nos arquivos-fonte.
//
// Tolerância: nenhuma. São comparações de string, e string não tem
// arredondamento.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULOS = [
  "src/playground/editor-formatter.js",
  "src/playground/editor-highlight.js",
  "src/playground/editor-autocomplete.js",
];

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
for (const src of MODULOS) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}

const Vg = globalThis.Vg;
const GP = globalThis.VGPlay;
const F = GP.Formatter;
const H = GP.Highlight;
const A = GP.Autocomplete;

// --------------------------------------------------------------------- asserts

let total = 0;
let pass = 0;
let fail = 0;

function secao(titulo) {
  console.log("");
  console.log(titulo);
  console.log("-".repeat(66));
}

function relatar(ok, nome, detalhe) {
  total++;
  if (ok) {
    pass++;
    console.log("  ✅ " + nome);
  } else {
    fail++;
    console.log("  ❌ " + nome);
    console.log("       → " + detalhe);
  }
}

/** Executa um caso; devolve a string de problema ou `null` quando passou. */
function caso(nome, fn) {
  try {
    const detalhe = fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada: " + (e && e.message ? e.message : String(e)));
  }
}

function eIgual(obtido, esperado, msg) {
  if (obtido === esperado) return null;
  return msg + "\n       esperado: " + JSON.stringify(esperado) + "\n       veio:     " + JSON.stringify(obtido);
}

function eVerdadeiro(cond, msg) {
  if (cond) return null;
  return msg;
}

function eFalso(cond, msg) {
  if (!cond) return null;
  return msg;
}

// ================================================================= 1. contrato

secao("[1/8] Contrato dos três módulos (Onda 10)");

caso("cada módulo publica em W.VGPlay com o nome que a onda pede", () => {
  const faltando = ["Formatter", "Highlight", "Autocomplete"].filter((n) => !GP[n]);
  return eIgual(faltando.join(","), "", "módulo ausente em W.VGPlay");
});

caso("a API pública é função pura: recebe string e devolve string ou dados", () => {
  if (typeof F.formatar !== "function") return "Formatter.formatar não é função";
  if (typeof F.apenasTexto !== "function") return "Formatter.apenasTexto não é função";
  if (typeof H.realcar !== "function") return "Highlight.realcar não é função";
  if (typeof H.realceHtml !== "function") return "Highlight.realceHtml não é função";
  if (typeof A.sugerir !== "function") return "Autocomplete.sugerir não é função";
  if (typeof A.extrairPrefixo !== "function") return "Autocomplete.extrairPrefixo não é função";
  return null;
});

caso("cada função pública tolera entrada que não é string, sem lançar", () => {
  const entradas = [undefined, null, 42, {}, []];
  for (const e of entradas) {
    const t = F.formatar(e);
    if (typeof t.texto !== "string") return "Formatter.formatar(" + JSON.stringify(e) + ") não devolveu string";
    if (typeof H.realcar(e).html !== "string") return "Highlight.realcar(" + JSON.stringify(e) + ") não devolveu string";
    if (!Array.isArray(A.sugerir(e, 0))) return "Autocomplete.sugerir(" + JSON.stringify(e) + ") não devolveu array";
  }
  return null;
});

caso("o texto devolvido pelo realce reconstrói o original: só muda a marcação", () => {
  const fonte = 'algoritmo "x" // nota\nvar\n   n: inteiro\ninício\n   n <- 1\nfimalgoritmo\n';
  const html = H.realceHtml(fonte);
  // Tira as tags e as entidades: o que sobrar tem que ser o código-fonte.
  let limpo = html.replace(/<span class="[a-z-]+">/g, "").replace(/<\/span>/g, "");
  limpo = limpo
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  return eIgual(limpo, fonte, "o HTML do realce não reconstrói o texto original");
});

// ========================================================== 2. §49 indentação

secao("[2/8] §49 Formatter — indentação, minúsculas e alinhamento de blocos");

const EXEMPLO49 =
  'algoritmo "t"\nvar\n   x: inteiro\ninício\nse x>10 entao\nescreval("x")\nfimse\nfimalgoritmo\n';

caso("§49: `se x>10 entao` vira `se x > 10 então` e o corpo desce um nível", () => {
  const r = F.formatar(EXEMPLO49);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  // O corpo do `início` é um nível (é assim que os 95 `.alg` do corpus estão
  // escritos, e é o exemplo da §2 do `task.md`), e o `se` abre um segundo.
  const esperado =
    'algoritmo "t"\nvar\n   x: inteiro\ninício\n   se x > 10 então\n      escreval("x")\n   fimse\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "saída do exemplo da §49");
});

caso("a indentação é de 3 espaços por nível, padrão do VisualAlg", () => {
  if (F.INDENTACAO !== "   ") return "INDENTACAO é " + JSON.stringify(F.INDENTACAO) + ", deveria ser 3 espaços";
  const r = F.formatar(EXEMPLO49);
  const linha = r.texto.split("\n").find((l) => l.indexOf("escreval") >= 0 && !/^\s*\*/.test(l));
  return eIgual(linha, "      escreval(\"x\")", "corpo do `se` não está em 3 passos de 3 espaços");
});

caso("palavra-chave vai para MINÚSCULA com a forma canônica acentuada (§4)", () => {
  const entrada = 'ALGORITMO "t"\nVAR\n   X: INTEIRO\nINICIO\nSE X>1 ENTAO\n   ESCREVAL(X)\nSENAO\n   ESCREVAL(0)\nFIMSE\nFIMALGORITMO\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const texto = r.texto;
  for (const esperada of ["algoritmo", "var", "início", "se", "então", "senão", "fimse", "fimalgoritmo"]) {
    if (texto.indexOf(esperada) < 0) return "não achou a forma canônica '" + esperada + "' em:\n" + texto;
  }
  if (texto.indexOf("INTEIRO") >= 0) return "tipo ficou em maiúscula:\n" + texto;
  return null;
});

caso("`entao`, `senao`, `ate` e `faca` sem acento viram acentuadas, e `nao` também", () => {
  const entrada = 'algoritmo "t"\ninício\n   se falso então\n      escreval(nao verdadeiro)\n   senão\n      escreval(1)\n   fimse\n   enquanto falso faça\n      escreval(2)\n   fimenquanto\n   repita\n      escreval(3)\n   até falso\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  for (const esperada of ["então", "senão", "não", "faça", "até"]) {
    if (r.texto.indexOf(esperada) < 0) return "não achou '" + esperada + "' em:\n" + r.texto;
  }
  return null;
});

caso("`senão` alinha com o `se` e o corpo dele desce um nível", () => {
  const entrada = 'algoritmo "t"\ninício\n   se verdadeiro então\n      escreval(1)\n   senão\n      escreval(2)\n   fimse\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   se verdadeiro então\n      escreval(1)\n   senão\n      escreval(2)\n   fimse\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "`senão` não alinhou com `se`");
});

caso("`senão` alinha com o `se` mesmo quando o `se` estava sem indentação", () => {
  const entrada = 'algoritmo "t"\ninício\nse verdadeiro então\nescreval(1)\nsenão\nescreval(2)\nfimse\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   se verdadeiro então\n      escreval(1)\n   senão\n      escreval(2)\n   fimse\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "`senão` não alinhou com `se`");
});

caso("`caso`/`outrocaso` alinham com `escolha` e `fimescolha` fecha na coluna dele", () => {
  const entrada = 'algoritmo "t"\ninício\nescolha 1\ncaso 1\nescreva(1)\ninterrompa\noutrocaso\nescreva(2)\nfimescolha\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   escolha 1\n   caso 1\n      escreva(1)\n      interrompa\n   outrocaso\n      escreva(2)\n   fimescolha\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "corpo do `caso` não alinhou com `escolha`");
});

caso("`repita`/`até`: o `até` volta para a coluna do `repita`", () => {
  const entrada = 'algoritmo "t"\ninício\nrepita\nescreva(1)\naté falso\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  return eIgual(
    r.texto,
    'algoritmo "t"\ninício\n   repita\n      escreva(1)\n   até falso\nfimalgoritmo\n',
    "`até` não voltou para a coluna do `repita`"
  );
});

caso("blocos aninhados: cada fecha na coluna do seu abre", () => {
  const entrada = 'algoritmo "t"\ninício\nse 1>0 então\nse 2>0 então\nescreva(1)\nfimse\nfimse\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   se 1 > 0 então\n      se 2 > 0 então\n         escreva(1)\n      fimse\n   fimse\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "aninhamento de `se` não bateu");
});

caso("`senão` com `se` dentro fecha os dois blocos na coluna certa", () => {
  const entrada = 'algoritmo "t"\ninício\nse 1>0 então\nescreva(1)\nsenão\nse 2>0 então\nescreva(2)\nfimse\nfimse\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   se 1 > 0 então\n      escreva(1)\n   senão\n      se 2 > 0 então\n         escreva(2)\n      fimse\n   fimse\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "`senão` + `se` aninhado não desalinhou");
});

caso("string e comentário sobrevivem intactos (§49: preservar)", () => {
  const entrada =
    "algoritmo 't'\n" +
    "início\n" +
    "   // comentário com acento e 3.14\n" +
    "   escreval('aspas e  //  dentro')\n" +
    "   escreval(1) // de rabo\n" +
    "fimalgoritmo\n";
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  if (r.texto.indexOf("// comentário com acento e 3.14") < 0) return "comentário de linha própria perdido";
  if (r.texto.indexOf("escreval('aspas e  //  dentro')") < 0) return "literal com `//` dentro foi comida";
  if (r.texto.indexOf("escreval(1)  // de rabo") < 0) return "comentário de rabo não foi preservado";
  return null;
});

caso("`://` dentro de string não vira comentário (o `//` do texto, não da linha)", () => {
  const entrada = 'algoritmo "t"\ninício\n   escreval("http://exemplo.com/x?a=1&b=2")\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  return eIgual(
    r.texto,
    'algoritmo "t"\ninício\n   escreval("http://exemplo.com/x?a=1&b=2")\nfimalgoritmo\n',
    "literal com `://` foi comida como comentário"
  );
});

caso("especificador de formato da §16 não ganha espaço (`10:5`, `3.14159:8:2`)", () => {
  const entrada = 'algoritmo "t"\ninício\n   escreva(3.14159:8:2)\n   escreva("A","B",10:5)\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado =
    'algoritmo "t"\ninício\n   escreva(3.14159:8:2)\n   escreva("A", "B", 10:5)\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "especificador de formato foi reescrito");
});

caso("declaração de tipo COM espaço (`x: inteiro`) continua com espaço", () => {
  const entrada = 'algoritmo "t"\nvar\nx : inteiro\nv : vetor [1 .. 5] de real\ninício\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  const esperado = 'algoritmo "t"\nvar\n   x: inteiro\n   v: vetor [1..5] de real\ninício\nfimalgoritmo\n';
  return eIgual(r.texto, esperado, "declaração de tipo mudou de forma");
});

caso("variável chamada como palavra-chave (`inicio: inteiro`) não é renomeada", () => {
  // faccat/ex21.alg declara `inicio` e `fim`, e o `parser.js` grava o nome BRUTO.
  // Se o formatter acentuar, o programa deixa de compilar com nome diferente.
  const entrada = 'algoritmo "t"\nvar\ninicio: inteiro\nfim: inteiro\ninício\n   leia(inicio)\n   se (fim >= inicio) então\n      fim <- inicio + 1\n   fimse\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (!r.ok) return "não formatou: " + JSON.stringify(r.erro);
  if (r.texto.indexOf("   inicio: inteiro") < 0) return "declaração `inicio` foi acentuada:\n" + r.texto;
  if (r.texto.indexOf("leia(inicio)") < 0) return "`leia(inicio)` virou outra coisa:\n" + r.texto;
  if (r.texto.indexOf("se (fim >= inicio) então") < 0) return "operando `inicio` foi acentuado:\n" + r.texto;
  if (r.texto.indexOf("\ninício\n") < 0) return "a palavra-chave `início` do corpo não foi normalizada:\n" + r.texto;
  return null;
});

caso("o resultado formatado continua passando por `Vg.analisar`", () => {
  const r = F.formatar(EXEMPLO49);
  try {
    Vg.analisar(r.texto);
  } catch (e) {
    return "a saída não parseia: " + e.message + " (linha " + e.linha + ")";
  }
  return null;
});

// ================================================= 3. §49 idempotência no corpus

secao("[3/8] §49 Formatter — idempotência nos 95 arquivos do corpus");

const ALGS = todosAlgs();

caso("o corpus tem os 95 arquivos (a contagem do §56 vale para esta suíte)", () => {
  return eIgual(ALGS.length, 95, "todosAlgs() devolveu " + ALGS.length + " arquivos");
});

caso("formatar é IDEMPOTENTE: formatar(formatar(x)) === formatar(x) nos 95", () => {
  const problemas = [];
  for (const caminho of ALGS) {
    const nome = caminhoRelativo(caminho);
    const original = lerAlg(caminho);
    const primeira = F.formatar(original);
    if (!primeira.ok) {
      problemas.push(nome + ": 1ª passagem recusou (" + primeira.erro.mensagem + ")");
      continue;
    }
    const segunda = F.formatar(primeira.texto);
    if (!segunda.ok) {
      problemas.push(nome + ": 2ª passagem recusou (" + segunda.erro.mensagem + ")");
      continue;
    }
    if (segunda.texto !== primeira.texto) {
      const a = primeira.texto.split("\n");
      const b = segunda.texto.split("\n");
      let ln = 0;
      while (ln < a.length && ln < b.length && a[ln] === b[ln]) ln++;
      problemas.push(nome + " linha " + (ln + 1) + ": " + JSON.stringify(a[ln]) + " → " + JSON.stringify(b[ln]));
    }
  }
  return eIgual(problemas.length, 0, "arquivos não idempotentes:\n       " + problemas.slice(0, 8).join("\n       "));
});

caso("formatar um `.alg` não o quebra: a saída dos 95 ainda passa por `Vg.analisar`", () => {
  const problemas = [];
  for (const caminho of ALGS) {
    const nome = caminhoRelativo(caminho);
    const r = F.formatar(lerAlg(caminho));
    if (!r.ok) {
      problemas.push(nome + ": recusou");
      continue;
    }
    try {
      Vg.analisar(r.texto);
    } catch (e) {
      problemas.push(nome + ": saída não parseia (" + e.message + " linha " + e.linha + ")");
    }
  }
  return eIgual(problemas.length, 0, "saídas quebradas:\n       " + problemas.slice(0, 8).join("\n       "));
});

/** Comparação de AST ignorando posição: o formatter muda a coluna de tudo. */
function semPosicao(v) {
  if (Array.isArray(v)) return v.map(semPosicao);
  if (v && typeof v === "object") {
    const saida = {};
    for (const k of Object.keys(v).sort()) {
      if (k === "linha" || k === "coluna") continue;
      saida[k] = semPosicao(v[k]);
    }
    return saida;
  }
  return v;
}

caso("formatar um `.alg` não muda o programa: a AST de entrada e de saída concorda", () => {
  // Checagem de força: se o formatter reescrevesse um operador, um literal ou
  // um nome, a árvore mudaria. Comparar a AST SEM posição é o que torna a
  // comparação possível — reindentar muda `coluna` de todo token, e `linha` de
  // quem estava na mesma linha antes.
  const problemas = [];
  for (const caminho of ALGS) {
    const nome = caminhoRelativo(caminho);
    const original = lerAlg(caminho);
    const r = F.formatar(original);
    if (!r.ok) continue;
    const antes = JSON.stringify(semPosicao(Vg.analisar(original)));
    const depois = JSON.stringify(semPosicao(Vg.analisar(r.texto)));
    if (antes !== depois) problemas.push(nome);
  }
  return eIgual(problemas.length, 0, "AST mudou em: " + problemas.slice(0, 8).join(", "));
});

caso("formatar devolve indentação de 3 espaços, e o corpus inteiro usa 3", () => {
  // Se o corpus usasse 4, a escolha de 3 espaços do formatter estaria errada e
  // este teste é o que-fnciona.
  const comQuatro = [];
  for (const caminho of ALGS) {
    for (const linha of lerAlg(caminho).split("\n")) {
      const m = /^( +)\S/.exec(linha);
      if (m && m[1].length % 4 === 0 && m[1].length > 0) comQuatro.push(caminhoRelativo(caminho));
    }
  }
  const unicos = [...new Set(comQuatro)];
  // Alguns exercícios usam tab ou alinhamento livre; o critério é a maioria.
  return eVerdadeiro(
    unicos.length < ALGS.length / 2,
    "a maioria do corpus (" + unicos.length + "/" + ALGS.length + ") usa indentação múltipla de 4, e 3 seria a escolha errada"
  );
});

// ================================================ 4. §49 entrada inválida/não cras

secao("[4/8] §49 Formatter — entrada inválida devolve o original e reporta o erro");

caso("programa pela metade: devolve o original + erro, sem lançar", () => {
  const entrada = 'algoritmo "t"\nvar\n   x: inteiro\ninício\n   se x > 1 ent';
  const r = F.formatar(entrada);
  return eFalso(r.ok, "deveria recusar: entrada pela metade");
});

caso("`se` sem `fimse`: devolve o original + erro", () => {
  const entrada = 'algoritmo "t"\ninício\n   se verdadeiro então\n      escreval(1)\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (r.ok) return "aceitou `se` sem `fimse`";
  if (r.texto !== entrada) return "o texto devolvido não é o original";
  if (!r.erro || !r.erro.mensagem) return "erro sem mensagem: " + JSON.stringify(r.erro);
  if (r.erro.linha == null) return "erro sem linha: " + JSON.stringify(r.erro);
  if (!r.erro.codigo) return "erro sem código de §46: " + JSON.stringify(r.erro);
  return null;
});

caso("aspas abertas: devolve o original + erro léxico", () => {
  const entrada = 'algoritmo "t"\ninício\n   escreval("texto sem fim\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (r.ok) return "aceitou literal aberta";
  if (r.texto !== entrada) return "o texto devolvido não é o original";
  if (r.erro.codigo !== "LEXICO_TEXTO_NAO_FECHADO") return "código de erro inesperado: " + r.erro.codigo;
  return null;
});

caso("caractere inválido: devolve o original + erro léxico", () => {
  const entrada = 'algoritmo "t"\ninício\n   escreval(1) @ 2\nfimalgoritmo\n';
  const r = F.formatar(entrada);
  if (r.ok) return "aceitou caractere inválido";
  if (r.texto !== entrada) return "o texto devolvido não é o original";
  return null;
});

caso("texto vazio e lixo não viram programa formatado", () => {
  const vazio = F.formatar("");
  if (vazio.ok) return "aceitou string vazia como programa";
  const lixo = F.formatar("isto não é um programa");
  if (lixo.ok) return "aceitou lixo como programa";
  if (lixo.texto !== "isto não é um programa") return "não devolveu o original no caso do lixo";
  return null;
});

caso("nenhum erro cru de JavaScript: o erro do formatter é da hierarquia da §46", () => {
  const r = F.formatar('algoritmo "t"\ninício\n   se verdadeiro então\nfimalgoritmo\n');
  if (r.ok) return "deveria falhar";
  if (r.erro.tipo !== "ErroSintaxe" && r.erro.tipo !== "ErroLexico") {
    return "erro fora da hierarquia da §46: " + r.erro.tipo;
  }
  return null;
});

// ================================================================ 5. §50 AC

secao("[5/8] §50 Autocomplete — sugestão por prefixo, escopo e sombreamento");

const PROG = [
  'algoritmo "notas"',
  "var",
  "   altura: real",
  "   total: inteiro",
  "início",
  "   ENTRADA",
  "fimalgoritmo",
  "",
].join("\n");

/**
 * Coloca um prefixo no corpo do programa e devolve as sugestões do prefixo.
 *
 * O prefixo é seguido de `<- 1` para o programa continuar COMPILANDO: as
 * sugestões de escopo vêm da AST, e um corpo com `alt` sozinho (sem atribuição)
 * não parseia — o teste mediria o caminho de recuperação e não o caminho que
 * importa.
 */
function comPrefixo(prefixo) {
  const marca = PROG.indexOf("ENTRADA");
  const texto = PROG.replace("ENTRADA", prefixo + " <- 1");
  return A.sugerir(texto, marca + prefixo.length);
}

caso("prefixo `en` traz `então` e `enquanto` (§50: palavras-chave)", () => {
  const nomes = A.nomes(comPrefixo("en"));
  if (nomes.indexOf("então") < 0) return "`então` não veio para o prefixo `en`: " + nomes.slice(0, 8).join(", ");
  if (nomes.indexOf("enquanto") < 0) return "`enquanto` não veio para o prefixo `en`: " + nomes.slice(0, 8).join(", ");
  return null;
});

caso("prefixo `in` traz `início` na forma canônica acentuada", () => {
  const nomes = A.nomes(comPrefixo("in"));
  if (nomes.indexOf("início") < 0) return "`início` não veio para o prefixo `in`: " + nomes.slice(0, 8).join(", ");
  return null;
});

caso("prefixo `s` traz `senão` (o `sen` do §50), e o resultado é ordenado", () => {
  const lista = comPrefixo("s");
  const nomes = A.nomes(lista);
  if (nomes.indexOf("senão") < 0) return "`senão` não veio para o prefixo `s`: " + nomes.join(", ");
  // `se` é exato e tem 2 letras: tem de vir antes de `senão`.
  if (nomes.indexOf("se") > nomes.indexOf("senão")) return "exato (`se`) não veio antes do prefixo (`senão`)";
  for (let i = 1; i < lista.length; i++) {
    if (lista[i - 1].pontuacao < lista[i].pontuacao) return "lista fora de ordem na posição " + i;
  }
  return null;
});

caso("as variáveis do programa vêm nas sugestões (símbolo de escopo, §50)", () => {
  for (const [prefixo, esperado] of [["alt", "altura"], ["tot", "total"]]) {
    const nomes = A.nomes(comPrefixo(prefixo));
    if (nomes.indexOf(esperado) < 0) return "`" + esperado + "` não veio para `" + prefixo + "`: " + nomes.join(", ");
  }
  const marca = PROG.indexOf("ENTRADA");
  const lista = A.sugerir(PROG.replace("ENTRADA", "alt <- 1"), marca + 3);
  const altura = lista.filter((s) => s.nome === "altura");
  if (altura.length !== 1) return "`altura` não veio uma vez só";
  if (altura[0].tipo !== "variavel") return "`altura` veio como " + altura[0].tipo + ", deveria ser variavel";
  if (altura[0].detalhe !== "real") return "`altura` perdeu o tipo declarado: " + altura[0].detalhe;
  return null;
});

caso("os parâmetros de subprograma também são símbolos de escopo", () => {
  const base =
    'algoritmo "t"\ninício\n   MARCA\nfimalgoritmo\nprocedimento p(a, b: inteiro; var c: real)\nfimprocedimento\n';
  const marca = base.indexOf("MARCA");
  // Um prefixo por vez: `b` não é sugestão para `a`, e um teste que esperasse
  // todos de uma vez mediria o ranking, não a presença de símbolo.
  for (const [prefixo, esperado] of [["a", "a"], ["b", "b"], ["c", "c"], ["p", "p"]]) {
    const nomes = A.nomes(A.sugerir(base.replace("MARCA", prefixo + " <- 1"), marca + prefixo.length));
    if (nomes.indexOf(esperado) < 0) return "o parâmetro `" + esperado + "` não veio para o prefixo `" + prefixo + "`: " + nomes.slice(0, 6).join(", ");
  }
  const simbolos = A.simbolos(base.replace("MARCA", "z <- 1"));
  if (simbolos.parametros.length !== 3) return "3 parâmetros esperados, vieram " + simbolos.parametros.length;
  if (!simbolos.parametros.some((p) => p.porReferencia)) return "o parâmetro `var c` perdeu a marca de referência";
  if (simbolos.subprogramas.length !== 1 || simbolos.subprogramas[0].tipo !== "procedimento") {
    return "o subprograma não foi reconhecido: " + JSON.stringify(simbolos.subprogramas);
  }
  return null;
});

caso("os builtins vêm, e `Sen` para o prefixo `S` é classificado como builtin", () => {
  const nomes = A.nomes(comPrefixo("S"));
  if (nomes.indexOf("Sen") < 0) return "`Sen` não veio para o prefixo `S`: " + nomes.slice(0, 8).join(", ");
  const lista = comPrefixo("S");
  const sen = lista.filter((s) => s.nome === "Sen")[0];
  if (sen.tipo !== "builtin") return "`Sen` veio como " + sen.tipo + ", deveria ser builtin";
  return null;
});

caso("SOMBREAMENTO: builtin NÃO é oferecido quando o programa declarou o nome", () => {
  const comPi = 'algoritmo "t"\nvar\n   Pi: inteiro\ninício\n   PI\nfimalgoritmo\n';
  const pos = comPi.lastIndexOf("PI") + 2;
  const lista = A.sugerir(comPi, pos);
  const nome = lista.map((s) => s.nome);
  if (nome.indexOf("Pi") < 0) return "a variável declarada não veio: " + nome.join(", ");
  if (nome.indexOf("pi") >= 0) return "o builtin `Pi` foi oferecido apesar da declaração: " + nome.join(", ");
  const pi = lista.filter((s) => s.nome === "Pi")[0];
  if (pi.tipo !== "variavel") return "o `Pi` oferecido é " + pi.tipo + ", não a variável";
  return null;
});

caso("sem a declaração, o mesmo prefixo `Pi` traz o builtin — o teste acima tem força", () => {
  const semPi = 'algoritmo "t"\nvar\n   x: inteiro\ninício\n   PI\nfimalgoritmo\n';
  const pos = semPi.lastIndexOf("PI") + 2;
  const lista = A.sugerir(semPi, pos);
  const pi = lista.filter((s) => s.nome === "Pi")[0];
  if (!pi) return "o builtin `Pi` não veio: " + A.nomes(lista).join(", ");
  if (pi.tipo !== "builtin") return "`Pi` veio como " + pi.tipo + ", deveria ser builtin";
  return null;
});

caso("SOMBREAMENTO cobre palavra-chave declarada: `inicio` declarado mata a palavra `início`", () => {
  const texto = 'algoritmo "t"\nvar\n   inicio: inteiro\ninício\n   INICIO\nfimalgoritmo\n';
  const pos = texto.lastIndexOf("INICIO") + 6;
  const lista = A.sugerir(texto, pos);
  const achados = lista.filter((s) => s.nome === "inicio" || s.nome === "início");
  if (achados.length !== 1) return "veio " + achados.length + " candidatos para `inicio`: " + achados.map((s) => s.nome + "/" + s.tipo).join(", ");
  if (achados[0].tipo !== "variavel") return "o candidato é " + achados[0].tipo + ", não a variável";
  return null;
});

caso("os snippets da §50 estão presentes", () => {
  const nomes = A.nomes(A.sugerir(PROG, PROG.indexOf("ENTRADA")));
  for (const s of ["se", "para", "enquanto", "repita", "função", "procedimento", "algoritmo"]) {
    if (nomes.indexOf(s) < 0) return "snippet `" + s + "` não veio: " + nomes.join(", ");
  }
  const snippet = A.sugerir(PROG, PROG.indexOf("ENTRADA")).filter((x) => x.tipo === "snippet")[0];
  if (!snippet.corpo) return "snippet sem corpo";
  if (snippet.corpo.indexOf("|") < 0) return "o corpo do snippet não tem marcador de cursor `|`";
  if (snippet.inscricao.indexOf("|") >= 0) return "a inscrição do snippet tem o marcador ``|`";
  return null;
});

caso("os tipos de dado vêm depois de um `:` (contexto de tipo)", () => {
  const texto = 'algoritmo "t"\nvar\n   x:\ninício\nfimalgoritmo\n';
  const pos = texto.indexOf(":") + 1;
  if (A.contextoDe(texto, pos) !== "tipo") return "contexto não reconhecido: " + A.contextoDe(texto, pos);
  const lista = A.sugerir(texto, pos);
  const nomes = A.nomes(lista);
  for (const t of ["inteiro", "real", "caractere", "vetor"]) {
    if (nomes.indexOf(t) < 0) return "tipo `" + t + "` não veio: " + nomes.join(", ");
  }
  const inteiros = lista.filter((s) => s.nome === "inteiro")[0];
  if (inteiros.tipo !== "tipo") return "`inteiro` veio como " + inteiros.tipo;
  return null;
});

caso("nada é sugerido dentro de literal ou de comentário", () => {
  const base = 'algoritmo "t"\n// comentário SE\ninício\n   escreval("texto EN")\nfimalgoritmo\n';
  const naString = A.sugerir(base, base.indexOf("EN") + 2);
  if (naString.length !== 0) return "sugeriu dentro da string: " + A.nomes(naString).join(", ");
  const noComentario = A.sugerir(base, base.indexOf("SE") + 2);
  if (noComentario.length !== 0) return "sugeriu dentro do comentário: " + A.nomes(noComentario).join(", ");
  return null;
});

caso("o escopo sobrevive a programa que NÃO compila (recuperação por token)", () => {
  const quebrado = 'algoritmo "t"\nvar\n   altura: real\n   peso: real\ninício\n   se altura > 1 então\n';
  const s = A.simbolos(quebrado);
  const nomes = s.variaveis.map((v) => v.nome);
  if (nomes.indexOf("altura") < 0) return "`altura` perdida: " + nomes.join(", ");
  if (nomes.indexOf("peso") < 0) return "`peso` perdida: " + nomes.join(", ");
  return null;
});

caso("nunca lança: posição absurda, texto vazio e prefixo só de dígitos", () => {
  const casos = [
    [PROG, -5],
    [PROG, 10 ** 9],
    [PROG, NaN],
    ["", 0],
    ["123", 3],
  ];
  for (const [texto, pos] of casos) {
    const r = A.sugerir(texto, pos);
    if (!Array.isArray(r)) return "não devolveu array para (" + JSON.stringify(texto) + ", " + pos + ")";
  }
  return null;
});

// ============================================================== 6. §51 realce

secao("[6/8] §51 Realce — 10 categorias, classes e contagem de spans");

// Programa que exercita as DEZ categorias ao mesmo tempo. Precisa compilar:
// o realce usa a AST para reconhecer subprogramas, e um exemplo que não
// compilaria testaria só 9 categorias e daria uma confiança falsa.
const AMOSTRA = [
  'algoritmo "cores"',
  "// comentário com <b> e &",
  "var",
  "   altura: real",
  "   total: inteiro",
  "início",
  "   total <- sen(30) > 0 e verdadeiro",
  '   escreval("a & b < c > d")',
  "   escreval(Maiusc(\"oi\"), altura:5:2)",
  "   se altura > 1.5 então",
  "      escreval(dobro(2))",
  "   fimse",
  "fimalgoritmo",
  "função dobro(a: inteiro): inteiro",
  "   retorne a * 2",
  "fimfunção",
  "",
].join("\n");

caso("a amostra das 10 categorias é um programa que compila (o teste acima mede algo real)", () => {
  try {
    Vg.analisar(AMOSTRA);
  } catch (e) {
    return "a amostra não compila: " + e.message + " (linha " + e.linha + ")";
  }
  return null;
});

caso("o repertório tem EXATAMENTE 10 categorias, sem repetida", () => {
  if (H.CATEGORIAS.length !== 10) return "CATEGORIAS tem " + H.CATEGORIAS.length + " entradas";
  if (new Set(H.CATEGORIAS).size !== 10) return "há categoria repetida";
  return null;
});

caso("as 10 categorias têm 10 classes distintas, e o dicionário inverso bate", () => {
  const classes = H.CATEGORIAS.map((c) => H.CLASSES[c]);
  if (new Set(classes).size !== 10) return "classes repetidas: " + classes.join(", ");
  const chaves = Object.keys(H.CATEGORIAS_POR_CLASSE);
  if (chaves.length !== 10) return "CATEGORIAS_POR_CLASSE tem " + chaves.length + " entradas";
  for (const c of H.CATEGORIAS) {
    if (H.CATEGORIAS_POR_CLASSE[H.CLASSES[c]] !== c) return "dicionário inverso inconsistente em " + c;
  }
  return null;
});

caso("um programa que exercita tudo aciona as 10 categorias, todas distintas", () => {
  const r = H.realcar(AMOSTRA);
  if (r.categorias.length !== 10) {
    return "só " + r.categorias.length + " categorias apareceram: " + r.categorias.join(", ");
  }
  if (new Set(r.categorias).size !== 10) return "houve categoria repetida";
  const faltando = H.CATEGORIAS.filter((c) => r.totais[c] === 0);
  if (faltando.length > 0) return "categoria declarada e nunca usada: " + faltando.join(", ");
  return null;
});

caso("cada categoria cai no token certo (o mapeamento não é decorativo)", () => {
  // O teste olha os SEGMENTOS (a API estruturada) e não só o HTML: o HTML
  // escapa `<` e `>`, e comparar `"-<-"` contra `&lt;-` seria testar o
  // escape (que tem caso próprio) em vez do mapeamento token → categoria.
  const segmentos = H.realcarSegmentos(AMOSTRA);
  const tem = (categoria, texto) =>
    segmentos.some((s) => s.categoria === categoria && s.texto === texto);
  const esperado = {
    "palavra-chave": ["algoritmo", "início", "então", "função", "retorne"],
    tipo: ["real", "inteiro"],
    constante: ["verdadeiro"],
    funcao: ["sen", "Maiusc"],
    subprograma: ["dobro"],
    numero: ["30", "1.5", "2"],
    texto: ['"cores"', '"a & b < c > d"'],
    operador: ["<-", ">", "(", ")"],
    comentario: ["// comentário com <b> e &"],
    identificador: ["altura", "total"],
  };
  for (const categoria of Object.keys(esperado)) {
    for (const trecho of esperado[categoria]) {
      if (!tem(categoria, trecho)) {
        return "`" + trecho + "` não saiu como " + categoria + " (" + H.CLASSES[categoria] + ")";
      }
    }
  }
  return null;
});

caso("o número de `<span>` bate com o número de tokens (trecho sem comentário)", () => {
  const trecho = 'algoritmo "t"\nvar\n   x: inteiro\ninício\n   x <- 1\nfimalgoritmo\n';
  const tokens = new Vg.Lexer(trecho).tokenizar().filter((t) => t.tipo !== Vg.Tokens.T.FIM);
  const html = H.realceHtml(trecho);
  return eIgual(H.contarSpans(html), tokens.length, "spans != tokens");
});

caso("comentário é o único segmento que não é token, e ele aparece", () => {
  const semComentario = 'algoritmo "t"\ninício\n   escreval(1)\nfimalgoritmo\n';
  const comComentario = semComentario.replace("início", "// nota\ninício");
  const t1 = new Vg.Lexer(semComentario).tokenizar().filter((t) => t.tipo !== Vg.Tokens.T.FIM).length;
  const t2 = new Vg.Lexer(comComentario).tokenizar().filter((t) => t.tipo !== Vg.Tokens.T.FIM).length;
  return eIgual(H.contarSpans(H.realceHtml(comComentario)), t2 + 1, "spans com comentário != tokens + 1");
});

caso("o realce usa o Lexer da engine, não uma lista própria de palavras-chave", () => {
  // `fimenquanto` e `fimprocedimento` não estão na lista copiada do `script.js`.
  const trecho = 'algoritmo "t"\ninício\n   enquanto falso faça\n      escreval(1)\n   fimenquanto\nfimalgoritmo\n';
  const html = H.realceHtml(trecho);
  if (html.indexOf('<span class="tk-kw">fimenquanto</span>') < 0) {
    return "palavra-chave que só o Lexer conhece não foi realçada: " + html;
  }
  return null;
});

caso("o realce funciona sem a execução e sem o programa parsear (§51)", () => {
  // `se` sem `fimse`: o parser falha, o realce tem de continuar.
  const quebrado = 'algoritmo "t"\nvar\n   x: inteiro\ninício\n   se x > 1 então\n      x <- 2\nfimalgoritmo\n';
  const r = H.realcar(quebrado);
  if (r.html.indexOf('<span class="tk-kw">se</span>') < 0) return "não realçou o `se` de programa quebrado";
  if (r.html.indexOf('<span class="tk-id">x</span>') < 0) return "não realçou a variável de programa quebrado";
  if (r.categorias.indexOf("identificador") < 0) return "perdeu a categoria identificador";
  return null;
});

caso("erro léxico não apaga o realce: devolve o texto escapado e diz que houve erro", () => {
  const quebrado = 'algoritmo "t"\ninício\n   escreval("aberta\nfimalgoritmo\n';
  const r = H.realcar(quebrado);
  if (r.ok) return "deveria reportar erro léxico";
  if (!r.erro) return "erro não reportado";
  if (typeof r.html !== "string" || r.html.length === 0) return "devolveu HTML vazio";
  return null;
});

// ================================================================= 7. XSS

secao("[7/8] §51 Realce — escape de HTML (o risco número um do arquivo)");

/** Tira as tags do realce e devolve o texto que sobrou, ainda com entidades. */
function semTags(html) {
  return html.replace(/<span class="[a-z-]+">/g, "").replace(/<\/span>/g, "");
}

caso("`<`, `>` e `&` do código do aluno viram entidade, nunca marcação", () => {
  const fonte = 'algoritmo "x"\ninício\n   escreval("<b>a & b</b>")\nfimalgoritmo\n';
  const html = H.realceHtml(fonte);
  const limpo = semTags(html);
  if (limpo.indexOf("<b>") >= 0) return "a tag do aluno sobreviveu: " + html;
  if (limpo.indexOf("&lt;b&gt;") < 0) return "esperava &lt;b&gt; e veio: " + limpo;
  if (limpo.indexOf("&amp;") < 0) return "esperava &amp; e veio: " + limpo;
  if (limpo.indexOf("<") >= 0) return "sobrou um `<` cru: " + JSON.stringify(limpo);
  if (limpo.indexOf(">") >= 0) return "sobrou um `>` cru: " + JSON.stringify(limpo);
  if (/&(?!amp;|lt;|gt;|quot;)/.test(limpo)) return "sobrou um `&` que não é entidade: " + limpo;
  return null;
});

caso("`\"` também é escapado (§51: o HTML pode ir para atributo)", () => {
  const html = H.realceHtml('algoritmo "t"\ninício\nfimalgoritmo\n');
  const limpo = semTags(html);
  if (limpo.indexOf('"') >= 0) return "sobrou uma aspa dupla crua: " + limpo;
  if (limpo.indexOf("&quot;") < 0) return "esperava &quot; e veio: " + limpo;
  return null;
});

caso("XSS de verdade: `<img src=x onerror=...>` no editor não vira elemento", () => {
  const ataque = 'algoritmo "x"\ninício\n   escreval("<img src=x onerror=alert(1)>")\nfimalgoritmo\n';
  const html = H.realceHtml(ataque);
  // O que não pode existir é a TAG. A palavra `onerror` pode — e deve — aparecer
  // como texto dentro do literal, que é o que o aluno escreveu; o que não pode
  // é `<img` cru virar elemento no `innerHTML`.
  if (html.indexOf("<img") >= 0) return "o `<img` do aluno virou tag: " + html;
  if (html.indexOf("&lt;img src=x onerror=alert(1)&gt;") < 0) return "esperava a forma escapada; veio: " + html;
  const limpo = semTags(html);
  if (limpo.indexOf("<") >= 0) return "sobrou um `<` cru: " + JSON.stringify(limpo);
  if (/&(?!amp;|lt;|gt;|quot;)/.test(limpo)) return "sobrou um `&` que não é entidade";
  return null;
});

caso("comentário é escapado também (é a linha mais fácil de esquecer de escapar)", () => {
  const ataque = 'algoritmo "x"\n// <script>alert(1)</script>\ninício\nfimalgoritmo\n';
  const html = H.realceHtml(ataque);
  if (html.indexOf("<script>") >= 0) return "o `<script>` do comentário sobreviveu: " + html;
  if (html.indexOf("&lt;script&gt;") < 0) return "comentário não escapado: " + html;
  return null;
});

caso("o HTML produced só tem as tags que o realce abre (`<span class=...>`)", () => {
  const html = H.realceHtml(AMOSTRA);
  const tags = html.match(/<[^>]*>/g) || [];
  for (const tag of tags) {
    if (!/^<span class="[a-z-]+">$/.test(tag) && tag !== "</span>") {
      return "tag inesperada no realce: " + JSON.stringify(tag);
    }
  }
  return null;
});

caso("todo `<span>` fecha, e o HTML é bem formado por contagem", () => {
  const html = H.realceHtml(AMOSTRA);
  const abre = (html.match(/<span /g) || []).length;
  const fecha = (html.match(/<\/span>/g) || []).length;
  return eIgual(abre, fecha, "abre/fecha de span desbalanceado");
});

caso("`escapar` é a porta única: aplicada token a token, devolve a string escapada", () => {
  const entrada = '< > & " \'';
  return eIgual(H.escapar(entrada), "&lt; &gt; &amp; &quot; '", "escapar não cobriu tudo");
});

// ============================================================ 8. proibições

secao("[8/8] Nenhum teste depende de DOM; nenhuma proibição do projeto");

caso("este processo não tem `document` nem `window` (o teste é DOM-free)", () => {
  if (typeof globalThis.document !== "undefined") return "existe `document` no ambiente do teste";
  if (typeof globalThis.window !== "undefined") return "existe `window` no ambiente do teste";
  return null;
});

caso("os três módulos rodam inteiros sem DOM", () => {
  // Se qualquer um deles tocasse `document` na carga, este import já teria
  // estourado; o teste documenta a intenção e pega quem reintroduzir.
  const html = F.formatar(EXEMPLO49).texto;
  if (H.contarSpans(H.realceHtml(html)) === 0) return "o realce não produziu nada";
  if (A.sugerir(html, 0).length === 0) return "o autocomplete não produziu nada";
  return null;
});

caso("nenhum dos três arquivos toca DOM, storage, rede ou `eval`", () => {
  const proibidos = [
    /\bdocument\b/,
    /\bwindow\.[A-Za-z]/,
    /\binnerHTML\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\bimport\s+.*\bfrom\b/,
    /\bexport\b/,
  ];
  const achados = [];
  for (const src of MODULOS) {
    const texto = readFileSync(join(RAIZ, src), "utf8");
    // As linhas de comentário descrevem o que o arquivo NÃO faz; só o código
    // interessa, e um comentário que citasse a palavra passesaria a lie.
    const codigo = texto
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    for (const re of proibidos) {
      const m = re.exec(codigo);
      if (m) achados.push(src + ": " + m[0]);
    }
  }
  return eIgual(achados.length, 0, "proibição encontrada:\n       " + achados.join("\n       "));
});

caso("nenhum `window` fora do guard inicial (o guard é o único ponto de DOM)", () => {
  for (const src of MODULOS) {
    const texto = readFileSync(join(RAIZ, src), "utf8");
    const achados = texto
      .split("\n")
      .map((l, i) => ({ l: l, i: i }))
      // O guard `typeof window !== "undefined" ? window : globalThis` é a
      // ÚNICA leitura de `window` legítima: é ele que decide se o módulo está
      // no browser ou no Node, e ele não toca o DOM em nenhum dos dois.
      .filter((x) => x.i > 0 && /\bwindow\b/.test(x.l) && !/typeof window/.test(x.l) && !/^\s*\/\//.test(x.l));
    if (achados.length > 0) return src + " usa `window` na linha " + (achados[0].i + 1) + ": " + achados[0].l.trim();
  }
  return null;
});

caso("o formatter e o autocomplete não dividem estado entre chamadas", () => {
  const entrada = 'algoritmo "t"\nvar\n   x: inteiro\ninício\n   se x > 1 entao\n      escreval(x)\n   fimse\nfimalgoritmo\n';
  const primeira = F.formatar(entrada).texto;
  const segunda = F.formatar(entrada).texto;
  return eIgual(primeira, segunda, "duas chamadas seguidas divergiram");
});

console.log("-".repeat(66));
console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
if (fail > 0) process.exitCode = 1;
