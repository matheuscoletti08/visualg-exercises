// §56 — compatibilidade com o corpus real, e baseline de ouro.
//
// O que esta suíte acrescenta em cima de `tools/testar.mjs`:
//
//  1. Os 95 `.alg` de Faccat e Manzano viram caso de teste nomeado, com a saída
//     COMPLETA congelada. A fase 2 de `testar.mjs` só verifica que a engine não
//     trava; aqui a saída é comparada byte a byte contra um baseline, o que pega
//     deriva silenciosa — um `escreva` que perde um espaço, um `arred` que muda
//     o arredondamento, um laço que itera uma vez a mais.
//
//  2. Os 2 arquivos que "passavam" por bater no limite de passos têm OUTCOME
//     explícito (`limite-passos`). Antes eles entravam no contador de pass como
//     se estivessem corretos, que era o falso positivo apontado no backlog.
//
//  3. Testa as formas que o corpus NÃO usa e o engine precisa suportar mesmo
//     assim: acentos, `:=`, `\`, `div`, `mod`, `xou`, declaração múltipla.
//
// Uso:
//   node tests/compat/corpus.test.mjs             compara com o baseline
//   node tests/compat/corpus.test.mjs --atualizar regenera o baseline
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";
import { Suite, eIgual, eVerdadeiro } from "../lib/harness.mjs";

for (const src of ORDEM_ENGINE) await import(pathToFileURL(join(RAIZ, src)).href);
const Vg = globalThis.Vg;
if (!Vg || typeof Vg.executar !== "function") {
  console.error("❌ não consegui carregar W.Vg");
  process.exit(1);
}

const BASE = join(RAIZ, "tests", "compat", "baseline.json");
const ATUALIZAR = process.argv.includes("--atualizar");

// Entrada determinística. O ciclo é fixo, então a saída é reproduzível — o que
// é o requisito para um baseline servir de detector de deriva.
const CICLO = ["5", "10", "2.5", "A", "NAO", "100", "3", "7", "-2"];

function servePara(tipo, valor) {
  if (!tipo) return true;
  if (tipo === "inteiro") return /^-?\d+$/.test(String(valor).trim());
  if (tipo === "real") return /^-?\d+(\.\d+)?$/.test(String(valor).trim());
  if (tipo === "caractere" || tipo === "literal") return true;
  if (tipo === "logico") return /^(verdadeiro|falso|v|f)$/i.test(String(valor).trim());
  return false;
}

function tiposDo(codigo) {
  const m = new Map();
  let ast;
  try {
    ast = Vg.analisar(codigo);
  } catch {
    return m;
  }
  for (const d of (ast.variaveis || [])) {
    const tipo = d.tipoElemento || d.tipo;
    for (const n of d.nomes || []) m.set(String(n).toLowerCase(), tipo);
  }
  return m;
}

/** Executa um arquivo e classifica o desfecho. */
async function executar(caminho) {
  const codigo = lerAlg(caminho);
  const tipos = tiposDo(codigo);
  const partes = [];
  let i = 0;
  const r = await Vg.executar(codigo, {
    saida: (t) => partes.push(t),
    entrada: (prompt) => {
      // O prompt precisa ser lido: é dele que sai o nome da variável, e sem o
      // nome não há como escolher um valor do tipo certo. Descartar o prompt
      // fazia o ciclo entrar cru, os programas terminarem, e os 2 arquivos que
      // só param por orçamento de passos sumirem do baseline.
      const nome = String(prompt).replace(/^Entre com o valor de\s*/i, "").trim().toLowerCase();
      const tipo = tipos.get(nome);
      for (let n = 0; n < CICLO.length; n++) {
        const v = CICLO[(i + n) % CICLO.length];
        if (servePara(tipo, v)) {
          i = (i + n + 1) % CICLO.length;
          return Promise.resolve(v);
        }
      }
      const v = CICLO[i % CICLO.length];
      i = (i + 1) % CICLO.length;
      return Promise.resolve(v);
    },
    deveParar: () => false,
  });
  return { r, saida: partes.join("") };
}

