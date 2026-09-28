// §38 / §39 / §40 — testes do debugger.
//
// A arquitetura é a de SUSPENSÃO: o runtime segura o statement numa barreira e
// `resume`/`step` a soltam. Os testes medem os SINTOMAS que a versão anterior,
// baseada em rebobinagem, não conseguia:
//   · `leia` perguntado uma vez só;
//   · console escrito uma vez só;
//   · passo que avança e converge;
//   · `stop()` que não executa statement novo.
//
// NENHUM teste usa número de linha fixo. Todos usam `linhaDe(codigo, trecho)`,
// porque um número chutado erra sem avisar: um breakpoint em `Inicio` ou numa
// declaração simplesmente nunca dispara, e o teste falha com "não pausou" sem
// dizer que o número estava errado. A primeira versão desta suíte tinha 6
// desses.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RAIZ } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";
import { Suite, eIgual, eVerdadeiro } from "../lib/harness.mjs";

for (const src of ORDEM_ENGINE) await import(pathToFileURL(join(RAIZ, src)).href);
const { Debugger, Api, Scheduler } = globalThis.VG;
const ESTADO = Scheduler.ESTADO;
const Agendador = Scheduler.Scheduler; // a classe; `Scheduler` é o espaço de nomes
const PASSO = Debugger.PASSO;
const MOTIVO = Debugger.MOTIVO;
const su = new Suite();

const atraso = (n) => new Promise((r) => setTimeout(r, n === undefined ? 0 : n));

let saida = [];
const texto = () => saida.join("");

/**
 * Número (1-based) da PRIMEIRA linha cujo conteúdo contém `trecho`.
 * Lança se não achar: um teste que aponta para a linha errada é pior que um
 * teste que aponta para a linha nenhuma.
 */
function linhaDe(codigo, trecho, quantasVezes) {
  const linhas = codigo.split("\n");
  let achadas = 0;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].indexOf(trecho) >= 0) {
      if (achadas === (quantasVezes || 0)) return i + 1;
      achadas++;
    }
  }
  throw new Error("trecho não encontrado no código: " + JSON.stringify(trecho) + "\n---\n" + codigo);
}

function criar(codigo, entrada, extra) {
  saida = [];
  return Debugger.criar(
    codigo,
    Object.assign(
      {
        saida: (t) => saida.push(t),
        entrada: entrada || null,
        maxPassos: 200000,
        // Sem `maxExecutionTime`, deliberadamente: o teto de parede deixou de ter
        // padrão, e um helper de teste que impõe um teto escondido reintroduz a
        // regra que acabamos de remover — e não um `TEMPO_LIMITE_PAREDE` de
        // 30 s do harness apareceria como travamento, não como limite de teste.
      },
      extra || {}
    )
  );
}

/** Entrada sob controle: o teste decide quando e quanto o aluno digita. */
function entradaControlada() {
  const prompts = [];
  const pendentes = [];
  const fn = (p) => {
    prompts.push(String(p).replace(/^Entre com o valor de\s*/i, "").trim());
    return new Promise((resolve) => pendentes.push(resolve));
  };
  fn.prompts = prompts;
  fn.responder = (v) => {
    const r = pendentes.shift();
    if (r) r(v);
  };
  return fn;
}

/**
 * Espera a sessão terminar, respondendo as entradas que aparecerem.
 *
 * Se a sessão estiver PAUSADA, ela continua. Este helper significa "rodar até o
 * fim", e um breakpoint que ninguém retoma é justamente o caminho que faz o
 * `await` do `executar()` nunca resolver — o teste não falhava, ele pendurava.
 * Quem quer inspecionar uma pausa usa `atePausar`, que para e devolve o controle.
 */
async function ateTerminar(d, entrada, valores, limite, retomar) {
  let i = 0;
  for (let k = 0; k < (limite || 1200); k++) {
    if (d.estado === ESTADO.FINISHED || d.estado === ESTADO.ERROR || d.estado === ESTADO.STOPPED) return;
    if (d.sessao && d.sessao.entradaPendente) {
      entrada.responder(valores ? valores[i++] : "");
      await atraso();
      continue;
    }
    if (d.estado === ESTADO.PAUSED && retomar !== false) {
      d.continuar();
      await atraso();
      continue;
    }
    await atraso(1);
  }
  throw new Error("o programa não terminou a tempo (estado " + d.estado + ")");
}

/** Espera a primeira pausa. Lança se o programa terminar antes. */
async function atePausar(d, ms) {
  for (let k = 0; k < (ms || 400); k++) {
    if (d.estado === ESTADO.PAUSED) return;
    if (d.estado === ESTADO.FINISHED || d.estado === ESTADO.ERROR || d.estado === ESTADO.STOPPED) {
      throw new Error("o programa terminou sem pausar (estado " + d.estado + ")");
    }
    await atraso(1);
  }
  throw new Error("não pausou a tempo (estado " + d.estado + ")");
}

/**
 * Dirige a sessão até um estado terminal, RETOMANDO pausas que não são o alvo do
 * teste, e devolve as linhas visitadas.
 *
 * Este helper existe porque a alternativa era `await p` depois de um laço de
 * passos: se o laço terminasse com a sessão ainda pausada — o que acontece
 * sempre que o número de pausas é desconhecido de antemão — o `await` não
 * resolvia e o teste pendurava em vez de falhar. Aqui o driver sempre leva a
 * sessão ao fim, e o teste afirma sobre o que foi COLETADO.
 */
async function dirigir(d, opcoes) {
  const o = opcoes || {};
  const modo = o.modo || null; // null = só continua, sem passo explícito
  const p = d.executar({ pausarNoInicio: o.pausarNoInicio === true });
  const linhas = [];
  for (let k = 0; k < 800; k++) {
    if (d.estado === ESTADO.FINISHED || d.estado === ESTADO.ERROR || d.estado === ESTADO.STOPPED) break;
    if (d.sessao && d.sessao.entradaPendente) {
      if (o.entrada) {
        o.entrada();
        await atraso();
        continue;
      }
      break;
    }
    if (d.estado === ESTADO.PAUSED) {
      if (o.aoPausar) o.aoPausar(d, k);
      linhas.push(d.retrato().executionPoint ? d.retrato().executionPoint.sourceLine : null);
      if (modo) d.passo(modo);
      else d.continuar();
      await atraso();
      await atraso();
      continue;
    }
    await atraso(1);
  }
  // Garante estado terminal: um teste nunca deve depender de o driver adivinhar
  // quantas pausas faltavam.
  if (d.estado !== ESTADO.FINISHED && d.estado !== ESTADO.ERROR && d.estado !== ESTADO.STOPPED) {
    d.parar();
    for (let k = 0; k < 200 && d.estado === ESTADO.PAUSED; k++) await atraso(1);
  }
  await p;
  return linhas;
}

