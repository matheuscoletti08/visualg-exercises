// §46 — Hierarquia de erros.
//
// Antes, o lexer lançava objetos literais `{vgErro, linha, mensagem}` e o
// runtime devolvia `{ok:false, erro:{linha, mensagem}}`. Isso não é `Error`,
// não sobrevive a `instanceof`, não carrega posição de coluna, e obriga cada
// consumidor a adivinhar o formato.
//
// Esta hierarquia é subclasse real de `Error` e carrega a posição completa
// (`sourceLine`/`sourceColumn`/`length`), que é o que destrava o gutter de
// breakpoints (§41), o destaque de linha atual (§42) e os vetores/matrizes (§28).
//
// COMPATIBILIDADE: `mensagem` e `linha` são mantidos como alias de `message` e
// `sourceLine` porque `script.js`, `tools/testar.mjs` e o runtime atual leem
// esses campos. Retirar os alias é uma onda própria, depois que a UI migrar.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  /** Base de todos os erros do VisualG. */
  class ErroVisualG extends Error {
    constructor(mensagem, opcoes) {
      super(mensagem);
      const o = opcoes || {};
      this.name = this.constructor.name;
      this.codigo = o.errorCode || this.constructor.name;

      // Posição na origem.
      this.sourceLine = o.sourceLine != null ? o.sourceLine : null;
      this.sourceColumn = o.sourceColumn != null ? o.sourceColumn : null;
      this.length = o.length != null ? o.length : null;
      this.context = o.context != null ? o.context : null;

      // Alias legados (ver nota de compatibilidade no topo).
      this.mensagem = mensagem;
      this.linha = this.sourceLine;

      // Reexibe a linha com um cursor sob o trecho, para o console da UI.
      if (o.fonte != null && this.sourceLine != null) this.exibir = montarExibicao(o.fonte, this);
    }

    /** Forma serializável, usada pelo retorno `{ok:false, erro}` do runtime. */
    paraObjeto() {
      const o = {
        mensagem: this.mensagem,
        linha: this.sourceLine,
        coluna: this.sourceColumn,
        codigo: this.codigo,
        tipo: this.name,
        length: this.length,
        context: this.context,
      };
      if (this.exibir) o.exibir = this.exibir;
      return o;
    }
  }

  function montarExibicao(fonte, erro) {
    const linhas = String(fonte).split("\n");
    const alvo = linhas[erro.sourceLine - 1];
    if (alvo === undefined) return null;
    const saida = [
      "  linha " + erro.sourceLine + (erro.sourceColumn != null ? ", coluna " + erro.sourceColumn : ""),
      "  " + alvo,
    ];
    if (erro.sourceColumn != null) {
      saida.push("  " + " ".repeat(Math.max(0, erro.sourceColumn - 1)) + "^");
    }
    return saida.join("\n");
  }

  /** §46.1 — erro léxico: caractere ou texto malformado. */
  class ErroLexico extends ErroVisualG {}

  /** §46.2 — erro de sintaxe. */
  class ErroSintaxe extends ErroVisualG {}

  /** §46.3 — erro de tipo. */
  class ErroTipo extends ErroVisualG {}

  /** §46.4 — erro em tempo de execução. */
  class ErroRuntime extends ErroVisualG {}

  /** §46.5 — estouro de orçamento (passos ou tempo). */
  class ErroTempo extends ErroVisualG {}

  /**
   * §14 — erro SEMÂNTICO, distincto do sintático.
   *
   * A distinção não é cosmética: o `backlog-debugger.md` §15 exige que
   * `passo 0` seja `SemanticError` e NÃO `ParseError`, porque `passo 0` tem
   * sintaxe válida e semântica inválida. Um programa que só pode ser escrito
   * errado de um jeito não é problema de parser.
   */
  class ErroSemantica extends ErroVisualG {}

  /** §14 — índice fora da faixa declarada de vetor/matriz. */
  class ErroIndice extends ErroVisualG {}

  /** §14 — entrada do `leia` que não casa com o tipo declarado. */
  class ErroEntrada extends ErroVisualG {}

  /** Construtores por código, para o lexer não ter que lembrar a classe. */
  const POR_CODIGO = {
    LEXICO_CARACTERE_INVALIDO: ErroLexico,
    LEXICO_TEXTO_NAO_FECHADO: ErroLexico,
    LEXICO_NUMERO_INVALIDO: ErroLexico,
    SINTESE_ESPERADO: ErroSintaxe,
    SINTESE_TOKEN_INESPERADO: ErroSintaxe,
    SINTESE_FIM_ESPERADO: ErroSintaxe,
    // §15 — `passo 0` é sintaxe válida com semântica inválida. Era `SINTESE_*`
    // e o backlog-debugger.md §15 exige semântico com este código exato.
    INVALID_LOOP_STEP: ErroSemantica,
    TIPO_INCOMPATIVEL: ErroTipo,
    TIPO_NAO_DECLARADO: ErroSemantica,
    TIPO_ARGUMENTOS: ErroTipo,
    RUNTIME_NAO_DECLARADA: ErroRuntime,
    RUNTIME_DIVISAO_ZERO: ErroRuntime,
    RUNTIME_ENTRADA_INVALIDA: ErroEntrada,
    RUNTIME_NOME_RESERVADO: ErroSemantica,
    RUNTIME_RECURSAO: ErroRuntime,
    RUNTIME_ARQUIVO: ErroRuntime,
    // §14 — índice e as demais de §28
    RUNTIME_INDICE: ErroIndice,
    RUNTIME_INDICE_DIMENSOES: ErroIndice,
    RUNTIME_VETOR_DIMENSOES: ErroIndice,
    TEMPO_LIMITE_PASSOS: ErroTempo,
    TEMPO_LIMITE_PAREDE: ErroTempo,
    // Semânticos que o `semantic.js` emite
    SEMANTICA_VARIAVEL_NAO_DECLARADA: ErroSemantica,
    SEMANTICA_REDECLARACAO: ErroSemantica,
    SEMANTICA_FALTA_RETORNE: ErroSemantica,
    SEMANTICA_RETORNE_INVALIDO: ErroSemantica,
    SEMANTICA_INTERROMPA_FORA: ErroSemantica,
    SEMANTICA_ESTRUTURA: ErroSemantica,
  };

  /**
   * Cria o erro certo para um código, com posição e trecho de origem.
   * É a única porta de entrada: lexer, parser e runtime passam por aqui, então
   * nenhum caminho pode inventar um formato de erro novo.
   */
  function criar(codigo, mensagem, pos, fonte) {
    const Ctor = POR_CODIGO[codigo] || ErroRuntime;
    return new Ctor(mensagem, {
      errorCode: codigo,
      sourceLine: pos && pos.linha != null ? pos.linha : null,
      sourceColumn: pos && pos.coluna != null ? pos.coluna : null,
      length: pos && pos.comprimento != null ? pos.comprimento : null,
      context: pos && pos.contexto != null ? pos.contexto : null,
      fonte: fonte,
    });
  }

  /** Converte qualquer coisa lançada num formato serializável. */
  function serializar(erro) {
    if (erro && typeof erro.paraObjeto === "function") return erro.paraObjeto();
    if (erro && erro.vgErro) {
      return {
        mensagem: erro.mensagem || String(erro),
        linha: erro.linha != null ? erro.linha : null,
        coluna: null,
        codigo: "DESCONHECIDO",
        tipo: "ErroVisualG",
        length: null,
        context: null,
      };
    }
    return {
      mensagem: (erro && erro.message) || String(erro),
      linha: null,
      coluna: null,
      codigo: "DESCONHECIDO",
      tipo: (erro && erro.name) || "Error",
      length: null,
      context: null,
    };
  }

  VG.Diagnostics = {
    ErroVisualG: ErroVisualG,
    ErroLexico: ErroLexico,
    ErroSintaxe: ErroSintaxe,
    ErroSemantica: ErroSemantica,
    ErroTipo: ErroTipo,
    ErroIndice: ErroIndice,
    ErroEntrada: ErroEntrada,
    ErroRuntime: ErroRuntime,
    ErroTempo: ErroTempo,
    criar: criar,
    serializar: serializar,
    // §40 — o snapshot de erro do debugger precisa guardar a PILHA e as
    // VARIÁVEIS, e `paraObjeto()` não alcança o runtime. O debugger anexa
    // esses dois campos no objeto que recebe daqui.
    ehDoProjeto: (e) => e instanceof ErroVisualG,
  };
})(W.VG);
