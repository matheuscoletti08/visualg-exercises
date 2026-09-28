// Testes da análise semântica (§47) — `src/visualg/semantic.js`.
//
// Executável isolado: `node tests/semantic/semantic.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`) e importa o `semantic.js` por ÚLTIMO, porque o módulo
// consome `VG.Diagnostics` e `VG.Environment` no instante em que é avaliado.
// `semantic.js` ainda não está no contrato de carga (`carga.mjs`/`index.html`
// são de outra onda); quando entrar, ele vai entre `api.js` e `index.js`.
//
// `analisarSemantica` é OPCIONAL de propósito: `Vg.analisar(codigo)` sozinho
// continua sendo só lexe+parse, que é o que o realce/autocomplete/formatter
// chamam a cada tecla. A suíte de 117 testes de `tools/testar.mjs` depende
// desse default, e um teste daqui existe só para travar essa garantia.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULO = "src/visualg/semantic.js";

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
await import(pathToFileURL(join(RAIZ, MODULO)).href);

const VG = globalThis.VG;
const Vg = globalThis.Vg;

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

/** Um caso passa devolvendo `null`, e falha devolvendo a razão. */
function caso(nome, fn) {
  try {
    const detalhe = fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada: " + (e && e.message ? e.message : String(e)));
  }
}

function secao(titulo) {
  console.log("");
  console.log(titulo);
  console.log("-".repeat(66));
}

// ----------------------------------------------------------------- ferramentas

/** Analisa com a análise semântica LIGADA. */
function checar(codigo) {
  return Vg.analisar(codigo, { analisarSemantica: true });
}

/** Roda e devolve o erro da análise semântica, ou `null` se passou. */
function falha(codigo) {
  try {
    checar(codigo);
  } catch (e) {
    return e;
  }
  return null;
}

/** `true` se a análise deu erro cujo código é `codigo`. */
function falhouCom(codigo, fonte) {
  const e = falha(fonte);
  if (!e) return false;
  return e.codigo === codigo;
}

function descreverErro(e) {
  return e
    ? "[" + e.codigo + "] linha " + e.linha + ": " + e.message
    : "a análise semântica NÃO acusou erro";
}

/** Confere que o erro tem o código e o trecho de mensagem esperados. */
function erroEsperado(nome, fonte, codigo, pedaco) {
  caso(nome, () => {
    const e = falha(fonte);
    if (!e) return "esperava erro, veio nenhum";
    if (e.codigo !== codigo) return "código " + e.codigo + " em vez de " + codigo + " — " + e.message;
    if (pedaco && e.message.toLowerCase().indexOf(pedaco.toLowerCase()) < 0) {
      return "mensagem não contém '" + pedaco + "': " + e.message;
    }
    if (typeof e.linha !== "number") return "erro sem linha numérica: " + descreverErro(e);
    if (e.name !== e.constructor.name) return "nome do erro inconsistente";
    if (!(e instanceof VG.Diagnostics.ErroVisualG)) {
      return "erro fora da hierarquia de §46: " + e.constructor.name;
    }
    return null;
  });
}

/** Confirma que a análise NÃO acusa nada. */
function aceito(nome, fonte) {
  caso(nome, () => {
    try {
      checar(fonte);
    } catch (e) {
      return "a análise reprovou um programa válido: " + descreverErro(e);
    }
    return null;
  });
}

// ===========================================================================
// 1. A ARMADILHA DO CORPUS: `inicio: inteiro` é palavra-chave usada como nome
// ===========================================================================

secao("[1/6] Grafia bruta de palavra-chave usada como nome (faccat/ex21.alg)");

const EX21 = lerAlg(join(RAIZ, "faccat", "ex21.alg"));

caso("faccat/ex21.alg declara 'inicio: inteiro' e usa 'inicio' em cinco posições", () => {
  if (EX21.indexOf("inicio: inteiro") < 0) return "o corpus mudou: ex21 não declara mais 'inicio'";
  if (EX21.indexOf("início") >= 0) return "o corpus mudou: ex21 passou a usar a forma acentuada";
  return null;
});