// ===================================================================== §28
su.secao("§28 — ExecutionPoint e identidade de statement");

const EP = 'Algoritmo "x"\nVar\n   a: inteiro\nInicio\n   a <- 1\n   escreval(a)\nFimalgoritmo\n';

su.teste("§28.1 ExecutionPoint tem linha, coluna, FIM e statementId", async () => {
  const alvo = linhaDe(EP, "escreval");
  const d = criar(EP);
  d.alternar(alvo);
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  const e = d.retrato().executionPoint;
  eVerdadeiro(e, "há ExecutionPoint");
  eIgual(e.sourceLine, alvo, "sourceLine");
  eVerdadeiro(typeof e.sourceColumn === "number", "sourceColumn é número");
  eVerdadeiro(typeof e.sourceEndLine === "number", "sourceEndLine é número");
  eVerdadeiro(typeof e.sourceEndColumn === "number", "sourceEndColumn é número");
  eVerdadeiro(typeof e.statementId === "number" && e.statementId > 0, "statementId é número positivo");
  d.parar();
  await p;
});

su.teste("§28.1 a linha atual NUNCA vem do texto do editor", async () => {
  const alvo = linhaDe(EP, "a <- 1");
  const d = criar(EP);
  d.alternar(alvo);
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  eIgual(d.retrato().executionPoint.sourceLine, alvo, "ponto na linha do statement");
  // §28.5 — o statement NÃO rodou: `a` continua 0.
  eIgual(d.retrato().variaveis.globais.find((v) => v.nome === "a").valor, "0", "a ainda vale 0");
  eIgual(texto(), "", "nada escrito antes do statement marcado");
  d.parar();
  await p;
});

su.teste("§28.9 perfil conta por statementId e agrega por linha", async () => {
  const C = 'Algoritmo "p"\nVar\n   i: inteiro\n   s: inteiro\nInicio\n   s <- 0\n   para i de 1 ate 4 faca\n      s <- s + i\n   fimpara\nFimalgoritmo\n';
  const corpo = linhaDe(C, "s <- s + i");
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  const porStatement = d.perfilOrdenado("execucoes");
  eVerdadeiro(porStatement.length >= 3, "perfil tem statements, veio " + porStatement.length);
  eVerdadeiro(
    new Set(porStatement.map((x) => x.statementId)).size === porStatement.length,
    "cada statement tem id próprio"
  );
  const laco = porStatement.find((x) => x.linha === corpo);
  eVerdadeiro(laco && laco.execucoes === 4, "corpo do laço rodou 4x, veio " + (laco && laco.execucoes));
  const porLinha = d.perfilOrdenado("linha");
  const agregada = porLinha.find((x) => x.linha === corpo);
  eVerdadeiro(agregada && agregada.execucoes === 4, "agregação por linha dá 4");
  eIgual(
    porLinha.reduce((a, b) => a + b.execucoes, 0),
    porStatement.reduce((a, b) => a + b.execucoes, 0),
    "os dois totais batem"
  );
});

// ===================================================================== §38 Step
su.secao("§38 Step — assignment, if, while, repeat, for, escolha, função, recursão");

/** Executa, dá `sobre` até terminar, e devolve as linhas visitadas. */
async function stepando(codigo, entrada, modo, max) {
  const d = criar(codigo, entrada);
  // Sem breakpoint: a sessão já pausa no PRIMEIRO statement (§40), que é o que
  // o botão Debug faz. Marcar `Inicio` não funcionaria, porque cabeçalho e
  // declarações não são statements.
  const p = d.executar();
  await atePausar(d);
  const linhas = [];
  for (let k = 0; k < (max || 60); k++) {
    if (d.estado !== ESTADO.PAUSED) break;
    linhas.push(d.retrato().executionPoint.sourceLine);
    d.passo(modo || PASSO.SOBRE);
    await atraso();
    await atraso();
  }
  await p;
  return { d, linhas };
}

su.teste("§39.8 `step` não executa DOIS statements observáveis", async () => {
  // A §47 exige declaração, e a sessão roda a análise semântica: um programa
  // de teste com `a <- 1` sem `var` é REJEITADO, e o teste falharia por um
  // motivo que não tem nada a ver com passo a passo.
  const C = 'Algoritmo "s"\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\nInicio\n   a <- 1\n   b <- 2\n   c <- 3\nFimalgoritmo\n';
  const { linhas } = await stepando(C);
  eVerdadeiro(linhas.length >= 3, "passou por " + linhas.length + " statement(s)");
  for (let i = 1; i < linhas.length; i++) {
    eVerdadeiro(linhas[i] !== linhas[i - 1], "cada passo muda de linha: " + linhas.join(" -> "));
  }
});

su.teste("§38 step em `se`/`senao`", async () => {
  const C = 'Algoritmo "s"\nVar\n   x: inteiro\nInicio\n   x <- 5\n   se x > 3 entao\n      x <- 1\n   senao\n      x <- 2\n   fimse\nFimalgoritmo\n';
  const { d } = await stepando(C);
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
});

su.teste("§38 step em `enquanto`", async () => {
  const C = 'Algoritmo "e"\nVar\n   i: inteiro\nInicio\n   i <- 0\n   enquanto i < 3 faca\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n';
  const corpo = linhaDe(C, "i <- i + 1");
  const { linhas, d } = await stepando(C);
  // A propriedade que importa não é "quantos statements", e sim "o corpo rodou
  // uma vez por volta". `sobre` sobre o comando de laço executa o corpo inteiro,
  // então a contagem de pauses é menor que o número de voltas.
  const visitas = linhas.filter((l) => l === corpo).length;
  eVerdadeiro(visitas >= 2, "corpo do laço executado " + visitas + " vez(es), linhas: " + linhas.join(","));
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
});

