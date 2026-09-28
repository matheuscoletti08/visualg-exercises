#!/usr/bin/env node
// Entrypoint da suíte. Toda a lógica de asserção e coleta está em
// `tests/lib/harness.mjs`; o corpus e a decodificação em `tools/lib/corpus.mjs`.
//
// A engine é carregada na ordem declarada em `src/visualg/carga.mjs`, a mesma do
// `index.html`. `node tools/verificar-carga.mjs` garante que as duas concordem.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "./lib/corpus.mjs";
import { Suite, eIgual, eVerdadeiro } from "../tests/lib/harness.mjs";
import { ORDEM_ENGINE } from "../src/visualg/carga.mjs";

const su = new Suite();

// 1. Carrega a engine na ordem do contrato de carga.
for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
const Vg = globalThis.Vg;
if (!Vg || typeof Vg.executar !== "function") {
  console.error("❌ Não consegui carregar W.Vg de: " + ORDEM_ENGINE.join(", "));
  process.exit(1);
}

function parsear(codigo) {
  return Vg.analisar(codigo);
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
    maxPassos: typeof o.maxPassos === "number" ? o.maxPassos : undefined,
  });
  return { r, saida: pedacos };
}

const arquivos = todosAlgs();

// ---------------------------------------------------------------- fase 1: parse
su.secao("[1/3] Varredura de parse — " + arquivos.length + " arquivos (.alg/.ALG)");
let parseOk = 0;
for (const arquivo of arquivos) {
  const rel = caminhoRelativo(arquivo);
  try {
    parsear(lerAlg(arquivo));
    parseOk++;
  } catch (e) {
    su.registrar(
      rel,
      new Error(
        "linha " + (e && e.linha !== undefined && e.linha !== null ? e.linha : "?") + ": " +
          ((e && e.mensagem) || (e && e.message) || String(e))
      )
    );
  }
}
if (parseOk === arquivos.length) {
  su.registrar(parseOk + "/" + arquivos.length + " parseiam sem erro", null);
} else {
  console.log("  ❌ parse: " + parseOk + "/" + arquivos.length + " OK, " + (arquivos.length - parseOk) + " com erro");
}
su.categoria("varredura de parse", 1);

// ----------------------------------------------------------------- fase 2: smoke
// Entrada fake. Estos programas pedem valores que não existem; o objetivo aqui é
// só que a engine não exploda, não que o resultado seja algoritmicamente certo.
const SEQUENCIA = ["5", "10", "2.5", "A", "NAO", "100", "3", "7", "-2"];
const MODO_LITERAL = process.argv.includes("--literal");
const arquivosComPulo = new Set();

/**
 * O valor do ciclo serve para o tipo declarado?
 *
 * `inteiro` exige inteiro DE VERDADE. A regex antiga aceitava `2.5` para
 * `inteiro` porque o runtime antigo truncava com `Math.trunc` — aí o harness
 * "funcionava" escondendo que estava feeding entrada inválida. Com a coerção
 * nova, `2.5` num `inteiro` é erro, corretamente.
 */