aceito("ex21 inteiro passa na análise semântica", EX21);

aceito(
  "leia(inicio) e 'fim >= inicio' são reconhecidos no ex21",
  EX21.replace("escreval(\"Duracao: \", duracao, \" horas\")", "escreval(fim >= inicio, duracao)")
);

caso("análise resolve 'inicio' pela GRAFIA BRUTA, e não pela canônica 'início'", () => {
  // Se alguém "corrigir" `inicio` para `início` na resolução de nomes, o uso
  // acentuado abaixo passa a ser encontrado e este teste falha. É o teste que
  // trava a decisão.
  const comAcento = EX21.replace("leia(inicio)", "leia(início)");
  const e = falha(comAcento);
  if (!e) return "'início' acentuado foi aceito: a grafia está sendo normalizada";
  if (!/não declarada/i.test(e.message)) return "erro inesperado: " + descreverErro(e);
  if (e.message.indexOf("'início'") < 0) return "a mensagem não cita o nome como foi escrito: " + e.message;
  return null;
});

caso("sem a declaração de 'inicio', o uso passa a ser erro (a checagem não é décor)", () => {
  const semDeclaracao = EX21.replace("   inicio: inteiro\n", "");
  const e = falha(semDeclaracao);
  if (!e) return "a análise aceitou 'inicio' sem declaração — ou seja, não está olhando";
  if (e.codigo !== "TIPO_NAO_DECLARADO") return "código inesperado: " + descreverErro(e);
  if (e.linha !== 11) return "linha esperada 11 (o leia), veio " + e.linha;
  return null;
});

// ===========================================================================
// 2. O CORPUS INTEIRO — o teste de regressão mais importante da onda
// ===========================================================================

secao("[2/6] Os " + todosAlgs().length + " arquivos do corpus passam na análise semântica");

caso(
  todosAlgs().length + "/" + todosAlgs().length + " .alg passam em Vg.analisar(..., {analisarSemantica:true})",
  () => {
    const reprovados = [];
    for (const arquivo of todosAlgs()) {
      const rel = caminhoRelativo(arquivo);
      try {
        checar(lerAlg(arquivo));
      } catch (e) {
        reprovados.push(rel + " → " + descreverErro(e));
      }
    }
    if (reprovados.length === 0) return null;
    return reprovados.length + " reprovado(s):\n       " + reprovados.join("\n       ");
  }
);

caso("a análise semântica NÃO é ativada por padrão (os 117 testes de testar.mjs dependem disso)", () => {
  // `Vg.analisar(codigo)` é o caminho do realce, do autocomplete e do
  // formatter: lexe + parse, e só. Se alguém ligar a análise semântica aqui, os
  // 95 arquivos de `tools/testar.mjs` passam a reprovar.
  const naoDeclarada = 'Algoritmo "x"\nInicio\n y <- 1\nFimalgoritmo';
  try {
    Vg.analisar(naoDeclarada);
  } catch (e) {
    return "Vg.analisar sem opção já errou: " + descreverErro(e);
  }
  return null;
});

caso("a opção analyzeSemantica=true liga a análise pelo gancho de api.js", () => {
  // É o gancho que `api.js:51` já tinha: `new VG.Semantica(programa, fonte).analisar()`.
  if (typeof VG.Semantica !== "function") return "VG.Semantica não é uma classe";
  const e = falha('Algoritmo "x"\nInicio\n y <- 1\nFimalgoritmo');
  if (!e) return "o gancho de api.js não disparou";
  return null;
});

// ===========================================================================
// 3. As nove verificações da §47
// ===========================================================================

secao("[3/6] Verificações da §47");