su.teste("§38 step em `repita`", async () => {
  const C = 'Algoritmo "r"\nVar\n   n: inteiro\nInicio\n   n <- 0\n   repita\n      n <- n + 1\n   ate n >= 2\nFimalgoritmo\n';
  const { linhas, d } = await stepando(C);
  eVerdadeiro(linhas.length >= 2, "passou por " + linhas.length + " statement(s)");
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
});

su.teste("§38 step em `para`", async () => {
  const C = 'Algoritmo "p"\nVar\n   i: inteiro\n   s: inteiro\nInicio\n   para i de 1 ate 3 faca\n      s <- s + i\n   fimpara\nFimalgoritmo\n';
  const corpo = linhaDe(C, "s <- s + i");
  const { linhas, d } = await stepando(C);
  const visitas = linhas.filter((l) => l === corpo).length;
  eVerdadeiro(visitas >= 2, "corpo do `para` executado " + visitas + " vez(es): " + linhas.join(","));
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
  eIgual(texto().trim(), "", "sem escrita, o programa termina limpo");
});

su.teste("§38 step em `escolha`", async () => {
  const C = 'Algoritmo "e"\nVar opcao: inteiro\nInicio\n   escolha opcao\n   caso 1\n      escreval("um")\n      interrompa\n   outrocaso\n      escreval("outro")\n   fimescolha\nFimalgoritmo\n';
  const { linhas, d } = await stepando(C);
  eVerdadeiro(linhas.length >= 2, "entrou no escolha: " + linhas.join(","));
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
  // `opcao` vale 0, que não casa com `caso 1`: o caminho é o outrocaso.
  eIgual(texto().trim(), "outro", "executou o outrocaso");
});

su.teste("§38 `sobre` NAO entra na função: a chamada inteira conta como um statement", async () => {
  // Contrato do §30: `sobre` executa a chamada inteira, inclusive a recursão.
  // Por isso o corpo da função NÃO aparece entre as linhas visitadas — e é
  // exatamente por isso que existe o `dentro`, testado à parte.
  const C = 'Algoritmo "f"\nVar\n   r: inteiro\nInicio\n   r <- fat(3)\n   escreval(r)\nFimalgoritmo\n\nfuncao fat(n: inteiro): inteiro\ninicio\n   se n <= 1 entao\n      retorne 1\n   fimse\n   retorne n * fat(n - 1)\nfimfuncao\n';
  const dentro = linhaDe(C, "retorne n * fat");
  const { d, linhas } = await stepando(C, null, PASSO.SOBRE);
  eVerdadeiro(linhas.indexOf(dentro) < 0, "`sobre` não entra na função: " + linhas.join(","));
  eIgual(texto().trim(), "6", "mesmo assim o resultado está certo: fat(3) = 6");
  eVerdadeiro(d.estado === ESTADO.FINISHED, "terminou: " + d.estado);
});

su.teste("§38 `dentro` entra na função recursiva, statement por statement", async () => {
  const C = 'Algoritmo "f"\nVar\n   r: inteiro\nInicio\n   r <- fat(3)\n   escreval(r)\nFimalgoritmo\n\nfuncao fat(n: inteiro): inteiro\ninicio\n   se n <= 1 entao\n      retorne 1\n   fimse\n   retorne n * fat(n - 1)\nfimfuncao\n';
  const dentro = linhaDe(C, "retorne n * fat");
  const { d, linhas } = await stepando(C, null, PASSO.DENTRO);
  const visitas = linhas.filter((l) => l === dentro).length;
  eVerdadeiro(visitas >= 2, "`dentro` percursou o corpo recursivo " + visitas + " vez(es): " + linhas.join(","));
  eIgual(texto().trim(), "6", "fat(3) = 6");
  eVerdadeiro(d.estado === ESTADO.FINISHED || d.estado === ESTADO.STOPPED, "terminou: " + d.estado);
});

su.teste("§30 Step Into desce na chamada; Step Out volta", async () => {
  const C = 'Algoritmo "d"\nVar\n   x: inteiro\nInicio\n   x <- f()\nFimalgoritmo\n\nfuncao f(): inteiro\ninicio\n   retorne 7\nfimfuncao\n';
  const chamada = linhaDe(C, "x <- f()");
  const d = criar(C);
  d.alternar(chamada);
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  eIgual(d.retrato().executionPoint.sourceLine, chamada, "pausou na linha da chamada");
  eIgual(d.retrato().callStack.length, 0, "ainda estamos no nível principal");

  // `dentro` desce: agora a pilha tem f.
  d.passo(PASSO.DENTRO);
  for (let k = 0; k < 200 && d.estado !== ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado === ESTADO.PAUSED, "entrou em f(), estado=" + d.estado);
  const dentro = d.retrato();
  eVerdadeiro(dentro.callStack.length > 0, "pilha tem a função");
  if (dentro.callStack.length > 0) {
    eIgual(dentro.callStack[0].nome, "f", "topo da pilha é f");
  }

  // `fora` sobe de volta.
  const antes = dentro.callStack.length;
  d.passo(PASSO.FORA);
  await atraso(); await atraso(); await atraso();
  const depois = d.retrato().callStack.length;
  eVerdadeiro(depois < antes, "step out saiu da função: " + antes + " -> " + depois);
  d.parar();
  await p;
});

su.teste("§11C Run to Cursor vai até a linha escolhida", async () => {
  const C = 'Algoritmo "c"\nInicio\n   escreval("1")\n   escreval("2")\n   escreval("3")\nFimalgoritmo\n';
  const alvo = linhaDe(C, '"3"');
  const d = criar(C);
  d.alternar(linhaDe(C, '"1"'));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  d.irAte(alvo);
  for (let k = 0; k < 100 && d.estado !== ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado === ESTADO.PAUSED, "parou, estado=" + d.estado);
  eIgual(d.retrato().executionPoint.sourceLine, alvo, "parou na linha escolhida");
  eVerdadeiro(texto().indexOf("1") >= 0, "já executou a linha anterior");
  d.parar();
  await p;
});

// ================================================================= §38 Breakpoint
su.secao("§38 Breakpoint — simples, loop, múltiplos, remove, clear");

