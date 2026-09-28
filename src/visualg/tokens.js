// §4–§13 — Vocabulário do VisualG: tipos de token, operadores e palavras-chave.
//
// §4 exige palavras-chave acentuadas (`então`, `senão`, `até`, `faça`). Mas o
// projeto já funciona com `entao` sem acento, e quebrar isso pune quem já usa.
// Decisão D5 do backlog: as duas formas são aceitas, a acentuada é a canônica.
//
// A normalização mora AQUI, num único lugar, em vez de espalhada por `startsWith`
// em cada regra do parser. É a diferença entre "todo predicado de palavra-chave
// esquece de uma forma" e um teste só.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  /** Tipos de token emitidos pelo lexer. */
  const T = {
    PALAVRA_CHAVE: "palavra-chave",
    IDENTIFICADOR: "identificador",
    NUMERO: "numero",
    TEXTO: "texto",
    OPERADOR: "operador",
    VIRGULA: "virgula",
    PONTO_E_VIRGULA: "ponto-e-virgula",
    DOIS_PONTOS: "dois-pontos",
    ATRIBUICAO: "atribuicao",
    BREAKPOINT: "breakpoint",
    FIM: "fim",
  };

  /**
   * Operadores e pontuação, do mais longo para o mais curto. A ordem importa:
   * o lexer casa o primeiro que bate, então `<=` precisa vir antes de `<`, `:=`
   * antes de `:` e `..` antes de `.`.
   *
   * `..` existe porque o intervalo `1..5` de §6 seria ambíguo de outro modo: o
   * segundo ponto, seguido de dígito, parecia o início de um float `.5` e
   * `1..5` virava `1` e `0.5`. Como token único não há ambiguidade, e o float
   * inicial `.5` continua funcionando porque o teste de número vem antes.
   */
  const OPERADORES = [
    "<=", ">=", "<>", "<-", ":=", "\\", "..",
    "<", ">", "=", "+", "-", "*", "/", "%", "^",
    "(", ")", "[", "]", ",", ":", ";", ".",
  ];

  /** Mapa de acento → não acento, para normalizar sem depender de ICU/NFD. */
  const SEM_ACENTO = {
    á: "a", à: "a", â: "a", ã: "a",
    é: "e", ê: "e",
    í: "i",
    ó: "o", ô: "o", õ: "o",
    ú: "u", ü: "u",
    ç: "c",
  };

  /** Minúsculas, sem acento. Chave interna de comparação. */
  function chaveDe(palavra) {
    let s = String(palavra).toLowerCase();
    let saida = "";
    for (const c of s) saida += SEM_ACENTO[c] !== undefined ? SEM_ACENTO[c] : c;
    return saida;
  }

  /**
   * Palavras-chave canônicas (acentuadas). A chave é a forma sem acento, o
   * valor é a forma que o AST e as mensagens de erro usam.
   */
  const PALAVRAS = {
    // estrutura
    algoritmo: "algoritmo",
    var: "var",
    inicio: "início",
    fimalgoritmo: "fimalgoritmo",
    // saída / entrada
    escreva: "escreva",
    escreval: "escreval",
    leia: "leia",
    // seleção
    se: "se",
    entao: "então",
    senao: "senão",
    fimse: "fimse",
    escolha: "escolha",
    caso: "caso",
    outrocaso: "outrocaso",
    fimescolha: "fimescolha",
    interrompa: "interrompa",
    // repetição
    enquanto: "enquanto",
    faca: "faça",
    fimenquanto: "fimenquanto",
    repita: "repita",
    ate: "até",
    para: "para",
    de: "de",
    passo: "passo",
    fimpara: "fimpara",
    // subprogramas
    funcao: "função",
    procedimento: "procedimento",
    retorne: "retorne",
    fimfuncao: "fimfunção",
    fimprocedimento: "fimprocedimento",
    // operadores lógicos
    e: "e",
    ou: "ou",
    xou: "xou",
    nao: "não",
    // aritméticos por palavra
    div: "div",
    mod: "mod",
    // lógica
    verdadeiro: "verdadeiro",
    falso: "falso",
    // tipos. O spec escreve `caractere`/`logico`; `caracter` e `lógico` entram
    // como alias porque são as outras grafias em circulation. A chave é a forma
    // sem acento, então `lógico` e `logico` colidem de propósito na mesma chave.
    inteiro: "inteiro",
    real: "real",
    caracter: "caractere",
    caractere: "caractere",
    logico: "lógico",
    vetor: "vetor",
    matriz: "matriz",
    literal: "literal",
    // §31–§39 — extensões. Só entram as que são COMANDO de verdade; as
    // primitivas de arquivo (`ESCREVER`, `LERA`, `EXISTE`, `APAGUE`,
    // `RENOMEIE`, `LISTA`, `TAMANHO`, `CONTEUDO`, `CABEÇALHO`, `FIM`, `NOME`)
    // NÃO são palavras-chave, e a decisão é de compatibilidade: `fim` e
    // `nome` são nomes de variáveis usados no corpus dos 95 exercícios, e
    // promover qualquer um dos dois a palavra-chave trocaria o significado de
    // programa que hoje funciona. O `parser.js` reconhece as primitivas pelo
    // TEXTO do token, com a guarda de atribuição, e é o mesmo caminho das outras.
    aleatorio: "aleatorio",
    arquivo: "arquivo",
    limpatela: "limpatela",
    mudacor: "mudacor",
    pausa: "pausa",
    debug: "debug",
    eco: "eco",
    cronometro: "cronometro",
  };

  /** Índice por chave sem acento, resolvido uma única vez. */
  const POR_CHAVE = {};
  for (const k of Object.keys(PALAVRAS)) POR_CHAVE[k] = PALAVRAS[k];

  /** Tipos de dado válidos numa declaração. */
  const TIPOS_DADOS = ["inteiro", "real", "caractere", "lógico", "vetor", "matriz", "literal"];

  /**
   * Resolve uma palavra para palavra-chave canônica, ou `null` se for
   * identificador. Aceita `entao`, `ENTÃO` e `Então` como a mesma coisa.
   */
  function palavraChaveDe(palavra) {
    const canonica = POR_CHAVE[chaveDe(palavra)];
    return canonica === undefined ? null : canonica;
  }

  /** `true` se a forma canônica é um tipo de dado (§6). */
  function ehTipo(canonica) {
    return TIPOS_DADOS.indexOf(canonica) >= 0;
  }

  VG.Tokens = {
    T: T,
    OPERADORES: OPERADORES,
    PALAVRAS: PALAVRAS,
    TIPOS_DADOS: TIPOS_DADOS,
    chaveDe: chaveDe,
    palavraChaveDe: palavraChaveDe,
    ehTipo: ehTipo,
  };
})(W.VG);