// --- (1) variável não declarada -------------------------------------------
erroEsperado(
  "1a. variável não declarada em escrita",
  'Algoritmo "a"\nInicio\n x <- 1\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "não declarada"
);
erroEsperado(
  "1b. variável não declarada em leitura",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 1\n escreva(y)\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "'y' não declarada"
);
erroEsperado(
  "1c. variável não declarada em leia",
  'Algoritmo "a"\nInicio\n leia(z)\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "'z' não declarada"
);
erroEsperado(
  "1d. alvo indexado de variável inexistente",
  'Algoritmo "a"\nVar\n i: inteiro\nInicio\n i <- 1\n v[i] <- 2\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "'v' não declarada"
);
erroEsperado(
  "1e. variável não declarada nos argumentos de uma chamada",
  'Algoritmo "a"\nInicio\n f(z)\nFimalgoritmo\nprocedimento f(k: inteiro)\nInicio\nfimprocedimento',
  "TIPO_NAO_DECLARADO",
  "'z' não declarada"
);
erroEsperado(
  "1f. alvo indexado de escalar é erro de tipo",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- x[1]\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "não aceita índice"
);

// --- (2) redeclaração ------------------------------------------------------
erroEsperado(
  "2a. redeclaração no mesmo escopo (dois comandos 'var')",
  'Algoritmo "a"\nVar\n x: inteiro\n x: real\nInicio\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "já declarada"
);
erroEsperado(
  "2b. redeclaração na mesma lista de nomes",
  'Algoritmo "a"\nVar\n x, x: inteiro\nInicio\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "já declarada"
);
erroEsperado(
  "2c. subprograma declarado duas vezes",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(): inteiro\nInicio\n retorne 1\nfimfunção\nfuncao f(): inteiro\nInicio\n retorne 2\nfimfunção',
  "TIPO_NAO_DECLARADO",
  "duas vezes"
);
erroEsperado(
  "2d. parâmetro declarado duas vezes",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(a, a: inteiro): inteiro\nInicio\n retorne a\nfimfunção',
  "TIPO_NAO_DECLARADO",
  "duas vezes"
);

// --- (3) tipo declarado x tipo usado ---------------------------------------
erroEsperado(
  "3a. 'x: inteiro' <- \"abc\" (o exemplo da §47)",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- "abc"\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "'abc'"
);
erroEsperado(
  "3b. real com parte fracionária em 'inteiro'",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 2.5\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "fracionária"
);
erroEsperado(
  "3c. vetor em 'literal'",
  'Algoritmo "a"\nVar\n t: literal\n v: vetor[1..3] de real\nInicio\n t <- v\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "vetor"
);
erroEsperado(
  "3d. elemento de vetor recebe o tipo do elemento declarado",
  'Algoritmo "a"\nVar\n v: vetor[1..3] de inteiro\nInicio\n v[1] <- 1.5\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "fracionária"
);
erroEsperado(
  "3e. condição de 'se' que não é lógica",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n se (x + 1) entao\n  escreva("a")\n fimse\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "lógica"
);
erroEsperado(
  "3f. matriz indexada com um índice só",
  'Algoritmo "a"\nVar\n m: matriz[1..2,1..2] de inteiro\nInicio\n m[1] <- 5\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "2 índices"
);
aceito(
  "3g. divisão exata em 'inteiro' NÃO é erro (§10)",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 6 / 3\nFimalgoritmo'
);
aceito(
  "3h. '2^3' vale 8, então continua inteiro",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 2 ^ 3\nFimalgoritmo'
);
aceito(
  "3i. inteiro em 'real' sobe sem reclamar",
  'Algoritmo "a"\nVar\n x: real\nInicio\n x <- 7\nFimalgoritmo'
);
aceito(
  "3j. texto de outra variável em 'real' é indecidível, então passa",
  'Algoritmo "a"\nVar\n x: real\n t: literal\nInicio\n t <- "1"\n x <- t\nFimalgoritmo'
);
aceito(
  "3k. leia() em vetor dentro de 'para' (§28)",
  'Algoritmo "a"\nVar\n v: vetor[1..3] de real\n i: inteiro\nInicio\n para i de 1 ate 3 faca\n  leia(v[i])\n fimpara\nFimalgoritmo'
);