su.teste("§28.5 breakpoint para ANTES do statement", async () => {
  const C = 'Algoritmo "b"\nVar\n   a: inteiro\nInicio\n   a <- 1\n   a <- 2\nFimalgoritmo\n';
  const alvo = linhaDe(C, "a <- 1");
  const d = criar(C);
  d.alternar(alvo);
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  eIgual(texto(), "", "nada foi escrito antes do statement marcado");
  eIgual(d.retrato().variaveis.globais.find((v) => v.nome === "a").valor, "0", "a ainda vale 0");
  d.parar();
  await p;
});

su.teste("§28.5 o MESMO breakpoint pega a cada volta do loop", async () => {
  const C = 'Algoritmo "l"\nVar\n   i: inteiro\n   s: inteiro\nInicio\n   s <- 0\n   para i de 1 ate 3 faca\n      s <- s + i\n   fimpara\nFimalgoritmo\n';
  const alvo = linhaDe(C, "s <- s + i");
  const d = criar(C);
  d.alternar(alvo);
  const vistas = [];
  await dirigir(d, {
    aoPausar: (sess) => {
      vistas.push(sess.retrato().variaveis.globais.find((v) => v.nome === "i").valor);
    },
  });
  eIgual(vistas.join(","), "1,2,3", "parou com i = 1, 2, 3");
});

su.teste("§38 múltiplos breakpoints, em ordem", async () => {
  const C = 'Algoritmo "m"\nInicio\n   escreval("a")\n   escreval("b")\n   escreval("c")\n   escreval("d")\nFimalgoritmo\n';
  const l1 = linhaDe(C, '"a"');
  const l2 = linhaDe(C, '"c"');
  const d = criar(C);
  d.alternar(l1);
  d.alternar(l2);
  const linhas = await dirigir(d);
  eIgual(linhas.join(","), l1 + "," + l2, "parou nas duas linhas, em ordem");
});

su.teste("§38 remove e clear", async () => {
  const d = criar('Algoritmo "x"\nInicio\n   escreval("a")\nFimalgoritmo\n');
  eVerdadeiro(d.alternar(3) === true, "liga");
  eVerdadeiro(d.tem(3) === true, "tem");
  eVerdadeiro(d.alternar(3) === false, "desliga");
  d.alternar(3);
  d.alternar(7);
  eIgual(d.linhas().join(","), "3,7", "dois breakpoints");
  d.limparBreakpoints();
  eIgual(d.linhas().length, 0, "clear limpa");
});

su.teste("§11C breakpoint condicional: só pega quando a condição é verdadeira", async () => {
  const C = 'Algoritmo "b"\nVar\n   i: inteiro\n   s: inteiro\nInicio\n   s <- 0\n   para i de 1 ate 4 faca\n      s <- s + i\n   fimpara\nFimalgoritmo\n';
  const alvo = linhaDe(C, "s <- s + i");
  const d = criar(C);
  d.definirCondicional(alvo, "i = 3");
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  eIgual(d.retrato().motivo, MOTIVO.CONDICIONAL, "motivo é condicional");
  eIgual(d.retrato().variaveis.globais.find((v) => v.nome === "i").valor, "3", "i = 3");
  d.parar();
  await p;
});

su.teste("§11C condição falsa não para", async () => {
  const C = 'Algoritmo "b"\nInicio\n   escreval("a")\n   escreval("b")\nFimalgoritmo\n';
  const d = criar(C);
  d.definirCondicional(linhaDe(C, '"a"'), "FALSO");
  await dirigir(d);
  eVerdadeiro(d.estado === ESTADO.FINISHED, "terminou sem pausar: " + d.estado);
  eIgual(texto(), "a\nb\n", "saída completa");
});

// ==================================================================== §22/§23
su.secao("§22/§23 — `pausa` e `debug <expressão>`");

su.teste("§22 `pausa` pausa de verdade, com motivo source_pause", async () => {
  const C = 'Algoritmo "p"\nInicio\n   escreval("antes")\n   pausa\n   escreval("depois")\nFimalgoritmo\n';
  const d = criar(C);
  const p = d.executar({ pausarNoInicio: false });
  for (let k = 0; k < 200 && d.estado !== ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado === ESTADO.PAUSED, "pausou, estado=" + d.estado);
  eIgual(d.retrato().motivo, MOTIVO.SOURCE_PAUSE, "motivo source_pause");
  eIgual(texto(), "antes\n", "parou ANTES do 'depois'");
  d.continuar();
  await p;
  eIgual(texto(), "antes\ndepois\n", "continuou e terminou");
});

su.teste("§22 `pausa` com passo avança um statement", async () => {
  const C = 'Algoritmo "p"\nInicio\n   pausa\n   escreval("x")\nFimalgoritmo\n';
  const d = criar(C);
  const p = d.executar({ pausarNoInicio: false });
  for (let k = 0; k < 200 && d.estado !== ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado === ESTADO.PAUSED, "pausou");
  d.passo(PASSO.SOBRE);
  // `STEPPING` é um estado TERMINAL do ponto de vista de quem só perguntou "o
  // passo avançou?". O programa ainda não terminou — ele está esperando a próxima
  // pausa, que aqui não existe, porque não há mais breakpoint nem `pausa`. Por
  // isso esperar por PAUSED/FINISHED só mede a corrida: quem chega primeiro é
  // `stepping`. O passo advanceu se saímos de PAUSED, e o `continuar` leva ao fim.
  for (let k = 0; k < 200 && d.estado === ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado !== ESTADO.PAUSED, "saiu de pausado: " + d.estado);
  d.continuar();
  await p;
  eIgual(texto(), "x\n", "o statement depois de `pausa` rodou");
});

su.teste("§23 `debug <expr>` só para quando a condição é verdadeira", async () => {
  const C = 'Algoritmo "g"\nVar\n   i: inteiro\nInicio\n   para i de 1 ate 4 faca\n      debug i = 3\n   fimpara\nFimalgoritmo\n';
  const d = criar(C);
  const p = d.executar({ pausarNoInicio: false });
  for (let k = 0; k < 200 && d.estado !== ESTADO.PAUSED; k++) await atraso(1);
  eVerdadeiro(d.estado === ESTADO.PAUSED, "pausou, estado=" + d.estado);
  eIgual(d.retrato().motivo, MOTIVO.CONDITIONAL_DEBUG, "motivo conditional_debug");
  eIgual(d.retrato().variaveis.globais.find((v) => v.nome === "i").valor, "3", "i = 3");
  d.parar();
  await p;
});

