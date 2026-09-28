// Guard de cola entre `script.js` e a API do Debugger.
//
// O bug que motivou este arquivo: `script.js` foi escrito contra uma versão
// ANTERIOR de `debugger.js` e continuou chamando `iniciar()`, `limpar()`,
// `status` e `currentSourceLocation`. Nada disso existia mais. O sintoma no
// browser era o pior possível — o botão Passo lançava `TypeError` DENTRO do
// handler de clique, depois de `estado.rodando = true`, e a UI ficava convicta
// de que havia execução em curso: todos os botões desabilitados, sem caminho
// para sair. A suíte do core continuava 100% verde, porque o core estava certo
// e a cola entre ele e a página é justamente o que nenhuma suíte exercitava.
//
// Aqui a cola é verificada por DUAS vias complementares:
//   1. todo método que `script.js` chama em `dbg`/`estado.debug` tem de existir;
//   2. o clique de Passo/Continuar/Parar é reproduzido de verdade, e cada
//      comando tem de devolver um booleano, nunca uma promessa.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Suite, eIgual, eVerdadeiro, eFalso } from "../lib/harness.mjs";
import { RAIZ } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

for (const s of ORDEM_ENGINE) await import(pathToFileURL(join(RAIZ, s)).href);
const V = globalThis.VG;
const atraso = (ms) => new Promise((r) => setTimeout(r, ms || 1));
const su = new Suite();

const script = readFileSync(join(RAIZ, "script.js"), "utf8");
const html = readFileSync(join(RAIZ, "index.html"), "utf8");

su.secao("Cola script.js ▸ API do Debugger");

// ---------------------------------------------------------------- 1. métodos
su.teste("todo método que script.js chama em `dbg` existe no Debug", () => {
  const chamadas = new Set();
  // `dbg.alterar(...)` e `estado.debug.parar()` — as duas grafias do mesmo objeto.
  for (const re of [/\bdbg\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, /estado\.debug\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g]) {
    let m;
    while ((m = re.exec(script)) !== null) chamadas.add(m[1]);
  }
  eVerdadeiro(chamadas.size > 0, "a varredura achou alguma chamada");
  const dbg = V.Debugger.criar('Algoritmo "x"\nInicio\nFimalgoritmo\n', { saida: () => {} });
  const inexistentes = [];
  for (const nome of chamadas) {
    // `length` vem de `dbg.linhas().length` e `debug` é a própria variável.
    if (nome === "length") continue;
    if (typeof dbg[nome] !== "function") inexistentes.push(nome);
  }
  eIgual(inexistentes.join(","), "", "métodos inexistentes: " + inexistentes.join(", "));
});

su.teste("campos lidos de `estado.debug` existem no Debug", () => {
  // `debug.status === "pausado"` foi exatamente o tipo de leitura que quebrou:
  // `undefined` não é erro, é mentira silenciosa, e a UI desenhava o estado errado.
  const campos = new Set();
  const re = /estado\.debug\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = re.exec(script)) !== null) campos.add(m[1]);
  const dbg = V.Debugger.criar('Algoritmo "x"\nInicio\nFimalgoritmo\n', { saida: () => {} });
  const ausentes = [...campos].filter((c) => !(c in dbg));
  eIgual(ausentes.join(","), "", "campos ausentes: " + ausentes.join(","));
});

su.teste("o retrato traz o que a UI lê, e não o que ela inventava", () => {
  const dbg = V.Debugger.criar('Algoritmo "x"\nVar\n   n: inteiro\nInicio\n   n <- 1\nFimalgoritmo\n', {
    saida: () => {},
  });
  const r = dbg.retrato();
  for (const campo of ["estado", "pausado", "executionPoint", "callStack", "variaveis", "perfil", "breakpoints", "erro", "stats"]) {
    eVerdadeiro(campo in r, "retrato." + campo);
  }
  eVerdadeiro("status" in dbg === false, "Debug NÃO tem `status` — a UI não pode ler");
  eVerdadeiro("currentSourceLocation" in dbg === false, "Debug NÃO tem `currentSourceLocation`");
  eVerdadeiro("linhas" in dbg, "Debug tem `linhas` (breakpoints)");
  // O ponto da §28.1 é derivado da AST e por isso tem `sourceLine` — a coluna
  // existe também, e é ela que permite destacar o statement inteiro.
  const linhas = dbg.codigo.split("\n");
  eVerdadeiro(linhas[0].indexOf("Algoritmo") === 0, "código carregado");
});