// --- (4) aridade e tipos dos argumentos ------------------------------------
erroEsperado(
  "4a. aridade errada em chamada de função",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- f(1)\nFimalgoritmo\nfuncao f(a, b: inteiro): inteiro\nInicio\n retorne a + b\nfimfunção',
  "TIPO_ARGUMENTOS",
  "espera 2 argumento(s) e recebeu 1"
);
erroEsperado(
  "4b. aridade errada em chamada de procedimento",
  'Algoritmo "a"\nInicio\n p(1, 2)\nFimalgoritmo\nprocedimento p(a: inteiro)\nInicio\nfimprocedimento',
  "TIPO_ARGUMENTOS",
  "espera 1 argumento(s) e recebeu 2"
);
erroEsperado(
  "4c. tipo de argumento incompatível com o parâmetro",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- f("ana")\nFimalgoritmo\nfuncao f(a: inteiro): inteiro\nInicio\n retorne a\nfimfunção',
  "TIPO_INCOMPATIVEL",
  "argumento 1"
);
erroEsperado(
  "4d. parâmetro 'var' (§25) não aceita valor calculado",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 1\n dobro(x + 1)\nFimalgoritmo\nprocedimento dobro(var v: inteiro)\nInicio\n v <- v * 2\nfimprocedimento',
  "TIPO_ARGUMENTOS",
  "por referência"
);
erroEsperado(
  "4e. retorno de função incompatível com o tipo declarado",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(): inteiro\nInicio\n retorne "abc"\nfimfunção',
  "TIPO_INCOMPATIVEL",
  "retorno de 'f'"
);
erroEsperado(
  "4f. subprograma inexistente (§47)",
  'Algoritmo "a"\nVar\n x: real\nInicio\n x <- naoexiste(1)\nFimalgoritmo',
  "TIPO_NAO_DECLARADO",
  "não declarado"
);
aceito(
  "4g. chamada de builtin (§29) é validada pela stdlib, não aqui",
  'Algoritmo "a"\nVar\n x: real\nInicio\n x <- Sen(90)\nFimalgoritmo'
);
aceito(
  "4h. parâmetro 'var' com variável e com célula de vetor (§25)",
  'Algoritmo "a"\nVar\n x: inteiro\n v: vetor[1..3] de inteiro\nInicio\n dobro(x)\n dobro(v[2])\nFimalgoritmo\nprocedimento dobro(var q: inteiro)\nInicio\n q <- q * 2\nfimprocedimento'
);

// --- (5) retorno em todos os caminhos -------------------------------------
erroEsperado(
  "5a. função com tipo de retorno e 'retorne' só em um caminho",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(x: inteiro): inteiro\nInicio\n se x > 0 entao\n  retorne 1\n fimse\nfimfunção',
  "TIPO_INCOMPATIVEL",
  "nem todos os caminhos"
);
erroEsperado(
  "5b. função que nunca retorna",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(x: inteiro): inteiro\nInicio\n escreva(x)\nfimfunção',
  "TIPO_INCOMPATIVEL",
  "nem todos os caminhos"
);
erroEsperado(
  "5c. 'retorne' com valor dentro de procedimento",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nprocedimento p()\nInicio\n retorne 1\nfimprocedimento',
  "TIPO_INCOMPATIVEL",
  "não retorna valor"
);
aceito(
  "5d. função com 'retorne' nos dois ramos do 'se'",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(x: inteiro): inteiro\nInicio\n se x > 0 entao\n  retorne 1\n senao\n  retorne 0\n fimse\nfimfunção'
);
aceito(
  "5e. função com 'retorne' ao fim do corpo",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao dobro(x: inteiro): inteiro\nInicio\n x <- x * 2\n retorne x\nfimfunção'
);
aceito(
  "5f. 'retorne' sem valor em procedimento é a saída antecipada de §23",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nprocedimento p()\nInicio\n retorne\nfimprocedimento'
);
aceito(
  "5g. função sem tipo de retorno não é obrigada a ter 'retorne'",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao imprime(x: inteiro)\nInicio\n escreva(x)\nfimfunção'
);

