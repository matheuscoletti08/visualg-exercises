// §5, §10, §11, §14, §25, §28 — valores, tipos e coerção.
//
// Três decisões que vêm do spec e contrariam o senso comum:
//
//   1. §10: `10 / 4` é `2.5`. Divisão é REAL. O runtime antigo truncava em
//      silêncio quando os dois operandos eram ímpares não exatos, o que é
//      errado por definição, não só feio. A divisão inteira é `\`/`DIV`.
//   2. §5: os limites declarados são preservados. `vetor [-5..5]` tem elemento
//      de índice -5, e o runtime não pode assumir que tudo começa em zero.
//   3. §11: comparação de texto é case-insensitive, que é a semântica
//      tradicional do VisuAlg. Usar `===` do JavaScript para tudo está
//      explicitamente proibido pela §11.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;

  // ------------------------------------------------------------- predicados

  const ehInteiro = (v) => typeof v === "number" && Number.isInteger(v);
  const ehReal = (v) => typeof v === "number" && !Number.isInteger(v);
  const ehNumerico = (v) => typeof v === "number" && Number.isFinite(v);
  const ehTexto = (v) => typeof v === "string";
  const ehLogico = (v) => typeof v === "boolean";
  const ehVetor = (v) => v instanceof Vetor;
  const ehMatriz = (v) => v instanceof Matriz;

  function tipoDe(v) {
    if (ehLogico(v)) return "lógico";
    if (typeof v === "number") return Number.isInteger(v) ? "inteiro" : "real";
    if (typeof v === "string") return "caractere";
    if (ehVetor(v)) return "vetor";
    if (ehMatriz(v)) return "matriz";
    return "desconhecido";
  }

  function ehIgualTipo(v, tipo) {
    if (tipo === "real") return typeof v === "number";
    if (tipo === "inteiro") return ehInteiro(v);
    return tipoDe(v) === tipo;
  }

  function erro(codigo, mensagem, pos) {
    return Diagnostics.criar(codigo, mensagem, pos);
  }

  // ------------------------------------------------------- vetores e matrizes

  /**
   * Guarda de alocação. NÃO é limite da linguagem: §5 exige qualquer faixa. É
   * só para uma declaração absurda (`[1..99999999]`) dar erro nomeado em vez de
   * derrubar a aba. O valor é folgado de propósito — cobre qualquer uso real.
   */
  const LIMITE_ALOCACAO = 5000000;

  /**
   * Converte expressão já avaliada em limite numérico.
   *
   * Aceita literal direto E unário sobre literal, porque `vetor [-5..5]` da §5
   * produz `-5` como nó `unario`, não como `literal` com valor negativo. Sem o
   * desdobramento, toda faixa de índice negativo era rejeitada — que é
   * exatamente o caso que a §5 exige suportar.
   */
  function limiteDe(expr, rotulo) {
    if (expr && expr.tipo === "literal" && typeof expr.valor === "number") {
      return Math.trunc(expr.valor);
    }
    if (expr && expr.tipo === "unario" && (expr.operador === "-" || expr.operador === "+")) {
      const interno = limiteDe(expr.operando, rotulo);
      return expr.operador === "-" ? -interno : interno;
    }
    throw erro(
      "TIPO_INCOMPATIVEL",
      "Limite de dimensão de " + rotulo + " precisa ser constante numérico",
      expr
    );
  }

  /**
   * Base comum: faixas declaradas + armazenamento denso.
   *
   * O índice visível ao programa é o declarado (`vetor [1..10]` → `vet[1]` é o
   * primeiro), e o índice interno é `i - de`. Guardar o `de` é o que permite
   * `[-5..5]` e `for i de -5 ate 5` sem translation layer.
   */
  class Sequencia {
    constructor(nome, dimensoes, tipoElemento) {
      this.nome = nome;
      this.tipoElemento = tipoElemento;
      this.dimensoes = dimensoes; // [{de, ate}]
      let total = 1;
      for (const d of dimensoes) {
        const n = d.ate - d.de + 1;
        if (n <= 0) {
          throw erro("TIPO_INCOMPATIVEL", "Faixa inválida em '" + nome + "': " + d.de + ".." + d.ate);
        }
        total *= n;
      }
      if (!Number.isFinite(total) || total > LIMITE_ALOCACAO) {
        throw erro(
          "TIPO_INCOMPATIVEL",
          "'" + nome + "' pediria " + total + " posições, acima do limite de alocação (" + LIMITE_ALOCACAO + ")"
        );
      }
      this.total = total;
      // `preenchido` distingue "valor zero" de "ainda não atribuído", porque o
      // painel de variáveis (§43) mostra os dois.
      this.dados = new Array(total).fill(zeroDe(tipoElemento));
      this.preenchido = new Array(total).fill(false);
    }

    /** Índice linear para o índice visível, com verificação de faixa. */
    linear(indice, pos) {
      const n = Math.trunc(indice);
      if (typeof indice !== "number" || !Number.isFinite(indice) || n !== indice) {
        throw erro("RUNTIME_INDICE", "Índice precisa ser inteiro, veio " + paraTexto(indice), pos);
      }
      const d = this.dimensoes[0];
      if (n < d.de || n > d.ate) {
        throw erro(
          "RUNTIME_INDICE",
          "Índice " + n + " fora de " + this.nome + "[" + d.de + ".." + d.ate + "]",
          pos
        );
      }
      return n - d.de;
    }

    descrever() {
      return this.dimensoes.map((d) => (d.de === 1 ? "[1.." + d.ate + "]" : "[" + d.de + ".." + d.ate + "]")).join(",");
    }
  }

  class Vetor extends Sequencia {
    constructor(nome, de, ate, tipoElemento) {
      super(nome, [{ de, ate }], tipoElemento);
    }
    obter(i, pos) {
      const k = this.linear(i, pos);
      return this.dados[k];
    }
    definir(i, valor, pos) {
      const k = this.linear(i, pos);
      this.dados[k] = coagir(valor, this.tipoElemento, pos);
      this.preenchido[k] = true;
      return this.dados[k];
    }
    preenchidoEm(i) {
      return this.preenchido[this.linear(i)];
    }
  }

  class Matriz extends Sequencia {
    constructor(nome, dimensoes, tipoElemento) {
      super(nome, dimensoes, tipoElemento);
      this.largura = this.dimensoes[1].ate - this.dimensoes[1].de + 1;
    }
    /** Índice linear com verificação nas duas dimensões. */
    linear2(linha, coluna, pos) {
      const d0 = this.dimensoes[0];
      const l = Math.trunc(linha);
      const c = Math.trunc(coluna);
      if (l < d0.de || l > d0.ate) {
        throw erro("RUNTIME_INDICE", "Linha " + linha + " fora de " + this.nome + "[" + d0.de + ".." + d0.ate + "]", pos);
      }
      if (c < this.dimensoes[1].de || c > this.dimensoes[1].ate) {
        throw erro(
          "RUNTIME_INDICE",
          "Coluna " + coluna + " fora de " + this.nome + "[" + this.dimensoes[1].de + ".." + this.dimensoes[1].ate + "]",
          pos
        );
      }
      const i0 = l - d0.de;
      const i1 = c - this.dimensoes[1].de;
      return i0 * this.largura + i1;
    }
    obter(linha, coluna, pos) {
      return this.dados[this.linear2(linha, coluna, pos)];
    }
    definir(linha, coluna, valor, pos) {
      const k = this.linear2(linha, coluna, pos);
      this.dados[k] = coagir(valor, this.tipoElemento, pos);
      this.preenchido[k] = true;
      return this.dados[k];
    }
    preenchidoEm(linha, coluna) {
      return this.preenchido[this.linear2(linha, coluna)];
    }
  }

  // ---------------------------------------------------------------- coerção

  /**
   * Valor neutro de um tipo, usado ao criar variável e vetor.
   * `literal` é `caractere` sem restrição: o VisuAlg trata os dois igual, e
   * deixar `literal` de fora fazia `t: literal` começar valendo `null`.
   */
  function zeroDe(tipo) {
    if (tipo === "lógico") return false;
    if (tipo === "inteiro") return 0;
    if (tipo === "real") return 0.0;
    if (tipo === "caractere" || tipo === "literal") return "";
    return null;
  }

  /** Aceita vírgula decimal, que é como o brasileiro digita. */
  function paraNumero(texto, tipo, pos) {
    const s = String(texto).trim().replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(s)) {
      throw erro(
        "RUNTIME_ENTRADA_INVALIDA",
        "Valor inválido para " + tipo + ": '" + String(texto).trim() + "'",
        pos
      );
    }
    const n = Number(s);
    if (tipo === "inteiro") {
      if (!Number.isInteger(n)) {
        throw erro("RUNTIME_ENTRADA_INVALIDA", "Esperado inteiro, veio '" + String(texto).trim() + "'", pos);
      }
      return n;
    }
    return n;
  }

  /**
   * Converte um valor para o tipo declarado, no limite da atribuição.
   * Não é conversão silenciosa: narrowing que perde informação é erro.
   */
  function coagir(valor, tipo, pos) {
    if (valor === null || valor === undefined) return zeroDe(tipo);
    switch (tipo) {
      case "inteiro":
        if (ehInteiro(valor)) return valor;
        if (ehReal(valor) && Number.isInteger(valor)) return valor;
        if (ehTexto(valor)) return paraNumero(valor, "inteiro", pos);
        break;
      case "real":
        if (ehNumerico(valor)) return valor;
        if (ehTexto(valor)) return paraNumero(valor, "real", pos);
        break;
      case "caractere":
      case "literal":
        if (ehTexto(valor)) return valor;
        if (ehNumerico(valor) || ehLogico(valor)) return paraTexto(valor);
        break;
      case "lógico":
        if (ehLogico(valor)) return valor;
        if (ehTexto(valor)) {
          const s = valor.trim().toLowerCase();
          if (s === "verdadeiro" || s === "v") return true;
          if (s === "falso" || s === "f") return false;
          throw erro("RUNTIME_ENTRADA_INVALIDA", "Valor inválido para lógico: '" + valor + "'", pos);
        }
        if (ehNumerico(valor)) return valor !== 0;
        break;
      default:
        return valor;
    }
    throw erro(
      "TIPO_INCOMPATIVEL",
      "Não dá para atribuir " + tipoDe(valor) + " a " + tipo + ": " + paraTexto(valor),
      pos
    );
  }

  // -------------------------------------------------------------- aritmética

  /**
   * §10. `/` é divisão real, sempre — `10 / 4` é `2.5`. `\` e `DIV` são
   * inteiras e truncam em zero, que é a diferença entre `-7 \ 2` e o floor.
   */
  function aritmetica(op, a, b, pos) {
    if (!ehNumerico(a) || !ehNumerico(b)) {
      // §14 — texto só concatena com `+`; o resto é erro de tipo.
      if (op === "+" && (ehTexto(a) || ehTexto(b))) {
        return paraTexto(a) + paraTexto(b);
      }
      throw erro(
        "TIPO_INCOMPATIVEL",
        "Operador '" + op + "' não aceita " + tipoDe(a) + " e " + tipoDe(b),
        pos
      );
    }
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/":
        if (b === 0) throw erro("RUNTIME_DIVISAO_ZERO", "Divisão por zero", pos);
        return a / b;
      case "\\":
      case "div": {
        if (b === 0) throw erro("RUNTIME_DIVISAO_ZERO", "Divisão por zero", pos);
        const q = a / b;
        return q < 0 ? Math.ceil(q) : Math.floor(q);
      }
      case "%": {
        if (b === 0) throw erro("RUNTIME_DIVISAO_ZERO", "Resto de divisão por zero", pos);
        return a % b;
      }
      case "^": return Math.pow(a, b);
    }
    throw erro("TIPO_INCOMPATIVEL", "Operador desconhecido: '" + op + "'", pos);
  }

  function unario(op, v, pos) {
    if (op === "+") {
      if (!ehNumerico(v)) throw erro("TIPO_INCOMPATIVEL", "'+' unário espera número, veio " + tipoDe(v), pos);
      return v;
    }
    if (op === "-") {
      if (!ehNumerico(v)) throw erro("TIPO_INCOMPATIVEL", "'-' unário espera número, veio " + tipoDe(v), pos);
      return -v;
    }
    if (op === "não") {
      if (!ehLogico(v)) throw erro("TIPO_INCOMPATIVEL", "'não' espera lógico, veio " + tipoDe(v), pos);
      return !v;
    }
    throw erro("TIPO_INCOMPATIVEL", "Operador unário desconhecido: '" + op + "'", pos);
  }

  /**
   * §11 — comparação. Retorna `lógico` sempre. Texto compara sem caixa
   * (semântica tradicional do VisuAlg), então `"Ana" = "ana"` é verdadeiro.
   */
  function comparar(op, a, b, pos) {
    if (ehTexto(a) || ehTexto(b)) {
      if (!(ehTexto(a) && ehTexto(b))) {
        throw erro(
          "TIPO_INCOMPATIVEL",
          "Comparação entre " + tipoDe(a) + " e " + tipoDe(b) + " não é válida",
          pos
        );
      }
      const x = a.toLowerCase();
      const y = b.toLowerCase();
      switch (op) {
        case "=": return x === y;
        case "<>": return x !== y;
        case "<": return x < y;
        case ">": return x > y;
        case "<=": return x <= y;
        case ">=": return x >= y;
      }
      throw erro("TIPO_INCOMPATIVEL", "Operador relacional desconhecido: '" + op + "'", pos);
    }
    if (ehLogico(a) || ehLogico(b)) {
      if (!(ehLogico(a) && ehLogico(b))) {
        throw erro("TIPO_INCOMPATIVEL", "Comparação entre " + tipoDe(a) + " e " + tipoDe(b) + " não é válida", pos);
      }
      switch (op) {
        case "=": return a === b;
        case "<>": return a !== b;
        default: throw erro("TIPO_INCOMPATIVEL", "Lógicos só aceitam '=' e '<>'", pos);
      }
    }
    if (!ehNumerico(a) || !ehNumerico(b)) {
      throw erro("TIPO_INCOMPATIVEL", "Comparação entre " + tipoDe(a) + " e " + tipoDe(b) + " não é válida", pos);
    }
    switch (op) {
      case "=": return a === b;
      case "<>": return a !== b;
      case "<": return a < b;
      case ">": return a > b;
      case "<=": return a <= b;
      case ">=": return a >= b;
    }
    throw erro("TIPO_INCOMPATIVEL", "Operador relacional desconhecido: '" + op + "'", pos);
  }

  function logico(op, a, b, pos) {
    const exigeLogico = (v) => {
      if (!ehLogico(v)) throw erro("TIPO_INCOMPATIVEL", "'" + op + "' espera lógico, veio " + tipoDe(v), pos);
      return v;
    };
    switch (op) {
      case "e": return exigeLogico(a) && exigeLogico(b);
      case "ou": return exigeLogico(a) || exigeLogico(b);
      case "xou": return exigeLogico(a) !== exigeLogico(b);
    }
    throw erro("TIPO_INCOMPATIVEL", "Operador lógico desconhecido: '" + op + "'", pos);
  }

  // ------------------------------------------------------------ presentation

  /** Lógica como `VERDADEIRO`/`FALSO`, que é como §5 manda escrever. */
  function paraTextoLogico(v) {
    return v ? "VERDADEIRO" : "FALSO";
  }

  /** Texto de um valor, no formato que o console e §15 esperam. */
  function paraTexto(v) {
    if (v === null || v === undefined) return "";
    if (ehLogico(v)) return paraTextoLogico(v);
    if (ehVetor(v) || ehMatriz(v)) return v.nome + v.descrever();
    return String(v);
  }

  /** Pretty-print para o painel de variáveis (§43). */
  function paraPainel(v) {
    if (ehLogico(v)) return paraTextoLogico(v);
    if (ehVetor(v) || ehMatriz(v)) return v.nome + v.descrever();
    return String(v);
  }

  VG.Values = {
    ehInteiro: ehInteiro,
    ehReal: ehReal,
    ehNumerico: ehNumerico,
    ehTexto: ehTexto,
    ehLogico: ehLogico,
    ehVetor: ehVetor,
    ehMatriz: ehMatriz,
    tipoDe: tipoDe,
    ehIgualTipo: ehIgualTipo,
    zeroDe: zeroDe,
    coagir: coagir,
    paraNumero: paraNumero,
    aritmetica: aritmetica,
    unario: unario,
    comparar: comparar,
    logico: logico,
    paraTexto: paraTexto,
    paraTextoLogico: paraTextoLogico,
    paraPainel: paraPainel,
    limiteDe: limiteDe,
    Vetor: Vetor,
    Matriz: Matriz,
    LIMITE_ALOCACAO: LIMITE_ALOCACAO,
  };
})(W.VG);