function servePara(tipo, valor) {
  if (tipo === undefined || tipo === null) return true;
  if (tipo === "inteiro") return /^-?\d+$/.test(String(valor).trim());
  if (tipo === "real") return /^-?\d+(\.\d+)?$/.test(String(valor).trim());
  if (tipo === "caractere" || tipo === "literal") return true;
  if (tipo === "logico") return /^(verdadeiro|falso|v|f)$/i.test(String(valor).trim());
  // vetor/matriz não são preenchidos por `leia` no teste smoke.
  return false;
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

/**
 * Mapa nome -> tipo, para a entrada fake escolher valor do tipo certo.
 *
 * A declaração carrega `nomes` como ARRAY desde a §6 (`x, y, z: inteiro`), não
 * uma string `nome`. Ler `d.nome` aqui fazia a busca falhar e o harness
 * alimentava "A" num `real`, que o runtime novo — corretamente — recusa.
 */
function tiposDoPrograma(codigo) {
  const m = new Map();
  let ast;
  try {
    ast = parsear(codigo);
  } catch {
    return m;
  }
  if (ast && Array.isArray(ast.variaveis)) {
    for (const d of ast.variaveis) {
      const tipo = d.tipoElemento || d.tipo;
      for (const nome of d.nomes || []) m.set(String(nome).toLowerCase(), tipo);
    }
  }
  return m;
}

function resultadoAceito(r) {
  if (r && r.ok === true) return "ok";
  if (r && r.ok === false && r.interrompido === true) return "interrompido";
  if (r && r.ok === false && r.erro && /Possível loop infinito/i.test(r.erro.mensagem || "")) return "loop infinito";
  return null;
}

su.secao(
  "[2/3] Execução smoke — " + arquivos.length +
    " arquivos (entrada fake" + (MODO_LITERAL ? " literal" : " por tipo") + ", deveParar = false)"
);
const contagem = { ok: 0, interrompido: 0, "loop infinito": 0 };
const porCategoria = { interrompido: [], "loop infinito": [] };
let smokeOk = 0;
for (const arquivo of arquivos) {
  const rel = caminhoRelativo(arquivo);
  let r;
  try {
    r = await Vg.executar(lerAlg(arquivo), {
      saida: () => {},
      entrada: criarEntrada(tiposDoPrograma(lerAlg(arquivo)), rel),
      deveParar: () => false,
    });
  } catch (e) {
    r = { ok: false, erro: { linha: null, mensagem: (e && e.message) || String(e) } };
  }
  const categoria = resultadoAceito(r);
  if (categoria) {
    contagem[categoria]++;
    if (porCategoria[categoria]) porCategoria[categoria].push(rel);
    smokeOk++;
    su.registrar(rel, null);
  } else {
    su.registrar(
      rel,
      new Error(
        r && r.erro
          ? "linha " + (r.erro.linha === null || r.erro.linha === undefined ? "?" : r.erro.linha) + ": " + r.erro.mensagem
          : JSON.stringify(r)
      )
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
  console.log("  ℹ️  entrada fake: ciclo literal " + JSON.stringify(SEQUENCIA) + " (modo --literal)");
} else if (arquivosComPulo.size > 0) {
  console.log(
    "  ℹ️  entrada fake: ciclo " + JSON.stringify(SEQUENCIA) + " — " + arquivosComPulo.size +
      " arquivo(s) precisaram de valor adaptado ao tipo da variável (ex.: \"A\" num inteiro)"
  );
}
if (porCategoria["loop infinito"].length > 0) {
  // Estes NÃO são programas corretos que passaram: a entrada fake não satisfaz o
  // `leia`, o laço não termina, e o motor cortou pelo limite de passos. Contam
  // como pass porque a engine não travou, que é o que a fase 2 mede — mas é
  // importante não ler "95/95" como "95 programas funcionam". A Onda 14 do
  // backlog troca isso por entrada determinística e orçamento de tempo.
  console.log(
    "  ⚠️  " + porCategoria["loop infinito"].length +
      " arquivo(s) acima passaram por BATALHAR no limite de passos, não por terminarem."
  );
  console.log("      A fase 2 mede 'a engine não trava', não 'o algoritmo está certo'.");
}
su.categoria("smoke", arquivos.length);

// ------------------------------------------------------------- fase 3: unitários
su.teste("formatação largura + casas: escreval(\"x: \", v:6:2)", async () => {
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
su.teste("formatação só largura: escreval(\"v: \", v:4)", async () => {
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
su.teste("string com ':' dentro NÃO é formatação", async () => {
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
su.teste("escreval quebra linha, escreva não", async () => {
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
su.teste("se/senao aninhado", async () => {
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
su.teste("enquanto...faca...fimenquanto", async () => {
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
su.teste("para...de...ate (passo padrão)", async () => {
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
su.teste("para...de...ate...passo -1 (negativo)", async () => {
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
su.teste("repita...ate", async () => {
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
su.teste("aritmética: 6/3 atribuído a inteiro = 2", async () => {
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
su.teste("aritmética: 7%3 = 1", async () => {
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
su.teste("leia de real aceita vírgula decimal", async () => {
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
su.teste("concatenação de texto com +", async () => {
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
su.teste("leia de inteiro com \"abc\" → erro com linha", async () => {
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
su.teste("divisão por zero → erro com linha", async () => {
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
su.teste("deveParar() true → {ok:false, interrompido:true}", async () => {
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
su.teste("entrada que rejeita → {ok:false, interrompido:true}", async () => {
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
su.teste("maxPassos=500 num laço infinito → erro de loop infinito", async () => {
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
su.teste("erro de sintaxe → {ok:false, erro:{linha}}", async () => {
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
su.teste("variável não declarada → erro.linha preenchido", async () => {
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
su.teste("programa mínimo executa com {ok:true}", async () => {
  const { r, saida } = await rodar(`
Algoritmo "minimo"
Inicio
   escreval("olá")
Fimalgoritmo
`);
  eVerdadeiro(r.ok === true, "esperava ok:true", r);
  eIgual(saida, ["olá", "\n"], "saída do programa mínimo");
});

// A contagem precisa ser lida ANTES de `executar()`, porque o harness limpa a
// fila ao terminar — ler depois dava 0 e escondia os 21 casos do resumo.
const casosUnitarios = su.testes.length;
su.secao("[3/3] Testes unitários de comportamento — " + casosUnitarios + " casos");
await su.executar();
su.categoria("unitários", casosUnitarios);

process.exitCode = su.imprimirResumo();