// --- (6) recursão (§27) ----------------------------------------------------
aceito(
  "6a. fatorial recursivo é aceito",
  [
    'Algoritmo "fatorial"',
    "Var",
    "   n: inteiro",
    "Inicio",
    "   n <- 5",
    "   escreval(fat(n))",
    "Fimalgoritmo",
    "funcao fat(n: inteiro): inteiro",
    "Inicio",
    "   se n <= 1 entao",
    "      retorne 1",
    "   senao",
    "      retorne n * fat(n - 1)",
    "   fimse",
    "fimfunção",
  ].join("\n")
);
aceito(
  "6b. recursão mútua (par chama impar e vice-versa) é aceita",
  [
    'Algoritmo "m"',
    "Var",
    "   n: inteiro",
    "Inicio",
    "   n <- 4",
    "   escreval(par(n))",
    "Fimalgoritmo",
    "funcao par(n: inteiro): logico",
    "Inicio",
    "   se n = 0 entao",
    "      retorne verdadeiro",
    "   senao",
    "      retorne impar(n - 1)",
    "   fimse",
    "fimfunção",
    "funcao impar(n: inteiro): logico",
    "Inicio",
    "   se n = 0 entao",
    "      retorne falso",
    "   senao",
    "      retorne par(n - 1)",
    "   fimse",
    "fimfunção",
  ].join("\n")
);
caso("6c. a profundidade da recursão continua sendo problema de RUNTIME (limiteRecursao)", () => {
  // A análise semântica não pode reprovar recursão (§27), e também não pode
  // fingir que resolve o estouro de pilha: isso é `Contexto.limiteRecursao`,
  // padrão 2000, e é erro de runtime.
  const Contexto = VG.Environment.Contexto;
  const c = new Contexto();
  if (c.limiteRecursao !== 2000) return "limiteRecursao padrão mudou: " + c.limiteRecursao;
  return null;
});

// --- (7) nome reservado (§29.4) -------------------------------------------
erroEsperado(
  "7a. 'funcao sen' é nome reservado",
  'Algoritmo "a"\nVar\n x: real\nInicio\n x <- 1\nFimalgoritmo\nfuncao sen(x: real): real\nInicio\n retorne x\nfimfunção',
  "RUNTIME_NOME_RESERVADO",
  "'sen' é nome reservado"
);
erroEsperado(
  "7b. 'procedimento copia' é nome reservado",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nprocedimento copia()\nInicio\nfimprocedimento',
  "RUNTIME_NOME_RESERVADO",
  "'copia' é nome reservado"
);
erroEsperado(
  "7c. variável com nome de builtin é nome reservado",
  'Algoritmo "a"\nVar\n abs: inteiro\nInicio\n abs <- 1\nFimalgoritmo',
  "RUNTIME_NOME_RESERVADO",
  "'abs' é nome reservado"
);
erroEsperado(
  "7d. parâmetro com nome de builtin também é reservado",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(raizq: real): real\nInicio\n retorne raizq\nfimfunção',
  "RUNTIME_NOME_RESERVADO",
  "'raizq' é nome reservado"
);
caso("7e. a lista usada é a de Environment.NOMES_RESERVADOS, não uma cópia local", () => {
  const reservados = VG.Environment.NOMES_RESERVADOS;
  const registros = globalThis.Vg.registros;
  // A lista tem de bater com o registro da stdlib (§29, §30). Se o arquivo
  // ganhasse um builtin e a lista não, a checagem de 7a pararia de proteger.
  for (const nome of Object.keys(registros)) {
    if (VG.Environment.ehNomeReservado(nome) !== true) {
      return "builtin '" + nome + "' não está em NOMES_RESERVADOS";
    }
  }
  for (const nome of reservados) {
    if (registros[nome] === undefined) return "'" + nome + "' está reservado mas não é builtin nenhum";
  }
  return null;
});