su.teste("§23 condição falsa nunca para", async () => {
  const C = 'Algoritmo "g"\nVar\n   i: inteiro\nInicio\n   para i de 1 ate 3 faca\n      debug i > 100\n   fimpara\nFimalgoritmo\n';
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.FINISHED, "terminou sem pausar: " + d.estado);
});

su.teste("§23 condição não lógica é erro de tipo", async () => {
  const d = criar('Algoritmo "g"\nInicio\n   debug 42\nFimalgoritmo\n');
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "erro, estado=" + d.estado);
  eVerdadeiro(/lógica/.test(d.erro.mensagem), "mensagem cita 'lógica': " + (d.erro && d.erro.mensagem));
});

// ================================================================ §38 Variáveis
su.secao("§38 Variáveis — global, local, parâmetro, var, vetor, matriz");

su.teste("§28.6/§39.4 o painel mostra o Environment REAL", async () => {
  // Terceiro statement de propósito: com só `n <- 1` e `n <- 42` há exatamente
  // DUAS pausas, e o painel nunca chega a exibir o 42 — o valor só existe depois
  // da segunda atribuição, e o passo para no statement seguinte.
  const C = 'Algoritmo "v"\nVar\n   n: inteiro\nInicio\n   n <- 1\n   n <- 42\n   escreval(n)\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "n <- 1"));
  // `dirigir` é DONO da execução. Chamar `d.executar()` antes e deixar o driver
  // chamar de novo reiniciava o programa por baixo, e a lista de valores vinha
  // da segunda rodada (0,1) em vez da primeira (0,1,42).
  const vistos = [];
  await dirigir(d, {
    modo: PASSO.SOBRE,
    aoPausar: (sess) => {
      const v = sess.retrato().variaveis.globais.find((x) => x.nome === "n");
      vistos.push(v ? v.valor : "?");
    },
  });
  eVerdadeiro(vistos.indexOf("1") >= 0, "viu n=1: " + vistos.join(","));
  eVerdadeiro(vistos.indexOf("42") >= 0, "viu n=42: " + vistos.join(","));
});

su.teste("§38 parâmetro de procedimento aparece no frame", async () => {
  // Sem `local:` de propósito: VisuAlg 3.0.7.0 não declara variáveis locais
  // (não existe bloco `local` na gramática), e §47 rejeita a declaração como
  // sintaxe inválida. O que o §38 pede é o PARÂMETRO visível no frame.
  const C = 'Algoritmo "f"\nInicio\n   g(7)\nFimalgoritmo\n\nprocedimento g(p: inteiro)\n   escreval(p)\nfimprocedimento\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "g(7)"));
  let entrou = false;
  let quadro = null;
  await dirigir(d, {
    modo: PASSO.DENTRO,
    aoPausar: (sess) => {
      const r = sess.retrato();
      if (r.callStack.length > 0 && !entrou) {
        entrou = true;
        quadro = r.variaveis.quadros[0];
      }
    },
  });
  eVerdadeiro(entrou, "entrou em g()");
  if (quadro) {
    const nomes = quadro.variaveis.map((v) => v.nome);
    eVerdadeiro(nomes.indexOf("p") >= 0, "parâmetro p no frame: " + nomes.join(","));
    eIgual(quadro.nome, "g", "frame é o de g()");
  }
});

su.teste("§38 vetor aparece indexado com base 1 (§5)", async () => {
  const C = 'Algoritmo "v"\nVar\n   notas: vetor [1..3] de real\nInicio\n   notas[2] <- 8.5\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "notas[2]"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  const v = d.retrato().variaveis.globais.find((x) => x.nome === "notas");
  eVerdadeiro(v && v.elementos, "vetor tem elementos indexados");
  if (v && v.elementos) {
    eIgual(v.elementos[0].indice, 1, "índice 1 primeiro — base 1, como a §5");
    eIgual(v.totalElementos, 3, "três elementos");
  }
  d.parar();
  await p;
});

su.teste("§28.7 `variable_changed` emite valor anterior e novo", async () => {
  const C = 'Algoritmo "v"\nVar\n   n: inteiro\nInicio\n   n <- 1\n   n <- 7\nFimalgoritmo\n';
  const eventos = [];
  const d = criar(C, null, { aoVariavel: (e) => eventos.push(e) });
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(eventos.length > 0, "emitiu variable_changed");
  // O PRIMEIRO evento com mudança é `n: 0 -> 1`, da primeira atribuição (o `Var`
  // já inicializa em 0). O que o §28.7 quer é o par completo valor anterior/
  // novo de uma reatribuição, então procuramos o evento cujo novo valor é 7.
  const muda = eventos.find((e) => e.name === "n" && e.value === "7");
  eVerdadeiro(!!muda, "há evento com valor novo 7: " + JSON.stringify(eventos));
  if (muda) {
    eVerdadeiro(muda.value === "7", "valor novo é 7, veio " + muda.value);
    eVerdadeiro(muda.previousValue === "1", "valor anterior é 1, veio " + muda.previousValue);
    eVerdadeiro(typeof muda.sourceLine === "number", "traz sourceLine");
  }
});

// =================================================================== §38 Pilha
su.secao("§38/§39.3 Call stack é a do runtime");

su.teste("§39.3 a pilha do debugger é a do runtime, e recursão cresce", async () => {
  const C = 'Algoritmo "f"\nInicio\n   escreval(fat(4))\nFimalgoritmo\n\nfuncao fat(n: inteiro): inteiro\ninicio\n   se n <= 1 entao\n      retorne 1\n   fimse\n   retorne n * fat(n - 1)\nfimfuncao\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "fat(4)"));
  let maxProf = 0;
  await dirigir(d, {
    modo: PASSO.DENTRO,
    aoPausar: (sess) => {
      const r = sess.retrato();
      if (r.callStack.length > maxProf) maxProf = r.callStack.length;
    },
  });
  eVerdadeiro(maxProf >= 3, "pilha chegou a " + maxProf + " frame(s)");
  eIgual(texto().trim(), "24", "fat(4) = 24");
});

