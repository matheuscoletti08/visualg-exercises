#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const DIR_TOOLS = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR_TOOLS, "..");
const PASTAS = ["faccat", "manzano"];
let total = 0;
let pass = 0;
let fail = 0;
function ver(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
function falha(msg, obtido) {
  const e = new Error(obtido === undefined ? msg : msg + "  [obtido: " + ver(obtido) + "]");
  e.falhaDeTeste = true;
  return e;
}
function eIgual(obtido, esperado, msg) {
  if (ver(obtido) !== ver(esperado)) {
    throw falha(msg + " (esperado " + ver(esperado) + ")", obtido);
  }
}
function eVerdadeiro(cond, msg, obtido) {
  if (!cond) throw falha(msg, obtido);
}
function registra(nome, erro) {
  total++;
  if (erro) {
    fail++;
    console.log("  ❌ " + nome);
    console.log("       → " + (erro.message || String(erro)));
  } else {
    pass++;
    console.log("  ✅ " + nome);
  }
}
function titulo(t) {
  console.log("");
  console.log(t);
  console.log("-".repeat(66));
}
for (const arquivo of ["lexer.js", "parser.js", "interpreter.js"]) {
  await import(pathToFileURL(path.join(RAIZ, "interpreter", arquivo)).href);
}
const VgLexer = globalThis.VgLexer;
const VgParser = globalThis.VgParser;
const Vg = globalThis.Vg;
if (typeof VgLexer !== "function" || typeof VgParser !== "function" || !Vg || typeof Vg.executar !== "function") {
  console.error("❌ Não consegui carregar VgLexer/VgParser/Vg de interpreter/*.js");
  process.exit(1);
}
function lerArquivo(caminho) {
  const buf = fs.readFileSync(caminho);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}
function listarAlgs(dir) {
  const saida = [];
  if (!fs.existsSync(dir)) return saida;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...listarAlgs(p));
    else if (e.name.toLowerCase().endsWith(".alg")) saida.push(p);
  }
  return saida.sort();
}
function parsear(codigo) {
  const tokens = new VgLexer(codigo).tokenizar();
  return new VgParser(tokens).parse();
}
async function rodar(codigo, opcoes) {
  const o = opcoes || {};
  const pedacos = [];
  const r = await Vg.executar(codigo, {
    saida: (t) => {
      pedacos.push(t);
    },
    entrada: typeof o.entrada === "function" ? o.entrada : () => Promise.resolve("5"),
    deveParar: typeof o.deveParar === "function" ? o.deveParar : () => false,
    maxPassos: typeof o.maxPassos === "number" ? o.maxPassos : undefined
  });
  return { r: r, saida: pedacos };
}
const arquivos = PASTAS.flatMap((d) => listarAlgs(path.join(RAIZ, d)));
const asts = new Map();
titulo("[1/3] Varredura de parse — " + arquivos.length + " arquivos (.alg/.ALG)");
let parseOk = 0;
for (const arquivo of arquivos) {
  const rel = path.relative(RAIZ, arquivo);
  try {
    asts.set(arquivo, parsear(lerArquivo(arquivo)));
    parseOk++;
  } catch (e) {
    asts.set(arquivo, null);
    total++;
    fail++;
    console.log("  ❌ " + rel);
    console.log(
      "       → linha " + (e && e.linha !== undefined && e.linha !== null ? e.linha : "?") + ": " +
        ((e && e.mensagem) || (e && e.message) || String(e))
    );
  }
}
if (parseOk === arquivos.length) {
  total++;
  pass++;
  console.log("  ✅ " + parseOk + "/" + arquivos.length + " parseiam sem erro");
} else {
  console.log("  ❌ parse: " + parseOk + "/" + arquivos.length + " OK, " + (arquivos.length - parseOk) + " com erro");
}
const SEQUENCIA = ["5", "10", "2.5", "A", "NAO", "100", "3", "7", "-2"];
const MODO_LITERAL = process.argv.indexOf("--literal") >= 0;
const arquivosComPulo = new Set();
function servePara(tipo, valor) {
  if (tipo === undefined || tipo === null) return true;
  if (tipo === "inteiro" || tipo === "real") return /^-?\d+(\.\d+)?$/.test(String(valor).trim());
  if (tipo === "caractere" || tipo === "literal") return true;
  if (tipo === "logico") return /^(verdadeiro|falso|v|f)$/i.test(String(valor).trim());
  return true;
}
function criarEntrada(tipos, arquivo) {
  let i = 0;
  return (prompt) => {
    if (MODO_LITERAL) {
      const v = SEQUENCIA[i % SEQUENCIA.length];
      i++;
      return Promise.resolve(v);
    }
    const nome = String(prompt).replace(/^Entre com o valor de\s*/i, "").trim().toLowerCase();
    const tipo = tipos ? tipos.get(nome) : undefined;
    for (let n = 0; n < SEQUENCIA.length; n++) {
      const v = SEQUENCIA[(i + n) % SEQUENCIA.length];
      if (servePara(tipo, v)) {
        if (n > 0) arquivosComPulo.add(arquivo);
        i = (i + n + 1) % SEQUENCIA.length;
        return Promise.resolve(v);
      }
    }
    const v = SEQUENCIA[i % SEQUENCIA.length];
    i = (i + 1) % SEQUENCIA.length;
    return Promise.resolve(v);
  };
}
function tiposDoPrograma(ast) {
  const m = new Map();
  if (ast && Array.isArray(ast.variaveis)) {
    for (const d of ast.variaveis) m.set(String(d.nome).toLowerCase(), d.tipo);
  }
  return m;
}
function resultadoAceito(r) {
  if (r && r.ok === true) return "ok";
  if (r && r.ok === false && r.interrompido === true) return "interrompido";
  if (r && r.ok === false && r.erro && /Possível loop infinito/i.test(r.erro.mensagem || "")) return "loop infinito";
  return null;
}
titulo(
  "[2/3] Execução smoke — " + arquivos.length +
    " arquivos (entrada fake" + (MODO_LITERAL ? " literal" : " por tipo") + ", deveParar = false)"
);
const contagem = { ok: 0, interrompido: 0, "loop infinito": 0 };
const porCategoria = { interrompido: [], "loop infinito": [] };
let smokeOk = 0;
for (const arquivo of arquivos) {
  const rel = path.relative(RAIZ, arquivo);
  let r;
  try {
    r = await Vg.executar(lerArquivo(arquivo), {
      saida: () => {},
      entrada: criarEntrada(tiposDoPrograma(asts.get(arquivo)), rel),
      deveParar: () => false
    });
  } catch (e) {
    r = { ok: false, erro: { linha: null, mensagem: (e && e.message) || String(e) } };
  }
  const categoria = resultadoAceito(r);
  if (categoria) {
    contagem[categoria]++;
    if (porCategoria[categoria]) porCategoria[categoria].push(rel);
    smokeOk++;
    total++;
    pass++;
  } else {
    total++;
    fail++;
    console.log("  ❌ " + rel);
    console.log(
      "       → " +
        (r && r.erro
          ? "linha " + (r.erro.linha === null || r.erro.linha === undefined ? "?" : r.erro.linha) + ": " + r.erro.mensagem
          : ver(r))
    );
  }
}
console.log(
  "  " + (smokeOk === arquivos.length ? "✅" : "❌") + " " + smokeOk + "/" + arquivos.length +
    "  (ok: " + contagem.ok + " | interrompido: " + contagem.interrompido +
    " | loop infinito: " + contagem["loop infinito"] + ")"
);
for (const cat of ["interrompido", "loop infinito"]) {
  if (porCategoria[cat].length > 0) {
    console.log("  ℹ️  " + cat + ": " + porCategoria[cat].join(", "));
  }
}
if (MODO_LITERAL) {
  console.log("  ℹ️  entrada fake: ciclo literal " + ver(SEQUENCIA) + " (modo --literal)");
} else if (arquivosComPulo.size > 0) {
  console.log(
    "  ℹ️  entrada fake: ciclo " + ver(SEQUENCIA) + " — " + arquivosComPulo.size +
      " arquivo(s) precisaram de valor adaptado ao tipo da variável (ex.: \"A\" num inteiro)"
  );
}
const testes = [];
function T(nome, fn) {
  testes.push({ nome: nome, fn: fn });
}
T("formatação largura + casas: escreval(\"x: \", v:6:2)", async () => {
  const { r, saida } = await rodar(`
Algoritmo "fmt_casas"
Var
   v: real
Inicio
   v <- 3.14159
   escreval("x: ", v:6:2)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["x: ", "  3.14", "\n"], "largura 6 + toFixed(2)");
});
T("formatação só largura: escreval(\"v: \", v:4)", async () => {
  const { r, saida } = await rodar(`
Algoritmo "fmt_largura"
Var
   v: inteiro
Inicio
   v <- 12
   escreval("v: ", v:4)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["v: ", "  12", "\n"], "padStart(4)");
});
T("string com ':' dentro NÃO é formatação", async () => {
  const { r, saida } = await rodar(`
Algoritmo "fmt_string"
Var
   v: inteiro
Inicio
   v <- 5
   escreval("V1:10")
   escreval("V1: ", v)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["V1:10", "\n", "V1: ", "5", "\n"], "textos com ':' devem sair literal");
});
T("escreval quebra linha, escreva não", async () => {
  const { r, saida } = await rodar(`
Algoritmo "nl"
Inicio
   escreva("a")
   escreva("b")
   escreval("c")
   escreval("d")
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["a", "b", "c", "\n", "d", "\n"], "escreva sem \\n, escreval com \\n");
});
T("se/senao aninhado", async () => {
  const { r, saida } = await rodar(`
Algoritmo "se_aninhado"
Var
   x: inteiro
Inicio
   x <- 5
   se x > 3 entao
      se x > 10 entao
         escreval("M")
      senao
         se x > 4 entao
            escreval("N")
         senao
            escreval("O")
         fimse
      fimse
   senao
      escreval("P")
   fimse
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["N", "\n"], "x=5 deve cair no ramo N");
});
T("enquanto...faca...fimenquanto", async () => {
  const { r, saida } = await rodar(`
Algoritmo "enquanto"
Var
   i: inteiro
   s: inteiro
Inicio
   i <- 0
   s <- 0
   enquanto (i < 5) faca
      s <- s + i
      i <- i + 1
   fimenquanto
   escreval("s=", s)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["s=", "10", "\n"], "soma de 0..4");
});
T("para...de...ate (passo padrão)", async () => {
  const { r, saida } = await rodar(`
Algoritmo "para_pos"
Var
   i: inteiro
   soma: inteiro
Inicio
   soma <- 0
   para i de 1 ate 5 faca
      soma <- soma + i
   fimpara
   escreval(soma)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["15", "\n"], "1+2+3+4+5");
});
T("para...de...ate...passo -1 (negativo)", async () => {
  const { r, saida } = await rodar(`
Algoritmo "para_neg"
Var
   i: inteiro
   t: literal
Inicio
   t <- ""
   para i de 5 ate 1 passo -1 faca
      t <- t + i + ","
   fimpara
   escreval(t)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["5,4,3,2,1,", "\n"], "contagem decrescente");
});
T("repita...ate", async () => {
  const { r, saida } = await rodar(`
Algoritmo "repita"
Var
   n: inteiro
Inicio
   n <- 0
   repita
      n <- n + 1
   ate (n >= 3)
   escreval(n)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["3", "\n"], "roda 3 vezes");
});
T("aritmética: 6/3 atribuído a inteiro = 2", async () => {
  const { r, saida } = await rodar(`
Algoritmo "div_int"
Var
   i: inteiro
Inicio
   i <- 6 / 3
   escreval(i)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["2", "\n"], "divisão exata em inteiro");
});
T("aritmética: 7%3 = 1", async () => {
  const { r, saida } = await rodar(`
Algoritmo "resto"
Var
   r: inteiro
Inicio
   r <- 7 % 3
   escreval(r)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["1", "\n"], "resto da divisão");
});
T("leia de real aceita vírgula decimal", async () => {
  const { r, saida } = await rodar(
    `
Algoritmo "real_virgula"
Var
   x: real
Inicio
   leia(x)
   escreval(x)
Fimalgoritmo
`,
    { entrada: () => Promise.resolve("2,75") }
  );
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["2.75", "\n"], "\"2,75\" vira 2.75");
});
T("concatenação de texto com +", async () => {
  const { r, saida } = await rodar(`
Algoritmo "concat"
Var
   t: literal
Inicio
   t <- "total: " + 42
   escreval(t)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["total: 42", "\n"], "literal + numero");
});
T("leia de inteiro com \"abc\" → erro com linha", async () => {
  const { r } = await rodar(
    `
Algoritmo "leia_ruim"
Var
   i: inteiro
Inicio
   leia(i)
Fimalgoritmo
`,
    { entrada: () => Promise.resolve("abc") }
  );
  eVerdadeiro(r.ok === false, "esperava ok:false", r);
  eVerdadeiro(!!r.erro, "esperava r.erro", r);
  eVerdadeiro(typeof r.erro.linha === "number", "erro.linha deveria ser number", r.erro);
  eVerdadeiro(/inválido/i.test(r.erro.mensagem || ""), "esperava mensagem de valor inválido", r.erro);
});
T("divisão por zero → erro com linha", async () => {
  const { r } = await rodar(`
Algoritmo "div_zero"
Var
   x: real
Inicio
   x <- 10 / 0
   escreval(x)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === false, "esperava ok:false", r);
  eVerdadeiro(!!r.erro, "esperava r.erro", r);
  eVerdadeiro(typeof r.erro.linha === "number", "erro.linha deveria ser number", r.erro);
  eVerdadeiro(/Divisão por zero/i.test(r.erro.mensagem || ""), "esperava 'Divisão por zero'", r.erro);
});
T("deveParar() true → {ok:false, interrompido:true}", async () => {
  const { r } = await rodar(
    `
Algoritmo "parar"
Var
   i: inteiro
Inicio
   i <- 0
   escreval("oi")
Fimalgoritmo
`,
    { deveParar: () => true }
  );
  eVerdadeiro(r.ok === false && r.interrompido === true, "esperava interrompido", r);
});
T("entrada que rejeita → {ok:false, interrompido:true}", async () => {
  const { r } = await rodar(
    `
Algoritmo "entrada_rejeita"
Var
   i: inteiro
Inicio
   leia(i)
   escreval(i)
Fimalgoritmo
`,
    { entrada: () => Promise.reject(new Error("usuário apertou Parar")) }
  );
  eVerdadeiro(r.ok === false && r.interrompido === true, "esperava interrompido", r);
});
T("maxPassos=500 num laço infinito → erro de loop infinito", async () => {
  const { r } = await rodar(
    `
Algoritmo "loop"
Var
   c: inteiro
Inicio
   c <- 0
   enquanto (1 = 1) faca
      c <- c + 1
   fimenquanto
Fimalgoritmo
`,
    { maxPassos: 500 }
  );
  eVerdadeiro(r.ok === false, "esperava ok:false", r);
  eVerdadeiro(!!r.erro, "esperava r.erro", r);
  eVerdadeiro(/Possível loop infinito/i.test(r.erro.mensagem || ""), "esperava mensagem de loop infinito", r.erro);
  eVerdadeiro(typeof r.erro.linha === "number", "erro.linha deveria ser number", r.erro);
});
T("erro de sintaxe → {ok:false, erro:{linha}}", async () => {
  const { r } = await rodar(`
Algoritmo "sintaxe"
Inicio
   escreval(
Fimalgoritmo
`);
  eVerdadeiro(r.ok === false, "esperava ok:false", r);
  eVerdadeiro(!!r.erro, "esperava r.erro", r);
  eVerdadeiro(typeof r.erro.linha === "number", "erro.linha deveria ser number", r.erro);
  eVerdadeiro(!!r.erro.mensagem, "esperava mensagem de erro", r.erro);
});
T("variável não declarada → erro.linha preenchido", async () => {
  const { r } = await rodar(`
Algoritmo "nao_declarada"
Inicio
   x <- 1
   escreval(x)
Fimalgoritmo
`);
  eVerdadeiro(r.ok === false, "esperava ok:false", r);
  eVerdadeiro(!!r.erro, "esperava r.erro", r);
  eVerdadeiro(typeof r.erro.linha === "number", "erro.linha deveria ser number", r.erro);
  eVerdadeiro(/não declarada/i.test(r.erro.mensagem || ""), "esperava 'não declarada'", r.erro);
});
T("programa mínimo executa com {ok:true}", async () => {
  const { r, saida } = await rodar(`
Algoritmo "minimo"
Inicio
   escreval("olá")
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["olá", "\n"], "saída do programa mínimo");
});
titulo("[3/3] Testes unitários de comportamento — " + testes.length + " casos");
for (const t of testes) {
  try {
    await t.fn();
    registra(t.nome, null);
  } catch (e) {
    registra(t.nome, e);
  }
}
console.log("");
console.log("=".repeat(66));
const status = fail === 0 ? "✅" : "❌";
console.log(status + " RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
console.log("=".repeat(66));
if (fail > 0) process.exitCode = 1;
