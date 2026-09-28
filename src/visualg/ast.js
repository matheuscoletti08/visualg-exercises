// §48 — Nós da AST.
//
// Regra do arquivo: todo nó carrega `linha` e `coluna`. É o que permite o
// gutter de breakpoints (§41), o destaque da linha atual (§42), e o `length`
// nos erros (§46) apontarem para o trecho certo em vez de adivinhar.
//
// Os nós são dados puros, sem método e sem comportamento. A lógica fica no
// runtime (onda 5), o que mantém a árvore serializável para o debugger e para
// o golden baseline de compatibilidade.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  /** Fábrica base: carimba posição e tipo em qualquer nó. */
  function no(tipo, props, pos) {
    const n = { tipo: tipo };
    if (props) for (const k of Object.keys(props)) if (props[k] !== undefined) n[k] = props[k];
    n.linha = pos && pos.linha != null ? pos.linha : null;
    n.coluna = pos && pos.coluna != null ? pos.coluna : null;
    return n;
  }

  /**
   * Nomes das declarações de variáveis: `d.nome` e `d.tipo` são lidos pela UI.
   * `tipoElemento` é o T de `vetor [1..5] de T`; em escalar é null.
   */
  function declaracao(nomes, tipo, dimensoes, pos, tipoElemento) {
    return no(
      "declaracao",
      { nomes: nomes, tipo: tipo, dimensoes: dimensoes || [], tipoElemento: tipoElemento || null },
      pos
    );
  }

  const N = {
    // ------------------------------------------------------------ programa
    programa: (nome, variaveis, corpo, pos) =>
      no("programa", { nome: nome, variaveis: variaveis, corpo: corpo }, pos),

    // -------------------------------------------------------- declarações
    declaracao: declaracao,

    // ------------------------------------------------------------- saída
    escrever: (argumentos, comQuebra, pos) =>
      no("escrever", { argumentos: argumentos, comQuebra: comQuebra }, pos),

    // ------------------------------------------------------------ entrada
    ler: (alvos, pos) => no("ler", { alvos: alvos }, pos),

    // ------------------------------------------------------------ controle
    se: (condicao, entao, senao, pos) => no("se", { condicao: condicao, entao: entao, senao: senao }, pos),
    enquanto: (condicao, corpo, pos) => no("enquanto", { condicao: condicao, corpo: corpo }, pos),
    repita: (corpo, condicao, pos) => no("repita", { corpo: corpo, condicao: condicao }, pos),
    para: (variavel, de, ate, passo, corpo, pos) =>
      no("para", { variavel: variavel, de: de, ate: ate, passo: passo, corpo: corpo }, pos),
    interrompa: (pos) => no("interrompa", {}, pos),

    // §18 — `escolha`. `casos` é lista de cláusulas de caso; `outrocaso` é a
    // cláusula padrão, e sua ausência é válida (o spec não exige `falhar`
    // implícito, ao contrário do VisuAlg clássico).
    escolha: (seletor, casos, outrocaso, pos) =>
      no("escolha", { seletor: seletor, casos: casos, outrocaso: outrocaso }, pos),
    casoClausula: (valores, corpo, pos) => no("caso-clausula", { valores: valores, corpo: corpo }, pos),
    outrocasoClausula: (corpo, pos) => no("outrocaso-clausula", { corpo: corpo }, pos),

    // §23–§27 — subprogramas
    funcao: (nome, parametros, retorno, corpo, pos) =>
      no("funcao", { nome: nome, parametros: parametros, retorno: retorno, corpo: corpo }, pos),
    procedimento: (nome, parametros, corpo, pos) =>
      no("procedimento", { nome: nome, parametros: parametros, corpo: corpo }, pos),
    parametro: (nome, tipo, dimensoes, porReferencia, pos) =>
      no("parametro", { nome: nome, tipo: tipo, dimensoes: dimensoes || [], porReferencia: !!porReferencia }, pos),
    retorne: (valor, pos) => no("retorne", { valor: valor }, pos),

    // §16–§17 — `escreva`/`escreval` aceitam especificadores `:N` e `:N:M`
    // por argumento. `largura` null = sem preenchimento; `casas` só vale quando
    // `largura` existe.
    arg: (expr, largura, casas, pos) => no("arg", { expr: expr, largura: largura, casas: casas }, pos),

    // ------------------------------------------------------------ comandos
    atribuicao: (alvo, valor, pos) => no("atribuicao", { alvo: alvo, valor: valor }, pos),
    expressao: (expressao, pos) => no("expressao", { valor: expressao }, pos),
    fimAlgoritmo: (pos) => no("fim-algoritmo", {}, pos),

    // §31–§39 — comando de extensão: `limpatela`, `aleatorio 1,10`, `arquivo
    // "entrada.txt"`, `ESCREVER("x")`, `mudacor("AMARELO","FRENTE")`, `pausa`.
    //
    // `comando` é o nome canônico em MINÚSCULAS, porque é a chave que o
    // `Runtime.comandoExtensao` procura em `VG.Extensoes.comandos`; o nome com a
    // grafia original (`ESCREVER`, `CABEÇALHO`) fica em `grafia` para a UI
    // exibir e para as mensagens de erro.
    //
    // `argumentos` são nós de expressão comuns, já validados pelo parser. Um
    // comando sem argumento tem lista vazia — nunca `null`, porque o runtime e
    // a UI percorrem sem checar.
    extensao: (comando, argumentos, pos, grafia) =>
      no("extensao", { comando: comando, argumentos: argumentos || [], grafia: grafia || comando }, pos),

    // ---------------------------------------------------------- expressões
    literal: (valor, tipo, pos) => no("literal", { valor: valor, tipoLiteral: tipo }, pos),
    vetorLiteral: (elementos, pos) => no("vetor-literal", { elementos: elementos }, pos),
    matrizLiteral: (elementos, pos) => no("matriz-literal", { elementos: elementos }, pos),
    identificador: (nome, pos) => no("identificador", { nome: nome }, pos),
    binario: (operador, esquerda, direita, pos) =>
      no("binario", { operador: operador, esquerda: esquerda, direita: direita }, pos),
    unario: (operador, operando, pos) => no("unario", { operador: operador, operando: operando }, pos),
    indice: (alvo, indices, pos) => no("indice", { alvo: alvo, indices: indices }, pos),
  };

  /** Nomes de tipo de nó, útil para o walker e para os testes. */
  const TIPOS_NO = Object.keys(N).filter((k) => typeof N[k] === "function");

  VG.Ast = { no: no, N: N, TIPOS_NO: TIPOS_NO };
})(W.VG);
