// Testes das extensões §31–§39 — `src/visualg/extensions/extensions.js`.
//
// Executável isolado: `node tests/extensions/extensions.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`) e o módulo das extensões POR ÚLTIMO, que é a ordem
// que o `carga.mjs` vai declarar: o parser e o runtime consultam
// `VG.Extensoes` em tempo de uso, nunca no instante em que são avaliados.
//
// A diferença para o browser é que aqui o módulo chega DEPOIS do `index.js`, o
// agregador — e o agregador é quem publica `W.Vg.Extensoes` e quem mescla
// `registro` em `W.Vg.registros`. As três linhas de mesclagem abaixo repetem o
// que `index.js:79-89` faz, para que este teste exercite os mesmos caminhos
// (inclusive o `Runtime.chamar` falando com o registro) sem precisar de
// `index.html`.
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RAIZ } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULO = "src/visualg/extensions/extensions.js";

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
await import(pathToFileURL(join(RAIZ, MODULO)).href);

const VG = globalThis.VG;
const Vg = globalThis.Vg;
const X = VG.Extensoes;
const { registro, nomes, comandos, vfs, estado } = X;

// O que `index.js` faz no browser, repetido aqui pelo motivo explicado no topo.
for (const chave of Object.keys(registro)) {
  Vg.registros[chave] = registro[chave];
}
Vg.Extensoes = X;

// --------------------------------------------------------------------- asserts

let total = 0;
let pass = 0;
let fail = 0;

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

function secao(titulo) {
  console.log("");
  console.log("-".repeat(66));
  console.log(titulo);
}

function caso(nome, fn) {
  try {
    const detalhe = fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada [" + (e && e.constructor ? e.constructor.name : "?") + "]: " + (e && e.stack ? String(e.stack).split("\n").slice(0, 3).join(" | ") : String(e)));
  }
}

async function casoAsync(nome, fn) {
  try {
    const detalhe = await fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada [" + (e && e.constructor ? e.constructor.name : "?") + "]: " + (e && e.stack ? String(e.stack) : String(e)));
  }
}

function igual(nome, obtido, esperado) {
  caso(nome, () => {
    if (obtido === esperado) return null;
    return "esperado " + JSON.stringify(esperado) + ", veio " + JSON.stringify(obtido);
  });
}

// ------------------------------------------------------------------ infraestrutura

/** Callback de efeitos que só registra: é o "terminal virtual" dos testes. */
let eventos = [];
const AO_EVENTO_PADRAO = function (tipo, dados) {
  eventos.push({ tipo: tipo, dados: dados });
};

/** Zera VFS, flags e a fila de eventos entre casos. */
function resetarEstado() {
  X.reiniciar();
  eventos = [];
  X.aoEvento = AO_EVENTO_PADRAO;
}

resetarEstado();

/** Executa um programa VisuAlg com o motor de verdade. */
async function rodar(codigo, opcoes) {
  const o = opcoes || {};
  const pedacos = [];
  const r = await Vg.executar(codigo, {
    saida: (t) => pedacos.push(t),
    entrada: typeof o.entrada === "function" ? o.entrada : () => Promise.resolve("7"),
    deveParar: o.deveParar || (() => false),
  });
  return { r: r, saida: pedacos.join(""), linhas: pedacos, eventos: eventos };
}

function erroDe(r) {
  return r && r.ok === false ? r.erro : null;
}

/** Envolve um trecho de programa num algoritmo completo. */
function algoritmo(nome, corpo, declaracoes) {
  return (
    'Algoritmo "' + nome + '"\n' +
    (declaracoes ? "Var\n" + declaracoes + "\n" : "") +
    "Inicio\n" + corpo + "\nFimalgoritmo\n"
  );
}