// --- (8) `interrompa` fora de laço (§22) ------------------------------------
erroEsperado(
  "8a. 'interrompa' no corpo do algoritmo",
  'Algoritmo "a"\nInicio\n interrompa\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "fora de"
);
erroEsperado(
  "8b. 'interrompa' dentro de função, mas fora de laço",
  'Algoritmo "a"\nInicio\nFimalgoritmo\nfuncao f(): inteiro\nInicio\n interrompa\nfimfunção',
  "TIPO_INCOMPATIVEL",
  "fora de"
);
aceito(
  "8c. 'interrompa' dentro de 'se' dentro de laço é válido",
  'Algoritmo "a"\nVar\n i: inteiro\nInicio\n para i de 1 ate 3 faca\n  se i = 2 entao\n   interrompa\n  fimse\n fimpara\nFimalgoritmo'
);
aceito(
  "8d. 'interrompa' dentro de 'escolha' é a saída do 'caso' (§18)",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n escolha x\n caso 1\n  escreva("um")\n  interrompa\n outrocaso\n  escreva("outro")\n fimescolha\nFimalgoritmo'
);

// --- (9) `retorne` fora de subprograma (§26) --------------------------------
erroEsperado(
  "9a. 'retorne' no corpo do algoritmo",
  'Algoritmo "a"\nInicio\n retorne 1\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "dentro de 'função' ou 'procedimento'"
);
erroEsperado(
  "9b. 'retorne' dentro de 'se' no corpo do algoritmo",
  'Algoritmo "a"\nVar\n x: inteiro\nInicio\n se x > 0 entao\n  retorne 1\n fimse\nFimalgoritmo',
  "TIPO_INCOMPATIVEL",
  "dentro de 'função' ou 'procedimento'"
);

// ===========================================================================
// 4. Nenhum erro cru de JavaScript
// ===========================================================================

secao("[4/6] Nenhum erro cru: tudo passa por Diagnostics (§46)");

caso("todo erro da análise é da hierarquia de §46, com código e posição", () => {
  const casos = [
    'Algoritmo "a"\nInicio\n x <- 1\nFimalgoritmo',
    'Algoritmo "a"\nVar\n x: inteiro\n x: real\nInicio\nFimalgoritmo',
    'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- "abc"\nFimalgoritmo',
    'Algoritmo "a"\nInicio\n interrompa\nFimalgoritmo',
    'Algoritmo "a"\nInicio\n retorne\nFimalgoritmo',
    'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- f(1)\nFimalgoritmo\nfuncao f(a, b: inteiro): inteiro\nInicio\n retorne a\nfimfunção',
  ];
  for (const codigo of casos) {
    const e = falha(codigo);
    if (!e) return "esperava erro em:\n" + codigo;
    if (!(e instanceof VG.Diagnostics.ErroVisualG)) {
      return "erro fora de ErroVisualG: " + e.constructor.name + " — " + e.message;
    }
    if (typeof e.codigo !== "string" || e.codigo.length === 0) {
      return "erro sem código: " + e.message;
    }
    if (e.codigo === "DESCONHECIDO") return "código genérico: " + e.message;
    if (typeof e.linha !== "number") return "erro sem linha: " + e.message;
    // `mensagem` e `linha` são os alias que `script.js` e o harness leem.
    if (e.mensagem !== e.message || e.linha !== e.sourceLine) {
      return "alias de compatibilidade perdido (§46): " + e.message;
    }
    const obj = VG.Diagnostics.serializar(e);
    if (obj.codigo !== e.codigo || obj.mensagem !== e.message) return "serializar() perdeu o código";
  }
  return null;
});

caso("o erro traz o trecho da linha original para o console da UI", () => {
  const fonte = 'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- "abc"\nFimalgoritmo';
  const e = falha(fonte);
  if (!e) return "esperava erro";
  if (!e.exibir) return "erro sem 'exibir' — a UI não consegue apontar a linha";
  if (e.exibir.indexOf("x <- \"abc\"") < 0) return "exibir não traz a linha do erro: " + e.exibir;
  return null;
});