su.teste("§33 frame selection muda só a inspeção, não a execução", async () => {
  const C = 'Algoritmo "f"\nInicio\n   g(3)\nFimalgoritmo\n\nprocedimento g(p: inteiro)\n   escreval(p)\nfimprocedimento\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "g(3)"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  for (let k = 0; k < 12; k++) {
    if (d.estado !== ESTADO.PAUSED) break;
    if (d.retrato().callStack.length > 0) break;
    d.passo(PASSO.DENTRO);
    await atraso(); await atraso();
  }
  const antes = d.retrato();
  d.focar(1);
  const depois = d.retrato();
  eVerdadeiro(antes.quadroFocado !== depois.quadroFocado, "o foco mudou");
  eIgual(depois.quadroFocado, 1, "quadro focado = 1");
  eVerdadeiro(d.estado === ESTADO.PAUSED, "continua pausado — foco não executa");
  d.parar();
  await p;
});

// ==================================================================== §38 Input
su.secao("§38/§34 Input — `leia` durante debugging");

su.teste("§38 `leia` é perguntado UMA VEZ, mesmo com muitos passos", async () => {
  const C = 'Algoritmo "t"\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\nInicio\n   escreval("ini")\n   leia(a)\n   leia(b)\n   leia(c)\n   escreval("a=", a)\n   escreval("b=", b)\n   escreval("c=", c)\nFimalgoritmo\n';
  const entrada = entradaControlada();
  const d = criar(C, entrada);
  d.alternar(linhaDe(C, "escreval(\"ini\")"));
  const p = d.executar({ pausarNoInicio: false });
  await ateTerminar(d, entrada, ["9", "6", "2"]);
  await p;
  eIgual(entrada.prompts.length, 3, "exatamente 3 prompts, veio " + entrada.prompts.length);
  eIgual(entrada.prompts.join(","), "a,b,c", "na ordem");
  eIgual(texto(), "ini\na=9\nb=6\nc=2\n", "saída correta, uma vez só");
});

su.teste("§38 breakpoint ANTES do `leia` não perde a entrada", async () => {
  const C = 'Algoritmo "t"\nVar\n   x: inteiro\nInicio\n   escreval("p")\n   leia(x)\n   escreval(x)\nFimalgoritmo\n';
  const entrada = entradaControlada();
  const d = criar(C, entrada);
  d.alternar(linhaDe(C, "leia(x)"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  eIgual(entrada.prompts.length, 0, "ainda não perguntou nada");
  d.continuar();
  await ateTerminar(d, entrada, ["5"]);
  await p;
  eIgual(entrada.prompts.length, 1, "perguntou UMA vez");
  eIgual(texto(), "p\n5\n", "entrada usada e saída completa");
});

su.teste("§34 o prompt traz o nome e o tipo da variável", async () => {
  const C = 'Algoritmo "t"\nVar\n   x: inteiro\nInicio\n   leia(x)\nFimalgoritmo\n';
  const entrada = entradaControlada();
  const d = criar(C, entrada);
  const p = d.executar({ pausarNoInicio: false });
  await ateTerminar(d, entrada, ["1"]);
  await p;
  eIgual(entrada.prompts.join(","), "x", "prompt com o nome da variável");
});

// ====================================================================== §38 Stop
su.secao("§38/§40 Stop e estado de erro");

su.teste("§39.7 `stop()` não executa novo statement", async () => {
  const C = 'Algoritmo "s"\nVar\n   i: inteiro\nInicio\n   i <- 0\n   enquanto (1 = 1) faca\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "i <- 0"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  d.continuar();
  await atraso(30);
  d.parar();
  // A leitura tem de esperar o programa ESTAR parado. `stop()` não corta o
  // statement que já está em voo: ele impede o PRÓXIMO. Ler imediatamente
  // depois de `parar()` media `i` no meio da corrida e o `+ 1` aparecia na
  // segunda leitura — o programa estava certo, o teste é que não esperava.
  await p;
  const iNaParada = d.retrato().variaveis.globais.find((v) => v.nome === "i");
  await atraso(40);
  const iDepois = d.retrato().variaveis.globais.find((v) => v.nome === "i");
  eVerdadeiro(!!iNaParada, "a variável i é visível após stop()");
  eIgual(iDepois ? iDepois.valor : "?", iNaParada ? iNaParada.valor : "?", "i não mudou depois de stop()");
  eVerdadeiro(d.estado === ESTADO.STOPPED, "estado stopped: " + d.estado);
  eVerdadeiro(!!iNaParada.valor && Number(iNaParada.valor) > 0, "parou com i já avançado: " + iNaParada.valor);
});

su.teste("§28.4 `stop` preserva código e breakpoints", async () => {
  const alvo = linhaDe('Algoritmo "s"\nInicio\n   escreval("a")\nFimalgoritmo\n', "escreva");
  const d = criar('Algoritmo "s"\nInicio\n   escreval("a")\nFimalgoritmo\n');
  d.alternar(alvo);
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  d.parar();
  await p;
  eIgual(d.linhas().join(","), String(alvo), "breakpoint sobreviveu ao stop");
  eVerdadeiro(typeof d.codigo === "string" && d.codigo.length > 0, "código preservado");
});

su.teste("§40 erro preserva posição, pilha e variáveis", async () => {
  const C = 'Algoritmo "e"\nVar\n   x: inteiro\n   y: inteiro\nInicio\n   x <- 1\n   y <- 0\n   escreval(10 / y)\nFimalgoritmo\n';
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "estado error: " + d.estado);
  const e = d.erro;
  eVerdadeiro(e, "há erro");
  eVerdadeiro(typeof e.sourceLine === "number", "sourceLine");
  eVerdadeiro(typeof e.sourceColumn === "number", "sourceColumn");
  eVerdadeiro(e.length === null || typeof e.length === "number", "length");
  eVerdadeiro(typeof e.errorCode === "string" && e.errorCode.length > 0, "errorCode");
  eVerdadeiro(typeof e.mensagem === "string" && e.mensagem.length > 0, "message");
  eVerdadeiro(Array.isArray(e.callStack), "callStack presente");
  eVerdadeiro(e.variables && Array.isArray(e.variables.globais), "variables presente");
  eIgual(e.sourceLine, linhaDe(C, "10 / y"), "linha do erro é a do statement");
});

su.teste("§40 erro DENTRO de função mostra a função na pilha", async () => {
  // Retorno `inteiro`, não `caracter`: `1 / 0` é aritmética, e uma função
  // declarada `caracter` é rejeitada na análise semântica (§47) — o programa
  // nem chegaria ao runtime, e a pilha viria vazia sem que houvesse erro real.
  const C = 'Algoritmo "e"\nInicio\n   escreval(quebra())\nFimalgoritmo\n\nfuncao quebra(): inteiro\ninicio\n   retorne 1 / 0\nfimfuncao\n';
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "estado error: " + d.estado);
  eVerdadeiro(!!d.erro, "há erro: " + (d.erro && d.erro.mensagem));
  eVerdadeiro(!!d.erro.callStack[0], "pilha não está vazia");
  if (d.erro.callStack[0]) {
    eIgual(d.erro.callStack[0].nome, "quebra", "topo da pilha é a função que falhou");
  }
});

