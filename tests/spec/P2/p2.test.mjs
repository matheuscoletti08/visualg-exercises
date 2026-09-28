// §11 / P2 — precedência de relação combinada com lógico, sem parênteses.
//
// A decisão está em `spec/P2.md`: [A] compatibilidade estrita com VisuAlg
// 3.0.7.0. Este arquivo é o que impede a decisão de se perder: se alguém mexer
// na ordem dos níveis do parser, o teste falha e aponta a mudança.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "../../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../../src/visualg/carga.mjs";
import { Suite, eIgual, eVerdadeiro } from "../../lib/harness.mjs";

for (const src of ORDEM_ENGINE) await import(pathToFileURL(join(RAIZ, src)).href);
const Vg = globalThis.Vg;
const su = new Suite();

/** Avalia a expressão e devolve o valor. */
async function val(expr) {
  const partes = [];
  const r = await Vg.executar(
    'Algoritmo "p2"\nVar\n   v: lógico\nInicio\n   v <- ' + expr + "\n   escreval(v)\nFimalgoritmo\n",
    { saida: (t) => partes.push(t) }
  );
  if (!r.ok) throw new Error(expr + " -> " + (r.erro && (r.erro.codigo + ": " + r.erro.mensagem)));
  return partes.join("").trim();
}

/** A árvore que o parser produz, para provar a AGRUPAGEM e não só o resultado. */
function arvore(expr) {
  const prog = Vg.analisar('Algoritmo "p2"\nInicio\n   x <- ' + expr + "\nFimalgoritmo\n");
  return prog.corpo[0].valor;
}
function forma(n) {
  if (n.tipo === "literal") return String(n.valor);
  if (n.tipo === "identificador") return n.nome;
  if (n.tipo === "unario") return n.operador + "(" + forma(n.operando) + ")";
  if (n.tipo === "binario") return "(" + forma(n.esquerda) + " " + n.operador + " " + forma(n.direita) + ")";
  return n.tipo;
}

su.secao("P2 [A] — as seis expressões obrigatórias do backlog");

su.teste("(10 > 5) e (20 > 10)  =  VERDADEIRO", async () => {
  eIgual(await val("(10 > 5) e (20 > 10)"), "VERDADEIRO", "com parênteses");
  eIgual(await val("10 > 5 e 20 > 10"), "VERDADEIRO", "sem parênteses");
  // A prova que importa: sem parênteses produz a MESMA árvore que com.
  eIgual(forma(arvore("10 > 5 e 20 > 10")), forma(arvore("(10 > 5) e (20 > 10)")), "árvore sem parênteses");
});

su.teste("(10 > 5) ou (20 < 10)  =  VERDADEIRO", async () => {
  eIgual(await val("(10 > 5) ou (20 < 10)"), "VERDADEIRO", "com parênteses");
  eIgual(await val("10 > 5 ou 20 < 10"), "VERDADEIRO", "sem parênteses");
  eIgual(forma(arvore("10 > 5 ou 20 < 10")), forma(arvore("(10 > 5) ou (20 < 10)")), "árvore sem parênteses");
});

su.teste("nao (10 > 5)  =  nao 10 > 5  =  FALSO", async () => {
  eIgual(await val("nao (10 > 5)"), "FALSO", "com parênteses");
  eIgual(await val("nao 10 > 5"), "FALSO", "sem parênteses");
  eIgual(forma(arvore("nao 10 > 5")), forma(arvore("nao (10 > 5)")), "árvore sem parênteses");
});

su.secao("P2 [A] — a AGRUPAGEM que [A] exige");

su.teste("relacional amarra MAIS FORTE que `e`", () => {
  eIgual(forma(arvore("a > b e c > d")), "((a > b) e (c > d))", "relacional vs e");
  eIgual(forma(arvore("a = b ou c <> d")), "((a = b) ou (c <> d))", "relacional vs ou");
});

su.teste("relacional amarra MAIS FORTE que `xou`", () => {
  eIgual(forma(arvore("a > b xou c > d")), "((a > b) xou (c > d))", "relacional vs xou");
});

su.teste("`nao` é mais forte que `e` e mais fraco que a relacional", () => {
  // A forma canônica no AST é ACENTUADA (`não`), mesmo quando o aluno escreve
  // `nao`: o `tokens.js` normaliza as duas grafias para a acentuada.
  eIgual(forma(arvore("nao a e b")), "(não(a) e b)", "nao vs e");
  eIgual(forma(arvore("nao a > b")), "não((a > b))", "nao vs relacional");
});

su.teste("`xou` é o mais fraco de todos", () => {
  eIgual(forma(arvore("a ou b xou c")), "((a ou b) xou c)", "ou amarra antes de xou");
  // `xou` é o nível mais solto, então ele parte a expressão por último: os dois
  // lados são resolvidos com os níveis mais fortes antes de virar `xou`.
  eIgual(forma(arvore("a e b xou c ou d")), "((a e b) xou (c ou d))", "cadeia");
  eIgual(forma(arvore("a + b xou c * d")), "((a + b) xou (c * d))", "aritmética antes de xou");
});

su.secao("P2 [A] — casos que a decisão torna errados de propósito");

su.teste("`nao 10 > 5` NÃO é `(nao 10) > 5`", () => {
  const a = forma(arvore("nao 10 > 5"));
  eVerdadeiro(a === "não((10 > 5))", "esperava não((10 > 5)), veio " + a);
  eVerdadeiro(a !== "((não(10)) > 5)", "não pode ser (nao 10) > 5 sob [A]");
});

su.teste("`xou` não amarra tão forte quanto `ou` (contra-intuitivo, e é [A])", () => {
  // Em quase toda linguagem `xor` amarra quase tanto quanto `ou`. Aqui [A]
  // coloca `xou` no nível mais fraco, como o VisuAlg 3.0.7.0.
  eIgual(forma(arvore("a ou b xou c")), "((a ou b) xou c)", "ou amarra antes de xou");
});

su.secao("P2 [A] — `ex39` do corpus, que é o caso real que motivou a questão");

su.teste("faccat/ex39.alg continua parseando e executando", async () => {
  const alvo = todosAlgs().find((f) => caminhoRelativo(f) === "faccat/ex39.alg");
  if (!alvo) throw new Error("ex39.alg não encontrado no corpus");
  const prog = Vg.analisar(lerAlg(alvo));
  eVerdadeiro(prog && prog.tipo === "programa", "ex39 deve parsear");
  // E precisa passar pela análise semântica: é lá que a combinação
  // relacional+lógico seria rejeitada se alguém tivesse invertido os níveis.
  Vg.analisar(lerAlg(alvo), { analisarSemantica: true });
});

await su.executar();
su.categoria("P2", su.total);
process.exitCode = su.imprimirResumo();