su.teste("todo id que script.js procura é criado pelo HTML ou pelo próprio script", () => {
  // Metade da UI de depuração é montada em JS — `criarBotoesDebug()` e
  // `criarGutter()` criam `btn-passo`, `botoes-debug`, `editor-gutter` e afins.
  // Exigir que tudo estivesse no `index.html` acusaria a arquitetura certa de
  // defeito, então a verificação é: o id existe no HTML OU é atribuído por
  // `script.js` antes de ser procurado. O que NÃO pode é um id que não existe
  // em lugar nenhum — aí `$("...")` devolve `null` e o `addEventListener` estoura
  // na inicialização, derrubando o `rotear()` junto.
  const ids = new Set();
  const re = /\$\("([a-zA-Z0-9_-]+)"\)/g;
  let m;
  while ((m = re.exec(script)) !== null) ids.add(m[1]);
  eVerdadeiro(ids.size > 0, "a varredura achou algum id");
  // Um id tem origem se está no HTML, ou se o LITERAL aparece em `script.js` —
  // o toolbar de debug passa os ids por um array `modelos` e faz
  // `b.id = modelos[i][0]`, que nenhuma regex de atribuição pega. A pergunta que
  // importa é "o id é produzido por alguém?", e tanto HTML quanto literal
  // respondem isso.
  const ausentes = [...ids].filter(
    (id) => !html.includes('id="' + id + '"') && !script.includes('"' + id + '"')
  );
  eIgual(ausentes.join(","), "", "ids sem origem: " + ausentes.join(","));
  // Sanidade: o toolbar de debug realmente é criado por script.
  for (const esperado of ["btn-debug", "botoes-debug", "btn-continuar", "btn-passo", "btn-dentro", "btn-fora"]) {
    eVerdadeiro(script.includes('"' + esperado + '"'), "script.js produz " + esperado);
  }
});