su.teste("§40 depois de `error`, step e resume NÃO continuam", async () => {
  const C = 'Algoritmo "e"\nInicio\n   escreval(1 / 0)\n   escreval("depois")\nFimalgoritmo\n';
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "erro");
  eVerdadeiro(d.passo(PASSO.SOBRE) === false, "step() devolve false");
  eVerdadeiro(d.continuar() === false, "resume() devolve false");
  eIgual(texto(), "", "nada foi escrito depois do erro");
  eVerdadeiro(d.erro !== null, "snapshot do erro continua congelado");
});

su.teste("§40 `stop` limpa o estado de erro", async () => {
  const d = criar('Algoritmo "e"\nInicio\n   escreval(1 / 0)\nFimalgoritmo\n');
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.erro !== null, "erro registrado");
  d.parar();
  eVerdadeiro(d.erro === null, "stop limpa o erro");
  eVerdadeiro(d.estado === ESTADO.STOPPED, "estado stopped");
});

su.teste("§38 timeout: laço infinito é cortado com o nome certo", async () => {
  const C = 'Algoritmo "t"\nVar\n   c: inteiro\nInicio\n   c <- 0\n   enquanto (1 = 1) faca\n      c <- c + 1\n   fimenquanto\nFimalgoritmo\n';
  const d = criar(C, null, { maxPassos: 2000 });
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "erro por timeout: " + d.estado);
  eVerdadeiro(/loop infinito/i.test(d.erro.mensagem), "mensagem cita loop infinito: " + d.erro.mensagem);
});

su.teste("§38 recursão excessiva é cortada com nome, não RangeError cru", async () => {
  const C = 'Algoritmo "r"\nInicio\n   f(0)\nFimalgoritmo\n\nfuncao f(n: inteiro): inteiro\ninicio\n   retorne f(n + 1)\nfimfuncao\n';
  const d = criar(C);
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(d.estado === ESTADO.ERROR, "erro: " + d.estado);
  eVerdadeiro(/recurs/i.test(d.erro.mensagem), "mensagem cita recursão: " + d.erro.mensagem);
});

// =============================================================== §30 Watch
su.secao("§30 — Watch expressions (extensão do playground)");

su.teste("§30 watch mostra o valor atual", async () => {
  const C = 'Algoritmo "w"\nVar\n   n: inteiro\nInicio\n   n <- 5\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "n <- 5"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  d.adicionarWatch("n + 1");
  await atraso();
  const w = d.retrato().watches[0];
  eVerdadeiro(w, "watch existe");
  eIgual(w.expressao, "n + 1", "expressão guardada");
  eVerdadeiro(w.valor !== null || w.erro !== null, "watch avaliada: " + JSON.stringify(w));
  d.parar();
  await p;
});

su.teste("§30 watch inválida reporta erro, não derruba o programa", async () => {
  const C = 'Algoritmo "w"\nInicio\n   escreval("a")\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, "escreva"));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  d.adicionarWatch("isto nao existe +++");
  await atraso();
  const w = d.retrato().watches[0];
  eVerdadeiro(w && w.erro, "watch tem erro: " + JSON.stringify(w));
  d.parar();
  await p;
});

su.teste("§30 remover e limpar watches", async () => {
  const d = criar('Algoritmo "w"\nInicio\n   escreval("a")\nFimalgoritmo\n');
  d.adicionarWatch("1 + 1");
  d.adicionarWatch("2 + 2");
  eIgual(d.retrato().watches.length, 2, "duas watches");
  d.removerWatch(0);
  eIgual(d.retrato().watches.length, 1, "removeu uma");
  d.limparWatches();
  eIgual(d.retrato().watches.length, 0, "limpou");
});

// ================================================================== §53 Orçamentos
su.secao("§53 — orçamentos: passos sim, relógio de parede não");

su.teste("o teto de relógio de parede não existe por padrão", () => {
  // A trava contra loop infinito é `maxPassos`, que conta TRABALHO. O relógio de
  // parede mede a máquina de quem roda, não o programa, e um teto fixo só
  // derrubaria programas lentos que estão corretos — que é justamente o caso
  // que se quer depurar, e o caso em que o teto aparecia junto com o
  // breakpoint, o passo e o perfil, ou seja, no meio do trabalho.
  eIgual(new Agendador({ maxPassos: 1000 }).maxExecutionTime, 0, "sem teto por padrão");
  eIgual(new Agendador({ maxPassos: 1000, maxExecutionTime: 0 }).maxExecutionTime, 0, "0 = sem teto");
  eIgual(new Agendador({ maxPassos: 1000, maxExecutionTime: null }).maxExecutionTime, 0, "null = sem teto");
  eIgual(new Agendador({ maxPassos: 1000, maxExecutionTime: -1 }).maxExecutionTime, 0, "-1 não vira teto");
  eIgual(new Agendador({ maxPassos: 1000, maxExecutionTime: 5000 }).maxExecutionTime, 5000, "teto explícito existe");
});