async function main() {
  // ===========================================================================
  // 1. O CONTRATO DO MÓDULO
  // ===========================================================================

  secao("[1/8] Contrato do módulo");

  igual("registro é objeto com as chaves em minúsculas", Object.keys(registro).every((k) => k === k.toLowerCase()), true);
  igual("nomes é lista não vazia", Array.isArray(nomes) && nomes.length > 0, true);
  igual("todo nome de `nomes` tem entrada no registro (bijeção)", nomes.every((n) => registro[n.toLowerCase()] !== undefined), true);
  igual(
    "todo comando tem nome, forma, ajuda e executar",
    Object.keys(comandos).every(
      (k) => comandos[k].nome && comandos[k].forma && comandos[k].ajuda && typeof comandos[k].executar === "function"
    ),
    true
  );
  igual(
    "os comandos da §31–§39 estão todos registrados",
    ["aleatorio", "arquivo", "limpatela", "mudacor", "pausa", "debug", "eco", "cronometro",
     "escrever", "lera", "existe", "apague", "renomeie", "lista", "tamanho", "conteudo",
     "cabecalho", "fim", "nome"].every((k) => comandos[k] !== undefined),
    true
  );
  igual("vfs tem as quatro operações da interface do spec",
    typeof vfs.readFile === "function" && typeof vfs.writeFile === "function" &&
    typeof vfs.exists === "function" && typeof vfs.listFiles === "function", true);
  igual("estado é objeto com as flags da onda", typeof estado.aleatorio === "object" && typeof estado.eco === "object" && typeof estado.cronometro === "object", true);
  igual("aoEvento começa como no-op (motor funciona sem UI)", typeof X.aoEvento, "function");

  // ===========================================================================
  // 2. O VFS — §32
  // ===========================================================================

  secao("[2/8] Filesystem virtual (§32) — nada toca o disco");

  caso("criar arquivo: EXISTE é falso antes e true depois", () => {
    X.reiniciar();
    if (vfs.exists("vfs1.txt")) return "'vfs1.txt' já existia antes de criar";
    vfs.criar("vfs1.txt");
    if (!vfs.exists("vfs1.txt")) return "'vfs1.txt' não existe depois de criar";
    return null;
  });

  caso("ESCREVER + CONTEUDO devolve exatamente o que foi escrito", () => {
    X.reiniciar();
    vfs.criar("notas.txt");
    vfs.arquivos.get("notas.txt").linhas.push("10", "20", "30");
    if (vfs.conteudo("notas.txt", 1, 2) !== "10\n20") return "conteudo(1,2) = " + JSON.stringify(vfs.conteudo("notas.txt", 1, 2));
    if (vfs.conteudo("notas.txt") !== "10\n20\n30") return "conteudo() inteiro = " + JSON.stringify(vfs.conteudo("notas.txt"));
    return null;
  });

  caso("TAMANHO devolve a contagem de caracteres do conteúdo", () => {
    X.reiniciar();
    vfs.writeFile("t.txt", "abcde");
    if (vfs.tamanho("t.txt") !== 5) return "tamanho = " + vfs.tamanho("t.txt");
    return null;
  });

  caso("APAGUE remove e LISTA não devolve mais o nome", () => {
    X.reiniciar();
    vfs.writeFile("a.txt", "1");
    vfs.writeFile("b.txt", "2");
    if (vfs.listFiles().join(",") !== "a.txt,b.txt") return "listagem inicial = " + vfs.listFiles().join(",");
    if (vfs.apagar("a.txt") !== true) return "apagar devolveu falso";
    if (vfs.exists("a.txt")) return "'a.txt' continua existindo";
    if (vfs.listFiles().join(",") !== "b.txt") return "listagem depois = " + vfs.listFiles().join(",");
    if (vfs.apagar("inexistente.txt") !== false) return "apagar de inexistente devolveu true";
    return null;
  });

  caso("RENOMEIE troca o nome e preserva o conteúdo", () => {
    X.reiniciar();
    vfs.writeFile("velho.txt", "conteudo");
    if (vfs.renomeie("velho.txt", "novo.txt") !== true) return "renomeie devolveu falso";
    if (vfs.exists("velho.txt")) return "o nome antigo continua";
    if (vfs.readFile("novo.txt") !== "conteudo") return "conteudo perdido";
    return null;
  });

  caso("NOME devolve o n-ésimo arquivo, 1-based, e '' fora da faixa", () => {
    X.reiniciar();
    vfs.writeFile("um.txt", "1");
    vfs.writeFile("dois.txt", "2");
    if (vfs.nome(1) !== "um.txt") return "nome(1) = " + vfs.nome(1);
    if (vfs.nome(2) !== "dois.txt") return "nome(2) = " + vfs.nome(2);
    if (vfs.nome(0) !== "") return "nome(0) deveria ser ''";
    if (vfs.nome(9) !== "") return "nome(9) deveria ser ''";
    return null;
  });

  caso("FIM é verdadeiro quando o cursor passou da última linha", () => {
    X.reiniciar();
    vfs.writeFile("f.txt", "a\nb");
    if (vfs.fim("f.txt") !== false) return "não começou no fim";
    if (vfs.proximaLinha("f.txt") !== "a" || vfs.proximaLinha("f.txt") !== "b") return "linhas erradas";
    if (vfs.fim("f.txt") !== true) return "deveria estar no fim";
    if (vfs.proximaLinha("f.txt") !== null) return "deveria devolver null no fim";
    return null;
  });

  caso("CABEÇALHO devolve só a região do cabeçalho declarado", () => {
    X.reiniciar();
    vfs.criar("c.txt", 2);
    vfs.arquivos.get("c.txt").linhas.push("titulo", "subtitulo", "dados");
    if (vfs.cabecalho("c.txt") !== "titulo\nsubtitulo") return "cabecalho = " + JSON.stringify(vfs.cabecalho("c.txt"));
    if (vfs.conteudo("c.txt") !== "titulo\nsubtitulo\ndados") return "conteudo = " + JSON.stringify(vfs.conteudo("c.txt"));
    return null;
  });

  caso("NADA TOCA O DISCO: o arquivo virtual não aparece no sistema de arquivos", () => {
    X.reiniciar();
    vfs.writeFile("vfs_probe.txt", "isso so existe na memoria");
    const noDisco = existsSync(join(RAIZ, "vfs_probe.txt"));
    vfs.reiniciar();
    if (noDisco) return "vfs_probe.txt foi criado no disco de verdade";
    return null;
  });

  caso("NADA TOCA O DISCO: o fonte do módulo não menciona fs, fetch, DOM nem storage", () => {
    const bruto = readFileSync(join(RAIZ, MODULO), "utf8");
    // Comentário não é código: um teste que accuse a própria documentação é teste
    // quebrado. Corta `//` e linhas de bloco, como `verificar-carga.mjs` faz.
    const codigo = bruto
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .filter((l) => l.trim() !== "" && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    const proibidos = [
      "require(",
      "node:fs",
      "readFileSync",
      "writeFileSync",
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "document.",
      "import(",
    ];
    const achados = proibidos.filter((p) => codigo.indexOf(p) >= 0);
    if (achados.length > 0) return "o módulo referencia " + achados.join(", ");
    return null;
  });

  // ===========================================================================
  // 3. OS COMANDOS DE ARQUIVO EM PROGRAMA VISUALG
  // ===========================================================================

  secao("[3/8] Comandos de arquivo num programa de verdade");

  await casoAsync("`arquivo` + `ESCREVER` + `CONTEUDO`, lidos por `escreva`", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("arq1", [
      '   arquivo "dados.txt"',
      '   ESCREVER("primeira")',
      '   ESCREVER("segunda")',
      '   escreval(CONTEUDO("dados.txt", 1, 2))',
    ].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "primeira\nsegunda\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`EXISTE` é falso e depois verdadeiro; `TAMANHO` conta", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("arq2", [
      '   escreval(EXISTE("novo.txt"))',
      '   arquivo "novo.txt"',
      '   ESCREVER("12345")',
      '   escreval(EXISTE("novo.txt"))',
      '   escreval(TAMANHO("novo.txt"))',
    ].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "FALSO\nVERDADEIRO\n5\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`APAGUE` e `RENOMEIE` agem sobre o VFS", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("arq3", [
      '   arquivo "um.txt"',
      '   ESCREVER("x")',
      '   RENOMEIE("um.txt", "dois.txt")',
      '   escreval(EXISTE("um.txt"))',
      // `NOME` ficou de fora do registro de propósito: `nome` é nome de variável
      // no corpus (faccat/ex23.alg), e §29.4 proíbe declarar o que é builtin.
      // A listagem de arquivos segue disponível como `ARQUIVOS()`.
      '   escreval(ARQUIVOS())',
      '   APAGUE("dois.txt")',
      '   escreval(EXISTE("dois.txt"))',
    ].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "FALSO\ndois.txt\nFALSO\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`LISTA` escreve a tabela da §32, uma linha por arquivo", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("arq4", [
      '   arquivo "entrada.txt"',
      '   arquivo "dados.txt"',
      "   LISTA",
    ].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const esperado = '"o" "?" " entrada.txt"\n"o" "?" " dados.txt"\n';
    if (saida !== esperado) return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`CABECALHO` e `TAMANHO` leem a região e o conteúdo", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("arq5", [
      '   arquivo "notas.txt", 2',
      '   ESCREVER("nome")',
      '   ESCREVER("materia")',
      '   ESCREVER("10")',
      '   escreval(CABEÇALHO("notas.txt"))',
      // `FIM` ficou de fora do registro pelos mesmos motivos de `NOME`; o fim do
      // arquivo é exposto pelo VFS, e o conteúdo por `TAMANHO`.
      '   escreval(TAMANHO("notas.txt"))',
    ].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    // Compara com o próprio VFS em vez de um número mágico: o que este teste
    // precisa provar é que a primitiva de linguagem e a interface de §32 contam
    // a mesma coisa, não qual é o número.
    const esperado = String(vfs.tamanho("notas.txt"));
    const obtido = saida.trim().split("\n").pop();
    if (saida.indexOf("nome\nmateria\n") !== 0) return "cabecalho = " + JSON.stringify(saida);
    if (obtido !== esperado) return "TAMANHO=" + obtido + " mas VFS=" + esperado;
    return null;
  });

  await casoAsync("`LERA` alimenta o `leia` seguinte, linha a linha", async () => {
    resetarEstado();
    let prompted = 0;
    const { r, saida } = await rodar(
      algoritmo(
        "arq6",
        [
          '   arquivo "entrada.txt"',
          '   ESCREVER("7")',
          '   ESCREVER("9")',
          "   LERA",
          "   leia(a)",
          "   LERA",
          "   leia(b)",
          "   escreval(a + b)",
        ].join("\n"),
        "   a, b: inteiro"
      ),
      { entrada: () => { prompted++; return Promise.resolve("999"); } }
    );
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "16\n") return "saida = " + JSON.stringify(saida);
    if (prompted !== 0) return "o prompt foi chamado " + prompted + " vez(es): LERA não alimentou o leia";
    return null;
  });

  await casoAsync("`LERA` sem `arquivo` é erro nomeado, não exceção crua", async () => {
    resetarEstado();
    const { r } = await rodar(algoritmo("arq7", "   LERA"));
    const e = erroDe(r);
    if (!e) return "esperava erro, veio ok";
    if (e.codigo !== "RUNTIME_ARQUIVO") return "código inesperado: " + e.codigo + " (" + e.mensagem + ")";
    if (typeof e.linha !== "number") return "erro sem linha: " + JSON.stringify(e);
    return null;
  });

  await casoAsync("`TAMANHO` de arquivo inexistente é erro RUNTIME_ARQUIVO com linha", async () => {
    resetarEstado();
    const { r } = await rodar(algoritmo("arq8", '   escreva(TAMANHO("sumiu.txt"))'));
    const e = erroDe(r);
    if (!e) return "esperava erro, veio ok";
    if (e.codigo !== "RUNTIME_ARQUIVO") return "código inesperado: " + e.codigo;
    if (e.linha !== 3) return "linha esperada 3, veio " + e.linha;
    return null;
  });

  // ===========================================================================
  // 4. ALEATORIO — §31
  // ===========================================================================

  secao("[4/8] `aleatorio` muda a origem dos dados do `leia` (§31)");

  await casoAsync("`aleatorio 1,10` faz o `leia` devolver inteiro no intervalo", async () => {
    resetarEstado();
    X.semear(99);
    let prompted = 0;
    const { r, saida } = await rodar(
      algoritmo(
        "ale1",
        ["   aleatorio 1,10", "   leia(a)", "   leia(b)", "   leia(c)", "   escreval(a + b + c)"].join("\n"),
        "   a, b, c: inteiro"
      ),
      { entrada: () => { prompted++; return Promise.resolve("999"); } }
    );
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (prompted !== 0) return "o prompt foi chamado " + prompted + " vez(es): `aleatorio on` não tem prioridade sobre o `entrada`";
    const soma = Number(saida.trim());
    if (!Number.isInteger(soma)) return "soma não é inteiro: " + JSON.stringify(saida);
    if (soma < 3 || soma > 30) return "soma fora de [3,30]: " + soma + " (cada valor tem de estar em 1..10)";
    return null;
  });

  caso("`aleatorio` é REPRODUZÍVEL: mesma semente, mesma sequência", () => {
    resetarEstado();
    const coletas = [];
    for (let k = 0; k < 2; k++) {
      X.reiniciar();
      X.semear(12345);
      comandos.aleatorio.executar([1, 100], null, null);
      const seq = [];
      for (let i = 0; i < 8; i++) seq.push(X.antesDeEntrada(null, ""));
      coletas.push(seq.join(","));
    }
    if (coletas[0] !== coletas[1]) return "sequências diferentes:\n       " + coletas.join("\n       ");
    for (const v of coletas[0].split(",")) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 100) return "valor fora de 1..100: " + v;
    }
    return null;
  });

  caso("sementes diferentes produzem sequências diferentes", () => {
    X.reiniciar();
    X.semear(1);
    comandos.aleatorio.executar([1, 100], null, null);
    const a = [0, 1, 2, 3, 4, 5].map(() => X.antesDeEntrada(null, "")).join(",");
    X.reiniciar();
    X.semear(2);
    comandos.aleatorio.executar([1, 100], null, null);
    const b = [0, 1, 2, 3, 4, 5].map(() => X.antesDeEntrada(null, "")).join(",");
    if (a === b) return "as duas sementes deram a mesma sequência: " + a;
    return null;
  });

  await casoAsync("`aleatorio off` volta ao comportamento normal (o prompt volta)", async () => {
    resetarEstado();
    X.semear(7);
    let prompted = 0;
    const { r, saida } = await rodar(
      algoritmo("ale2", ["   aleatorio 5,5", "   aleatorio off", "   leia(a)", "   escreval(a)"].join("\n"), "   a: inteiro"),
      { entrada: () => { prompted++; return Promise.resolve("42"); } }
    );
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (prompted !== 1) return "o prompt foi chamado " + prompted + " vez(es), esperado 1";
    if (saida !== "42\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`aleatorio on` sem faixa usa 1..100", async () => {
    resetarEstado();
    X.semear(3);
    const { r, saida } = await rodar(algoritmo("ale3", ["   aleatorio on", "   leia(a)", "   escreval(a)"].join("\n"), "   a: inteiro"));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const n = Number(saida.trim());
    if (!Number.isInteger(n) || n < 1 || n > 100) return "valor fora de 1..100: " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`aleatorio 10,1` (faixa invertida) é erro com linha, não valor quebrado", async () => {
    resetarEstado();
    const { r } = await rodar(algoritmo("ale4", "   aleatorio 10,1"));
    const e = erroDe(r);
    if (!e) return "esperava erro, veio ok";
    if (e.codigo !== "RUNTIME_ENTRADA_INVALIDA") return "código inesperado: " + e.codigo;
    if (e.linha !== 3) return "linha esperada 3, veio " + e.linha;
    return null;
  });

  caso("`aleatorio` NÃO é `Rand`/`RandI`: os dois continuam na stdlib §29", () => {
    // `Rand`/`RandI` são FUNÇÕES da biblioteca (§29) e usam `Math.random`.
    // `aleatorio` é STATEMENT de recurso de entrada (§31) e usa o PRNG semeado.
    // Se `aleatorio` aparecesse no `registro`, viraria função chamável; e se
    // `rand`/`randi` tivessem sumido, a §29 estaria quebrada.
    if (registro.rand !== undefined) return "`rand` foi parar no registro das extensões";
    if (registro.randi !== undefined) return "`randi` foi parar no registro das extensões";
    if (registro.aleatorio !== undefined) return "`aleatorio` virou função, e ele é statement";
    if (VG.StdlibMath.registro.rand === undefined) return "`Rand` sumiu da stdlib de matemática";
    if (VG.StdlibMath.registro.randi === undefined) return "`RandI` sumiu da stdlib de matemática";
    if (comandos.aleatorio === undefined) return "`aleatorio` não é statement";
    if (Vg.registros.randi !== VG.StdlibMath.registro.randi) return "o registro global não aponta para a stdlib";
    return null;
  });

  // ===========================================================================
  // 5. UI: limpatela, mudacor, eco, debug, pausa, cronometro
  // ===========================================================================

  secao("[5/8] Efeitos de UI — evento emitido, motor sem DOM (§33, §34, §36–§39)");

  await casoAsync("`limpatela` emite o evento e o programa termina ok", async () => {
    resetarEstado();
    const { r, eventos: ev } = await rodar(algoritmo("ui1", ['   escreval("antes")', "   limpatela", '   escreval("depois")'].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const limpadas = ev.filter((e) => e.tipo === "limpatela");
    if (limpadas.length !== 1) return "eventos 'limpatela': " + limpadas.length;
    if (limpadas[0].dados.linha !== 4) return "linha esperada 4, veio " + limpadas[0].dados.linha;
    return null;
  });

  await casoAsync("`mudacor(\"AMARELO\", \"FRENTE\")` emite a cor e a frente", async () => {
    resetarEstado();
    const { r, eventos: ev } = await rodar(algoritmo("ui2", '   mudacor("AMARELO", "FRENTE")'));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const cores = ev.filter((e) => e.tipo === "cor");
    if (cores.length !== 1) return "eventos 'cor': " + cores.length;
    if (cores[0].dados.cor !== "AMARELO") return "cor = " + cores[0].dados.cor;
    if (cores[0].dados.fundo !== "FRENTE") return "fundo = " + cores[0].dados.fundo;
    if (estado.cor.cor !== "AMARELO" || estado.cor.fundo !== "FRENTE") return "estado.cor = " + JSON.stringify(estado.cor);
    return null;
  });

  await casoAsync("`mudacor` com cor fora do conjunto fechado é erro, sem CSS solto", async () => {
    resetarEstado();
    const { r } = await rodar(algoritmo("ui3", '   mudacor("url(javascript:alert(1))")'));
    const e = erroDe(r);
    if (!e) return "esperava erro, veio ok";
    if (e.codigo !== "TIPO_ARGUMENTOS") return "código inesperado: " + e.codigo;
    return null;
  });

  caso("o conjunto de cores é FECHADO e é só dado (nenhum CSS é gerado aqui)", () => {
    const chaves = Object.keys(X.CORES);
    const esperadas = ["PRETO", "AZUL", "VERDE", "CIANO", "VERMELHO", "MAGENTA", "AMARELO", "BRANCO", "NORMAL"];
    if (chaves.join(",") !== esperadas.join(",")) return "conjunto de cores = " + chaves.join(",");
    return null;
  });

  await casoAsync("`eco on` faz o `leia` mostrar o valor; `eco off` volta a não mostrar", async () => {
    resetarEstado();
    const { r, saida } = await rodar(algoritmo("ui4", ["   eco on", "   leia(a)", "   eco off", "   leia(b)", "   escreval(b)"].join("\n"), "   a, b: inteiro"));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "7" + "7\n") return "saida = " + JSON.stringify(saida) + " (o primeiro 7 é o eco, o segundo vem do escreval)";
    return null;
  });

  caso("`eco` é desligado por DEFAULT: é o que preserva as saídas dos 117 testes", () => {
    resetarEstado();
    if (estado.eco.ligado !== false) return "eco começa ligado: os testes de `tools/testar.mjs` mudariam de saída";
    return null;
  });

  await casoAsync("`debug expr` para quando a expressão é verdadeira e segue sem UI", async () => {
    resetarEstado();
    const { r, saida, eventos: ev } = await rodar(algoritmo("ui5", ["   debug 1 > 2", '   escreval("falso nao para")', "   debug 3 > 2", '   escreval("verdadeiro parou e seguiu")'].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const paradas = ev.filter((e) => e.tipo === "debug");
    if (paradas.length !== 1) return "paradas de debug: " + paradas.length + " (esperado 1)";
    if (paradas[0].dados.linha !== 5) return "linha da parada = " + paradas[0].dados.linha;
    if (saida !== "falso nao para\nverdadeiro parou e seguiu\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`debug` sem expressão é erro de sintaxe com a ajuda do comando", async () => {
    resetarEstado();
    let erro = null;
    try {
      Vg.analisar(algoritmo("ui6", "   debug"));
    } catch (e) {
      erro = e;
    }
    if (!erro) return "a análise aceitou 'debug' sem expressão";
    if (erro.codigo !== "SINTESE_ESPERADO") return "código inesperado: " + erro.codigo;
    if (erro.linha !== 3) return "linha esperada 3, veio " + erro.linha;
    return null;
  });

  await casoAsync("`pausa(10)` não trava o teste e emite o evento de pausa", async () => {
    resetarEstado();
    const inicio = Date.now();
    const { r, eventos: ev } = await rodar(algoritmo("ui7", ["   pausa(10)", '   escreval("depois da pausa")'].join("\n")));
    const decorrido = Date.now() - inicio;
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (decorrido > 3000) return "demorou " + decorrido + "ms: a pausa travou";
    const pausas = ev.filter((e) => e.tipo === "pausa");
    if (pausas.length !== 1) return "eventos 'pausa': " + pausas.length;
    // O evento carrega a INFORMAÇÃO da pausa. Os CONTROLES (continuar/passo/
    // parar) não moram aqui: com o desenho do backlog-debugger.md §22 eles são os
    // do debugger, e a pausa de verdade é a barreira do runtime, que traz
    // ExecutionPoint, variáveis e pilha. Ver o teste "pausa pausa de verdade no
    // runtime" em tests/debugger/debugger.test.mjs.
    if (pausas[0].dados.ms !== 10) return "ms = " + pausas[0].dados.ms;
    if (pausas[0].dados.linha !== 3) return "linha = " + pausas[0].dados.linha;
    return null;
  });

  await casoAsync("sem debugger, `pausa` não congela o programa", async () => {
    // §22: pausar sem ninguém para inspecionar seria um no-op que só trava o
    // programa. O evento ainda é emitido, para observabilidade.
    resetarEstado();
    const { r, saida, eventos: ev } = await rodar(algoritmo("ui7b", ["   pausa", '   escreval("seguiu")'].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (ev.filter((e) => e.tipo === "pausa").length !== 1) return "não emitiu o evento";
    if (saida !== "seguiu\n") return "o programa não seguiu: " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("`pausa` sem argumento também não trava (cede o event loop)", async () => {
    resetarEstado();
    const { r, eventos: ev } = await rodar(algoritmo("ui8", ["   pausa", '   escreval("seguiu")'].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (ev.filter((e) => e.tipo === "pausa").length !== 1) return "não emitiu 'pausa'";
    return null;
  });

  await casoAsync("`cronometro on`/`off` mede com relógio monotônico e emite o resultado", async () => {
    resetarEstado();
    const { r, eventos: ev } = await rodar(algoritmo("ui9", ["   cronometro on", "   cronometro off"].join("\n")));
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    const marcas = ev.filter((e) => e.tipo === "cronometro");
    if (marcas.length !== 2) return "eventos 'cronometro': " + marcas.length;
    if (marcas[0].dados.ligado !== true) return "o primeiro evento devia dizer ligado:true";
    if (marcas[1].dados.ligado !== false) return "o segundo evento devia dizer ligado:false";
    if (typeof marcas[1].dados.ms !== "number" || marcas[1].dados.ms < 0) return "ms = " + marcas[1].dados.ms;
    return null;
  });

  await casoAsync("sem UI nenhuma (aoEvento removido) nada quebra e nada é impresso", async () => {
    resetarEstado();
    X.aoEvento = undefined;
    const { r, saida } = await rodar(algoritmo("ui10", [
      "   limpatela",
      '   mudacor("VERDE", "FUNDO")',
      "   eco on",
      "   leia(a)",
      "   cronometro on",
      "   pausa(5)",
      "   cronometro off",
      '   escreval(a)',
    ].join("\n"), "   a: inteiro"));
    X.aoEvento = AO_EVENTO_PADRAO;
    if (!r.ok) return "erro: " + JSON.stringify(erroDe(r));
    if (saida !== "77\n") return "saida = " + JSON.stringify(saida);
    return null;
  });

  await casoAsync("uma UI que Lança dentro do callback não derruba o programa", async () => {
    resetarEstado();
    X.aoEvento = function () {
      throw new Error("terminal explodiu");
    };
    const { r } = await rodar(algoritmo("ui11", ["   limpatela", '   escreval("ok")'].join("\n")));
    X.aoEvento = AO_EVENTO_PADRAO;
    if (!r.ok) return "o programa do aluno caiu com o painel quebrado: " + JSON.stringify(erroDe(r));
    return null;
  });

  // ===========================================================================
  // 6. AS FORMAS DE SINTAXE QUE O PARSER GANHOU
  // ===========================================================================

  secao("[6/8] Formas aceitas pelo parser");

  /** Comandos de um programa, na ordem em que aparecem. */
  function comandosDo(corpo, declaracoes) {
    const p = Vg.analisar(algoritmo("parse", corpo, declaracoes));
    return p.corpo.filter((c) => c !== null);
  }

  caso("`limpatela` solto, sem parênteses", () => {
    const c = comandosDo("   limpatela");
    if (c.length !== 1 || c[0].tipo !== "extensao") return "nós: " + JSON.stringify(c.map((x) => x.tipo));
    if (c[0].comando !== "limpatela") return "comando = " + c[0].comando;
    if (c[0].argumentos.length !== 0) return "argumentos = " + c[0].argumentos.length;
    return null;
  });

  caso("`aleatorio 1,10` solto, com dois argumentos", () => {
    const c = comandosDo("   aleatorio 1,10");
    if (c[0].argumentos.length !== 2) return "argumentos = " + c[0].argumentos.length;
    if (c[0].argumentos[0].valor !== 1 || c[0].argumentos[1].valor !== 10) return "valores = " + JSON.stringify(c[0].argumentos);
    return null;
  });

  caso("`aleatorio on` vira literal lógico, não identificador", () => {
    const c = comandosDo("   aleatorio on");
    const a = c[0].argumentos[0];
    if (a.tipo !== "literal" || a.valor !== true || a.tipoLiteral !== "lógico") return "nó = " + JSON.stringify(a);
    return null;
  });

  caso("`aleatorio off` e `aleatorio` puro", () => {
    const off = comandosDo("   aleatorio off");
    if (off[0].argumentos[0].valor !== false) return "off virou " + JSON.stringify(off[0].argumentos[0]);
    const puro = comandosDo("   aleatorio");
    if (puro[0].argumentos.length !== 0) return "`aleatorio` puro levou " + puro[0].argumentos.length + " argumento(s)";
    return null;
  });

  caso("`mudacor(\"AMARELO\", \"FRENTE\")` entre parênteses", () => {
    const c = comandosDo('   mudacor("AMARELO", "FRENTE")');
    if (c[0].argumentos.length !== 2) return "argumentos = " + c[0].argumentos.length;
    if (c[0].argumentos[0].valor !== "AMARELO") return "primeiro = " + JSON.stringify(c[0].argumentos[0]);
    return null;
  });

  caso("`eco on` e `cronometro on` aceitam o `on` solto", () => {
    if (comandosDo("   eco on")[0].argumentos[0].valor !== true) return "`eco on` não virou literal";
    if (comandosDo("   cronometro on")[0].argumentos[0].valor !== true) return "`cronometro on` não virou literal";
    return null;
  });

  caso("`debug expressao` lê UMA expressão completa", () => {
    const c = comandosDo("   debug x > 10", "   x: inteiro");
    if (c[0].argumentos.length !== 1) return "argumentos = " + c[0].argumentos.length;
    const a = c[0].argumentos[0];
    if (a.tipo !== "binario" || a.operador !== ">") return "nó = " + JSON.stringify(a);
    return null;
  });

  caso("`ESCREVER(\"linha\")`, `LERA` e `EXISTE(\"a.txt\")` — primitivas de arquivo", () => {
    const c = comandosDo('   arquivo "a.txt"\n   ESCREVER("linha")\n   LERA\n   escreva(EXISTE("a.txt"))');
    const ext = c.filter((x) => x.tipo === "extensao").map((x) => x.comando);
    if (ext.join(",") !== "arquivo,escrever,lera") return "comandos = " + ext.join(",");
    if (c[3].tipo !== "escrever") return "o último comando devia ser 'escreva', veio " + c[3].tipo;
    return null;
  });

  caso("`CABEÇALHO` com acento e sem acento caem no mesmo builtin", () => {
    // O lexer devolve o identificador CRU (`CABEÇALHO` / `CABECALHO`), e é a
    // normalização de acento do `Runtime.chamar` — `registros[nome.toLowerCase()]`
    // mais a chave sem acento — que faz as duas grafias do VisuAlg caírem no
    // mesmo builtin. Verificar o texto do token não provaria nada.
    if (VG.Tokens.chaveDe("CABEÇALHO") !== VG.Tokens.chaveDe("CABECALHO")) {
      return "chaveDe diverge: " + VG.Tokens.chaveDe("CABEÇALHO") + " / " + VG.Tokens.chaveDe("CABECALHO");
    }
    if (VG.Tokens.chaveDe("CABEÇALHO") !== "cabecalho") return "chave = " + VG.Tokens.chaveDe("CABEÇALHO");
    if (Vg.registros[VG.Tokens.chaveDe("CABEÇALHO")] !== registro.cabecalho) {
      return "o runtime não resolveria as duas grafias no mesmo builtin";
    }
    return null;
  });

  caso("REGRESSÃO: `eco` na linha acima de `x <- 1` não engole o `x`", () => {
    const c = comandosDo("   eco on\n   x <- 1", "   x: inteiro");
    if (c[0].tipo !== "extensao") return "primeiro = " + c[0].tipo;
    if (c[0].argumentos.length !== 1) return "`eco on` levou " + c[0].argumentos.length + " argumento(s)";
    if (c[1].tipo !== "atribuicao" || c[1].alvo.nome !== "x") return "segundo = " + JSON.stringify(c[1]);
    return null;
  });

  caso("REGRESSÃO: `aleatorio` na linha acima de `x <- 1` não engole o `x`", () => {
    const c = comandosDo("   aleatorio\n   x <- 1", "   x: inteiro");
    if (c[0].tipo !== "extensao" || c[0].argumentos.length !== 0) return "primeiro = " + JSON.stringify(c[0]);
    if (c[1].tipo !== "atribuicao" || c[1].alvo.nome !== "x") return "segundo = " + JSON.stringify(c[1]);
    return null;
  });

  caso("REGRESSÃO: `ESCREVER` seguido de `escreva(...)` não engole a linha seguinte", () => {
    const c = comandosDo('   arquivo "a.txt"\n   ESCREVER("x")\n   escreva("fim")');
    if (c[2].tipo !== "escrever") return "terceiro comando = " + c[2].tipo + " " + JSON.stringify(c[2].argumentos);
    return null;
  });

  caso("REGRESSÃO: `fim` e `nome` continuam sendo nomes de variável", () => {
    // `fim` e `nome` são nomes de variável no corpus dos 95 exercícios. Promovê-los
    // a palavra-chave (ou sequestrá-los como comando) quebraria programa que hoje
    // funciona, e é a razão de as primitivas de arquivo NÃO serem palavra-chave.
    const p = Vg.analisar(algoritmo("regress", "   fim <- 1\n   nome <- \"ana\"\n   escreval(fim, nome)", "   fim: inteiro\n   nome: literal"));
    const c = p.corpo.filter((x) => x !== null);
    if (c[0].tipo !== "atribuicao" || c[0].alvo.nome !== "fim") return "primeiro = " + JSON.stringify(c[0]);
    if (c[1].tipo !== "atribuicao" || c[1].alvo.nome !== "nome") return "segundo = " + JSON.stringify(c[1]);
    return null;
  });

  caso("REGRESSÃO: os 8 statements novos são palavras-chave reservadas", () => {
    for (const k of ["aleatorio", "arquivo", "limpatela", "mudacor", "pausa", "debug", "eco", "cronometro"]) {
      if (VG.Tokens.palavraChaveDe(k) !== k) return "'" + k + "' não é palavra-chave";
    }
    // E as primitivas de arquivo, deliberadamente, NÃO são:
    for (const k of ["escrever", "lera", "existe", "apague", "renomeie", "lista", "tamanho", "conteudo", "cabecalho", "fim", "nome"]) {
      if (VG.Tokens.palavraChaveDe(k) !== null) return "'" + k + "' virou palavra-chave e quebra o corpus";
    }
    return null;
  });

  // ===========================================================================
  // 7. ERROS SEMPRE VIA DIAGNOSTICS (§46)
  // ===========================================================================

  secao("[7/8] Nenhum erro cru: tudo passa por `Diagnostics.criar`");

  await casoAsync("todos os comandos com entrada errada usam código da hierarquia §46", async () => {
    const entradas = [
      { nome: "mudacor", args: ["LILAS"] },
      { nome: "mudacor", args: ["VERDE", "LADO"] },
      { nome: "aleatorio", args: [10, 1] },
      { nome: "pausa", args: ["dez"] },
      { nome: "debug", args: [] },
      { nome: "existe", args: [] },
      { nome: "nome", args: ["x"] },
      { nome: "tamanho", args: [1, 2] },
    ];
    for (const e of entradas) {
      const def = comandos[e.nome];
      let erro = null;
      try {
        await def.executar(e.args, null, { linha: 7, coluna: 3 });
      } catch (x) {
        erro = x;
      }
      if (!erro) return "'" + e.nome + "' com " + JSON.stringify(e.args) + " NÃO deu erro";
      if (!(erro instanceof VG.Diagnostics.ErroVisualG)) {
        return "'" + e.nome + "' lançou " + erro.constructor.name + ", que não é da hierarquia §46";
      }
      if (!erro.codigo) return "'" + e.nome + "' lançou erro sem código";
      if (erro.linha !== 7 || erro.sourceColumn !== 3) {
        return "'" + e.nome + "' perdeu a posição: linha " + erro.linha + " coluna " + erro.sourceColumn;
      }
    }
    return null;
  });

  // ===========================================================================
  // 8. PROIBIÇÕES DO PROJETO
  // ===========================================================================

  secao("[8/8] Proibições do projeto");

  caso("o módulo não usa eval, Function(), módulos ES nem CDN", () => {
    const bruto = readFileSync(join(RAIZ, MODULO), "utf8");
    const codigo = bruto
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .filter((l) => l.trim() !== "" && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    if (/(?<![.\w$])eval\s*\(/.test(codigo)) return "usa eval()";
    if (/(?<![.\w$])new\s+Function\s*\(/.test(codigo)) return "usa new Function()";
    if (/^import\s/m.test(codigo) || /\bexport\s+(default|const|function)/.test(codigo)) return "usa módulo ES";
    if (/https?:\/\//.test(codigo)) return "carrega recurso remoto";
    return null;
  });

  caso("nenhuma referência a DOM no código do módulo (só no `typeof window` do contrato)", () => {
    const bruto = readFileSync(join(RAIZ, MODULO), "utf8");
    const codigo = bruto
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .filter((l) => l.trim() !== "" && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    const achados = codigo.match(/\b(document|window|self|navigator|HTMLElement|innerHTML)\b/g) || [];
    // `typeof window !== "undefined"` é o contrato de carga e vale.
    const foraDoContrato = achados.filter((a) => a !== "window");
    if (foraDoContrato.length > 0) return "referências a DOM: " + foraDoContrato.join(", ");
    const semContrato = codigo.split("\n").filter((l) => l.indexOf("window") >= 0 && l.indexOf("typeof window") < 0);
    if (semContrato.length > 0) return "uso de window fora do guarda de contrato: " + semContrato.join(" | ");
    return null;
  });

  // Estado limpo ao fim: quem rodar este arquivo a partir de outro (ou
  // importá-lo) não herda VFS, flag de eco nem fila de eventos.
  resetarEstado();
  X.aoEvento = AO_EVENTO_PADRAO;
}

// O corpo fica dentro de `main()` e o `RESUMO` sai no `.then`, em vez de
// `await casoAsync(...)` no topo do módulo: assim o resumo nunca imprime antes
// do último caso, mesmo se algum deles lembrar de devolver um `thenable`.
main().then(function () {
  console.log("");
  console.log("-".repeat(66));
  console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
  if (fail > 0) process.exitCode = 1;
});