// ------------------------------------------------- 2. cliques de verdade
su.teste("o painel renderiza um retrato REAL, e mostra o que a §43–§45 pede", async () => {
  // `debug-panels.js` não tinha NENHUMA cobertura, e por isso leu `variables`,
  // `status`, `currentSourceLocation`, `stepMode` e `executionStats` durante a
  // reescrita do debugger sem uma única falha aparecer: campo ausente é condição
  // falsa, não exceção. O painel "funcionava" vazio. Aqui ele é alimentado por
  // uma execução de verdade, dentro de uma função, e o HTML tem de conter o
  // valor da variável, o nome do frame e a linha.
  // O módulo se pendura em `globalThis.VGPlay` (o mesmo `window.VGPlay` do
  // browser) e não exporta nada — é o contrato de carga clássico, e o teste tem
  // de respeitá-lo em vez de esperar um `export`.
  await import(pathToFileURL(join(RAIZ, "src/playground/debug-panels.js")).href);
  const Painel = globalThis.VGPlay && globalThis.VGPlay.DebugPanels;
  eVerdadeiro(!!Painel && typeof Painel.criar === "function", "DebugPanels carregou");

  const C =
    'Algoritmo "p"\nVar\n   total: inteiro\nInicio\n   total <- fat(3)\n   escreval(total)\nFimalgoritmo\n\n' +
    "funcao fat(n: inteiro): inteiro\ninicio\n   se n <= 1 entao\n      retorne 1\n   fimse\n" +
    "   retorne n * fat(n - 1)\nfimfuncao\n";
  const dbg = V.Debugger.criar(C, { saida: () => {}, maxPassos: 5000 });
  const linhaFat = C.split("\n").findIndex((l) => l.indexOf("retorne n * fat") >= 0) + 1;
  dbg.alternar(linhaFat);
  const sessao = dbg.executar({ pausarNoInicio: false });
  for (let k = 0; k < 300 && !dbg.retrato().pausado; k++) await atraso(1);
  const r = dbg.retrato();
  eVerdadeiro(r.pausado, "pausou dentro de fat(): estado " + r.estado);
  eIgual(r.executionPoint.sourceLine, linhaFat, "o ponto é a linha do return");

  // A camada pura é exportada direto em `DebugPanels`, sem DOM. Testar por ela
  // é o que torna o painel verificável: `criar({doc})` só liga os botões, e
  // exigir um documento real jogaria o teste de volta para o navegador.
  const estado = Painel.dadosEstado(r);
  eIgual(estado.status, "paused", "fita diz paused, e não `undefined`");
  eIgual(estado.rotulo, "Pausado", "a fita rotula em português, não o estado cru");
  eIgual(estado.linha, linhaFat, "fita mostra a linha corrente");
  eIgual(estado.breakpoints.length, 1, "fita lista o breakpoint");
  // O motivo precisa de rótulo também. `breakpoint` é o motivo mais comum — o
  // aluno marca uma linha e para nela — e sem rótulo a fita dizia só "undefined".
  eVerdadeiro(!!estado.passo, "o motivo da pausa tem rótulo: " + estado.passo);

  const variaveis = Painel.dadosVariaveis(r);
  const nomes = [];
  for (const g of variaveis.grupos) for (const v of g.linhas) nomes.push(v.nome);
  eVerdadeiro(nomes.indexOf("n") >= 0, "o parâmetro n aparece no painel: " + nomes.join(","));
  eVerdadeiro(nomes.indexOf("total") >= 0, "a global total aparece: " + nomes.join(","));
  eVerdadeiro(
    variaveis.grupos.some((g) => g.escopo.indexOf("frame:") === 0),
    "há um grupo por frame, e não só Global"
  );

  const pilha = Painel.dadosPilha(r);
  // Depth 1, e está certo: o breakpoint está em `retorne n * fat(n - 1)`, e a
  // chamada recursiva acontece NESSA linha — ainda estamos dentro de fat(3).
  eVerdadeiro(pilha.length >= 1, "a pilha tem o frame de fat(): " + pilha.length);
  eVerdadeiro(
    pilha.some((f) => /fat\(/.test(f.rotulo)),
    "rótulo com o valor do argumento: " + JSON.stringify(pilha.map((f) => f.rotulo))
  );
  eVerdadeiro(pilha.some((f) => f.ativo), "algum frame é o ativo");

  const perfil = Painel.dadosPerfil(r);
  eVerdadeiro(perfil.linhas.length > 0, "o perfil conta statements");
  eVerdadeiro(perfil.totais.comandos > 0, "total de statements > 0");

  // As quatro seções HTML, cada uma alimentada com o retrato real.
  const secoes = [Painel.htmlEstado(r), Painel.htmlVariaveis(r), Painel.htmlPilha(r), Painel.htmlPerfil(r)];
  for (const s of secoes) {
    eVerdadeiro(typeof s === "string" && s.length > 0, "seção html gerada");
    eVerdadeiro(s.indexOf("undefined") < 0, "html não vaza `undefined`: " + s.slice(0, 160));
  }
  eVerdadeiro(secoes[2].indexOf("fat(") >= 0, "a pilha em html mostra o frame");
  eVerdadeiro(secoes[1].indexOf("total") >= 0, "as variáveis em html mostram a global");
  eVerdadeiro(Painel.html(r).length > 0, "html() monta o painel inteiro");
  eVerdadeiro(secoes[0].indexOf("Pausado") >= 0, "a fita em html está em português");

  dbg.parar();
  await Promise.race([sessao, atraso(500)]);
});

su.teste("Passo/Continuar/Parar devolvem booleano, nunca promessa", async () => {
  // A cola antiga encadeava `.then()` no retorno de cada comando. Com booleanos
  // isso é `TypeError` no clique, que é como o programa travava sem saída.
  const dbg = V.Debugger.criar('Algoritmo "p"\nInicio\n   escreval("a")\n   escreval("b")\nFimalgoritmo\n', {
    saida: () => {},
    maxPassos: 1000,
  });
  const sessao = dbg.executar();
  for (let k = 0; k < 200 && dbg.estado !== "paused"; k++) await atraso(1);
  eVerdadeiro(dbg.estado === "paused", "pausou no início: " + dbg.estado);

  const rPasso = dbg.passo(V.Debugger.PASSO.SOBRE);
  eFalso(rPasso && typeof rPasso.then === "function", "passo() não devolve promessa");
  eIgual(typeof rPasso, "boolean", "passo() devolve boolean");

  for (let k = 0; k < 200 && dbg.estado === "paused"; k++) await atraso(1);
  const rContinuar = dbg.continuar();
  eIgual(typeof rContinuar, "boolean", "continuar() devolve boolean");

  const rParar = dbg.parar();
  eIgual(typeof rParar, "boolean", "parar() devolve boolean");
  const fim = await Promise.race([sessao.then(() => "ok"), atraso(1000).then(() => "TRAVOU")]);
  eIgual(fim, "ok", "a sessão termina depois de parar()");
});

su.teste("a sessão de UI sobrevive ao ciclo Executar ▸ Passo ▸ Continuar", async () => {
  const linhas = [];
  const dbg = V.Debugger.criar(
    'Algoritmo "p"\nVar\n   n: inteiro\nInicio\n   n <- 1\n   n <- 2\n   escreval(n)\nFimalgoritmo\n',
    { saida: (t) => linhas.push(t), maxPassos: 1000 }
  );
  const sessao = dbg.executar();
  for (let k = 0; k < 200 && dbg.estado !== "paused"; k++) await atraso(1);
  eVerdadeiro(dbg.estado === "paused", "pausou antes do primeiro statement");

  let guarda = 0;
  while (dbg.estado === "paused" && guarda++ < 20) {
    dbg.passo(V.Debugger.PASSO.SOBRE);
    for (let k = 0; k < 200 && dbg.estado !== "paused"; k++) await atraso(1);
  }
  eVerdadeiro(guarda > 1, "houve mais de uma pausa para percorrer");
  const fim = await Promise.race([sessao.then(() => "ok"), atraso(1000).then(() => "TRAVOU")]);
  eIgual(fim, "ok", "terminou sem travar");
  eIgual(linhas.join(""), "2\n", "o programa rodou até o fim, com o valor certo");
});

su.teste("`parar()` é a válvula de escape: funciona mesmo com o espelho errado", async () => {
  // A UI antiga condicionava `parar()` a `estado.rodando`, um espelho do que a
  // página ACREDITA estar acontecendo. Se o espelho dessincroniza, o botão fica
  // habilitado e não faz nada. Aqui a sessão é parada direto, sem espelho.
  const dbg = V.Debugger.criar('Algoritmo "p"\nInicio\n   escreval("a")\nFimalgoritmo\n', {
    saida: () => {},
    maxPassos: 1000,
  });
  const sessao = dbg.executar();
  for (let k = 0; k < 200 && dbg.estado !== "paused"; k++) await atraso(1);
  eVerdadeiro(dbg.estado === "paused", "pausado");
  dbg.parar();
  const fim = await Promise.race([sessao.then(() => "ok"), atraso(1000).then(() => "TRAVOU")]);
  eIgual(fim, "ok", "parar() devolve a sessão");
  // Terminal e recusando comandos — `stopped` ou `finished` são ambos aceitáveis:
  // o programa pode ter terminado a execução no instante da parada, e exigir
  // `stopped` mediria uma corrida, não o comportamento.
  eVerdadeiro(
    ["stopped", "finished"].indexOf(dbg.retrato().estado) >= 0,
    "estado final terminal: " + dbg.retrato().estado
  );
  eVerdadeiro(dbg.estadoDebug !== undefined, "estadoDebug() ainda responde (alias de retrato)");
  // Depois de parar, os comandos recusam em vez de fingir que adiantaram.
  eVerdadeiro(dbg.passo(V.Debugger.PASSO.SOBRE) === false, "passo() recusa depois de parar");
  eVerdadeiro(dbg.continuar() === false, "continuar() recusa depois de parar");
});

await su.executar();
su.categoria("playground", su.total);
process.exitCode = su.imprimirResumo();