su.teste("programa longo termina sozinho, e o mesmo programa com teto é cortado", async () => {
  // Prova de que o mecanismo funciona E de que o padrão é desligado, sem
  // depender da velocidade da máquina: exigir "passou de 10 s" mediria o
  // processador de quem roda o teste, e o teste passaria ou falharia por um
  // motivo que não tem nada a ver com o código. O par abaixo é o que fecha o
  // argumento — o MESMO programa, com e sem teto.
  const C =
    'Algoritmo "l"\nVar\n   i: inteiro\n   s: inteiro\nInicio\n   s <- 0\n' +
    "   para i de 1 ate 400000 faca\n      s <- s + 1\n   fimpara\n   escreval(s)\nFimalgoritmo\n";
  const roda = async (opcoes) => {
    saida = [];
    const d = Debugger.criar(
      C,
      Object.assign({ saida: (t) => saida.push(t), entrada: null, maxPassos: 8000000 }, opcoes || {})
    );
    const p = d.executar({ pausarNoInicio: false });
    const fim = await Promise.race([p.then(() => "ok"), atraso(90000).then(() => "TRAVOU")]);
    return { d: d, fim: fim, saida: texto() };
  };

  // 1) sem teto: termina, e o valor está certo.
  const livre = await roda({});
  eIgual(livre.fim, "ok", "sem teto, o programa termina");
  eIgual(livre.saida, "400000\n", "sem teto, a contagem chega ao fim");
  eVerdadeiro(livre.d.erro === null, "sem teto, sem erro: " + (livre.d.erro && livre.d.erro.errorCode));

  // 2) com teto curto: o MESMO programa é cortado, e a mensagem diz que foi
  //    tempo — porque a ferramenta precisa continuar obedecendo quem configure.
  const comTeto = await roda({ maxExecutionTime: 1 });
  eVerdadeiro(!!comTeto.d.erro, "com teto, o programa é cortado");
  if (comTeto.d.erro) {
    eIgual(comTeto.d.erro.errorCode, "TEMPO_LIMITE_PAREDE", "o código é de relógio de parede");
    eVerdadeiro(/Tempo de execução excedido/.test(comTeto.d.erro.mensagem), "a mensagem nomeia o limite: " + comTeto.d.erro.mensagem);
  }
});

su.teste("`maxPassos` ainda corta loop infinito, e diz que foi isso", async () => {
  // Tirar o teto de parede não pode deixar a trava contra laço infinito de
  // lado. `maxPassos` é o critério certo, e a mensagem tem que dizer o que
  // aconteceu, senão o aluno acredita que o programa estava errado.
  const C = 'Algoritmo "i"\nInicio\n   enquanto (1 = 1) faca\n      escreval("x")\n   fimenquanto\nFimalgoritmo\n';
  saida = [];
  const d = Debugger.criar(C, { saida: (t) => saida.push(t), entrada: null, maxPassos: 5000 });
  await d.executar({ pausarNoInicio: false });
  eVerdadeiro(!!d.erro, "o loop infinito foi interrompido");
  if (d.erro) {
    eIgual(d.erro.errorCode, "TEMPO_LIMITE_PASSOS", "o código é de passos, não de relógio");
    eVerdadeiro(/loop infinito/i.test(d.erro.mensagem), "a mensagem fala em loop infinito: " + d.erro.mensagem);
  }
});

// ================================================================ §39 Invariantes
su.secao("§39 — invariantes do debugger");

function fonteSemComentario(caminho) {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .split("\n")
    .filter((l) => {
      const s = l.trim();
      return !s.startsWith("//") && !s.startsWith("*") && !s.startsWith("/*");
    })
    .join("\n");
}

su.teste("§39.10 o debugger não acessa DOM", () => {
  const t = fonteSemComentario("src/visualg/debugger.js");
  for (const proibido of ["document.", "innerHTML", "localStorage", "fetch(", "eval(", "new Function", "navigator"]) {
    eVerdadeiro(t.indexOf(proibido) < 0, "não usa " + proibido);
  }
});

su.teste("§39.11 o runtime não conhece a UI", () => {
  const t = fonteSemComentario("src/visualg/runtime.js");
  for (const proibido of ["document.", "innerHTML", "localStorage", "VGPlay", "DebugPanels", "navigator"]) {
    eVerdadeiro(t.indexOf(proibido) < 0, "runtime não conhece " + proibido);
  }
});

su.teste("§39.12 a API só lê variáveis: não há setter", () => {
  const t = readFileSync(join(RAIZ, "src/visualg/api.js"), "utf8");
  eVerdadeiro(!/definirVariavel|setVariable|atribuirVariavel/.test(t), "não existe setter de variável na API");
  eVerdadeiro(t.indexOf("getVariables") >= 0, "existe getVariables");
});

su.teste("§39.6 o perfil só cresce quando statements executam", async () => {
  const C = 'Algoritmo "p"\nInicio\n   escreval("a")\n   escreval("b")\nFimalgoritmo\n';
  const d = criar(C);
  d.alternar(linhaDe(C, '"a"'));
  const p = d.executar({ pausarNoInicio: false });
  await atePausar(d);
  const antes = d.perfilOrdenado("execucoes").length;
  d.parar();
  await p;
  eVerdadeiro(antes > 0, "contou antes de parar: " + antes);
  eVerdadeiro(d.perfilOrdenado("execucoes").length >= antes, "não diminuiu");
});

su.teste("§27 nenhum comando depende de F-key; a API tem todos", () => {
  const t = readFileSync(join(RAIZ, "src/visualg/debugger.js"), "utf8");
  eVerdadeiro(!/"F5"|"F7"|"F8"|"F9"|keyCode/.test(t), "nenhuma tecla é requisito");
  for (const metodo of ["passo", "continuar", "parar", "alternar", "irAte", "focar", "pausar"]) {
    eVerdadeiro(t.indexOf(metodo + "(") >= 0, "API tem " + metodo);
  }
});

su.teste("§15 passo 0 é erro SEMÂNTICO, e o parser aceita", () => {
  const C = 'Algoritmo "p"\nVar\n   i: inteiro\nInicio\n   para i de 1 ate 3 passo 0 faca\n      i <- i + 1\n   fimpara\nFimalgoritmo\n';
  // §15: sintaxe válida. O PARSER aceita.
  const prog = Api.analisar(C);
  eVerdadeiro(prog && prog.tipo === "programa", "o parser aceita passo 0");
  // E a análise semântica recusa, com o código exigido.
  let e = null;
  try {
    Api.analisar(C, { analisarSemantica: true });
  } catch (erro) {
    e = erro;
  }
  eVerdadeiro(e, "a análise semântica deve acusar");
  if (e) {
    eIgual(e.codigo, "INVALID_LOOP_STEP", "código é INVALID_LOOP_STEP");
    eVerdadeiro(e.name === "ErroSemantica", "classe é semântica, veio " + e.name);
  }
});

await su.executar();
su.categoria("debugger", su.total);
process.exitCode = su.imprimirResumo();