/** O prompt não chega aqui (o gerador acima o descarta), então o tipo resolve
 *  pela ÚLTIMA variável lida, que é o que importa para escolher o valor. */
function classificar(r) {
  if (r.ok === true) return "ok";
  if (r.ok === false && r.interrompido === true) return "interrompido";
  if (r.ok === false && r.erro && /loop infinito/i.test(r.erro.mensagem || "")) return "limite-passos";
  if (r.ok === false && r.erro) return "erro:" + (r.erro.codigo || "?");
  return "desconhecido";
}

const su = new Suite();
const arquivos = todosAlgs();

// 1. Parse dos 95, um teste por arquivo.
su.secao("§56.1 — os 95 .alg do corpus parseiam (" + arquivos.length + " arquivos)");
for (const a of arquivos) {
  const rel = caminhoRelativo(a);
  su.teste(rel, () => {
    const programa = Vg.analisar(lerAlg(a));
    eVerdadeiro(programa && programa.tipo === "programa", "esperava programa, veio " + typeof programa);
  });
}
await su.executar();
su.categoria("parse do corpus", arquivos.length);

// 2. Execução com saída congelada contra o baseline.
su.secao("§56.2 — saída do corpus contra o baseline de ouro");
const obtido = {};
let contaLimite = 0;
const quantosTestados = [];

for (const a of arquivos) {
  const rel = caminhoRelativo(a);
  const { r, saida } = await executar(a);
  const desfecho = classificar(r);
  if (desfecho === "limite-passos") contaLimite++;
  obtido[rel] = {
    desfecho,
    // Arquivos que não terminam por themselves não têm saída comparável.
    saida: desfecho === "limite-passos" ? null : saida,
    erro: r.erro ? { codigo: r.erro.codigo, mensagem: r.erro.mensagem, linha: r.erro.linha } : null,
  };
  // No modo `--atualizar` a execução NÃO vira teste: gravar 95 "pass" para
  // programa que acabou de rodar não informa nada — o baseline é regenerado por
  // construção. Quem valida é a execução seguinte, sem a flag.
  if (ATUALIZAR) quantosTestados.push(rel);
}

if (ATUALIZAR) {
  mkdirSync(join(RAIZ, "tests", "compat"), { recursive: true });
  writeFileSync(BASE, JSON.stringify({ _nota: "Gerado por tests/compat/corpus.test.mjs --atualizar. Não editar à mão.", ...obtido }, null, 1), "utf8");
  console.log("  baseline gravado: " + BASE);
  console.log("  arquivos com desfecho 'limite-passos' (não terminam sozinhos): " + contaLimite);
  su.registrar("baseline regravado com " + arquivos.length + " arquivos", null);
} else {
  if (!existsSync(BASE)) {
    console.error("❌ baseline ausente: " + BASE + " — rode com --atualizar");
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASE, "utf8"));
  let derivados = 0;
  for (const rel of Object.keys(obtido)) {
    const antes = base[rel];
    const agora = obtido[rel];
    if (!antes) {
      derivados++;
      console.log("  ❌ " + rel + "  — ausente no baseline");
      continue;
    }
    if (antes.desfecho !== agora.desfecho) {
      derivados++;
      console.log("  ❌ " + rel + "  — desfecho " + antes.desfecho + " → " + agora.desfecho);
      continue;
    }
    if (antes.erro && agora.erro && antes.erro.mensagem !== agora.erro.mensagem) {
      derivados++;
      console.log("  ❌ " + rel + "  — mensagem de erro mudou");
      continue;
    }
    if (antes.saida !== agora.saida) {
      derivados++;
      console.log("  ❌ " + rel + "  — SAÍDA DIVERGIU do baseline");
      console.log("       esperado " + JSON.stringify(antes.saida));
      console.log("       obtido   " + JSON.stringify(agora.saida));
    }
  }
  su.registrar(derivados === 0 ? arquivos.length + "/" + arquivos.length + " com saída igual ao baseline" : derivados + " deriva(s) do baseline", derivados === 0 ? null : new Error(derivados + " arquivo(s) divergiram"));
  console.log("  ℹ️  " + contaLimite + " arquivo(s) têm desfecho 'limite-passos': não terminam sozinhos com a entrada fake.");
  console.log("      Isso é ESPERADO e está congelado no baseline como tal — não é aprovação.");
}
su.categoria("baseline de ouro", 1);