caso("análise semântica não é ativada sem a opção, mesmo com a classe carregada", () => {
  const comOpcao = { analisarSemantica: true };
  const semOpcao = {};
  const fonte = 'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- "abc"\nFimalgoritmo';
  let comErro = 0;
  try {
    Vg.analisar(fonte, comOpcao);
  } catch {
    comErro++;
  }
  let semErro = 0;
  try {
    Vg.analisar(fonte, semOpcao);
  } catch {
    semErro++;
  }
  if (comErro !== 1) return "com analisarSemantica:true deveria falhar";
  if (semErro !== 0) return "sem a opção não deveria falhar";
  return null;
});

caso("o módulo publica a classe no contrato do engine e devolve um relatório", () => {
  if (typeof VG.Semantica !== "function") return "VG.Semantica não publicado";
  const fonte = 'Algoritmo "a"\nVar\n x: inteiro\nInicio\nFimalgoritmo';
  const programa = Vg.analisar(fonte);
  const rel = new VG.Semantica(programa, fonte).analisar();
  if (!rel || rel.variaveis !== 1) return "relatório inesperado: " + JSON.stringify(rel);
  return null;
});

caso("checar tipo errado não engole o erro: 'analisar' devolve programa, não relatório", () => {
  const fonte = 'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 1\nFimalgoritmo';
  const programa = Vg.analisar(fonte, { analisarSemantica: true });
  if (!programa || programa.tipo !== "programa") {
    return "analisar devolveu " + JSON.stringify(programa && programa.tipo);
  }
  if (programa.variaveis.length !== 1) return "a AST voltou incompleta";
  return null;
});

// ===========================================================================
// 5. Coerência com o runtime
// ===========================================================================

secao("[5/6] Coerência com o runtime: o que a análise acusa, o runtime também");

caso("a análise não recusa o que `Values.coagir` aceita", () => {
  // §10/§46: `Environment.atribuir` coage o valor. Os quatro casos abaixo
  // passam por `coagir` no runtime, então a análise tem que passar também.
  const validos = [
    'Algoritmo "a"\nVar\n x: real\nInicio\n x <- 7\nFimalgoritmo',
    'Algoritmo "a"\nVar\n t: literal\nInicio\n t <- 5\nFimalgoritmo',
    'Algoritmo "a"\nVar\n l: logico\nInicio\n l <- 1\nFimalgoritmo',
    'Algoritmo "a"\nVar\n x: inteiro\nInicio\n x <- 6 / 3\nFimalgoritmo',
    'Algoritmo "a"\nVar\n x: real\nInicio\n x <- 2 ^ 0.5\nFimalgoritmo',
  ];
  for (const fonte of validos) {
    const e = falha(fonte);
    if (e) return "reprovou programa que o runtime aceita: " + descreverErro(e);
  }
  return null;
});

caso("o exemplo textual da §47 reprova antes de executar", () => {
  const fonte = [
    'Algoritmo "tipo"',
    "Var",
    "   x: inteiro",
    "Inicio",
    '   escreval("antes")',
    '   x <- "abc"',
    '   escreval("depois")',
    "Fimalgoritmo",
  ].join("\n");
  const e = falha(fonte);
  if (!e) return "a análise aceitou 'x <- \"abc\"' em 'x: inteiro'";
  if (e.linha !== 6) return "erro na linha errada: " + e.linha + " (esperado 6)";
  return null;
});

// ===========================================================================
// 6. Nenhuma proibição de projeto
// ===========================================================================

secao("[6/6] Proibições do projeto");

caso("sem eval, sem Function(), sem fetch, sem CDN no módulo", () => {
  // Leitura do próprio arquivo: o projeto roda de `file://`, sem build, e um
  // `import` dinâmico aqui quebraria o browser sem quebrar o Node.
  const texto = readFileSync(join(RAIZ, MODULO), "utf8");
  const proibidos = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bfetch\s*\(/, /\bimport\s*\(/, /https?:\/\//];
  for (const re of proibidos) {
    const achado = re.exec(texto);
    if (achado) return "padrão proibido no módulo: " + achado[0];
  }
  return null;
});

// ---------------------------------------------------------------------------

console.log("-".repeat(66));
console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
if (fail > 0) process.exitCode = 1;