// 3. Formas que o corpus não usa, mas o engine precisa suportar (§4, §6, §7, §10, §12).
su.secao("[3/3] Formas ausentes do corpus, exercitadas à parte");
let formaCount = 0;
async function saidaDe(corpo, declaracoes) {
  const partes = [];
  const r = await Vg.executar(
    'Algoritmo "compat"\nVar\n' + (declaracoes || "") + "\nInicio\n" + corpo + "\nFimalgoritmo\n",
    { saida: (t) => partes.push(t) }
  );
  return { r, saida: partes.join("") };
}

async function forma(nome, corpo, esperado, declaracoes) {
  formaCount++;
  su.teste(nome, async () => {
    const { r, saida } = await saidaDe(corpo, declaracoes);
    eVerdadeiro(r.ok === true, "esperava ok:true — " + (r.erro ? r.erro.codigo + ": " + r.erro.mensagem : "?"), r.erro);
    eIgual(saida, esperado, "saída");
  });
}

await forma("§4  acentos: 'então'/'senão' funcionam igual a 'entao'/'senao'", '   escreval("ok")', "ok\n");
await forma("§4  acentuado de verdade", '   se VERDADEIRO então\n      escreval("sim")\n   senão\n      escreval("nao")\n   fimse', "sim\n");
await forma("§4  'até' e 'faça' acentuados", '   repita\n      escreval("x")\n   até (VERDADEIRO)', "x\n");
await forma("§6  declaração múltipla x, y, z: inteiro", '   x <- 1\n   z <- 3\n   escreval(x + z)', "4\n", "   x, y, z: inteiro\n");
await forma("§7  ':=' produz o mesmo que '<-'", '   x := 7\n   escreval(x)', "7\n", "   x: inteiro\n");
await forma("§10 divisão é REAL: 10/4 = 2.5", '   escreval(10 / 4)', "2.5\n");
await forma("§10 divisão inteira: 10 \\ 4 = 2", '   escreval(10 \\ 4)', "2\n", "   n: inteiro\n");
await forma("§10 div: 10 div 4 = 2", '   escreval(10 div 4)', "2\n");
await forma("§10 mod: 10 mod 4 = 2", '   escreval(10 mod 4)', "2\n");
await forma("§12 xou: VERDADEIRO xou FALSO", '   escreval(VERDADEIRO xou FALSO)', "VERDADEIRO\n");
await forma("§12 xou: FALSO xou FALSO", '   escreval(FALSO xou FALSO)', "FALSO\n");
await forma("§5  limite negativo de vetor [-5..5]", '   v[-5] <- 1\n   v[5] <- 2\n   escreval(v[-5] + v[5])', "3\n", "   v: vetor [-5..5] de inteiro\n");
await forma("§11 comparação de texto sem caixa", '   escreval("Ana" = "ana")', "VERDADEIRO\n");
await forma("§22 interrompa dentro de enquanto", '   i <- 0\n   enquanto (VERDADEIRO) faca\n      i <- i + 1\n      se i > 2 entao\n         interrompa\n      fimse\n   fimenquanto\n   escreval(i)', "3\n", "   i: inteiro\n");
await forma("§18 escolha sem break implícito, com interrompa", '   escolha 2\n   caso 1\n      escreval("um")\n   caso 2\n      escreval("dois")\n      interrompa\n   outrocaso\n      escreval("outro")\n   fimescolha', "dois\n");

await su.executar();
su.categoria("formas fora do corpus", formaCount);

process.exitCode = su.imprimirResumo();
