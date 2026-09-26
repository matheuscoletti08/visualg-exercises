var W = typeof window !== "undefined" ? window : globalThis;
W.VgParser = (function () {
  const PALAVRAS_RESERVADAS = [
    "algoritmo", "var", "inicio", "fimalgoritmo",
    "se", "senao", "fimse",
    "enquanto", "fimenquanto",
    "repita", "ate",
    "para", "fimpara", "faca", "de", "passo", "entao",
    "escreva", "escreval", "leia",
    "inteiro", "real", "caractere", "literal", "logico",
    "e", "ou", "nao", "mod", "div"
  ];
  const RELACIONAIS = ["=", "<>", "<", ">", "<=", ">="];
  const TIPOS = ["inteiro", "real", "caractere", "literal", "logico"];
  return class VgParser {
    constructor(tokens) {
      this.tokens = Array.isArray(tokens) ? tokens : [];
      this.pos = 0;
    }
    atual() {
      return this.tokens[this.pos] || { tipo: "fim", valor: "<fim>", linha: 1 };
    }
    proximo() {
      return this.tokens[this.pos + 1] || { tipo: "fim", valor: "<fim>", linha: 1 };
    }
    avancar() {
      const t = this.atual();
      if (t.tipo !== "fim") this.pos++;
      return t;
    }
    ehPalavra(valor) {
      const t = this.atual();
      return t.tipo === "palavra" && t.valor.toLowerCase() === valor;
    }
    ehOperador(valor) {
      const t = this.atual();
      return t.tipo === "operador" && t.valor === valor;
    }
    erro(mensagem) {
      return { vgErro: true, linha: this.atual().linha, mensagem: mensagem };
    }
    consumirPalavra(valor, esperado) {
      if (!this.ehPalavra(valor)) {
        throw this.erro("Esperado '" + (esperado || valor) + "', encontrado '" + this.atual().valor + "'");
      }
      return this.avancar();
    }
    consumirOperador(valor) {
      if (!this.ehOperador(valor)) {
        throw this.erro("Esperado '" + valor + "', encontrado '" + this.atual().valor + "'");
      }
      return this.avancar();
    }
    parse() {
      const primeiro = this.atual();
      this.consumirPalavra("algoritmo", "algoritmo");
      if (this.atual().tipo !== "texto") {
        throw this.erro("Esperado o nome do algoritmo entre aspas");
      }
      const nome = this.avancar().valor;
      const variaveis = [];
      if (this.ehPalavra("var")) {
        this.avancar();
        while (
          this.atual().tipo === "palavra" &&
          this.proximo().tipo === "operador" &&
          this.proximo().valor === ":"
        ) {
          const tokNome = this.avancar();
          this.avancar();
          const tokTipo = this.atual();
          if (tokTipo.tipo !== "palavra") {
            throw this.erro("Esperado o tipo da variável '" + tokNome.valor + "'");
          }
          this.avancar();
          const tipo = tokTipo.valor.toLowerCase();
          if (TIPOS.indexOf(tipo) < 0) {
            throw this.erro("Tipo inválido: '" + tokTipo.valor + "'");
          }
          variaveis.push({ nome: tokNome.valor, tipo: tipo, linha: tokNome.linha });
        }
      }
      this.consumirPalavra("inicio", "inicio");
      const corpo = this.blocos(["fimalgoritmo"]);
      this.consumirPalavra("fimalgoritmo", "fimalgoritmo");
      return { tipo: "programa", nome: nome, variaveis: variaveis, corpo: corpo, linha: primeiro.linha };
    }
    blocos(terminadores) {
      const comandos = [];
      while (this.atual().tipo !== "fim") {
        const t = this.atual();
        if (t.tipo === "palavra" && terminadores.indexOf(t.valor.toLowerCase()) >= 0) break;
        comandos.push(this.comando());
      }
      return comandos;
    }
    comando() {
      const t = this.atual();
      if (t.tipo !== "palavra") {
        throw this.erro("Esperado um comando, encontrado '" + t.valor + "'");
      }
      const kw = t.valor.toLowerCase();
      if (kw === "se") return this.cmdSe();
      if (kw === "enquanto") return this.cmdEnquanto();
      if (kw === "repita") return this.cmdRepita();
      if (kw === "para") return this.cmdPara();
      if (kw === "escreva" || kw === "escreval") return this.cmdEscreva(kw);
      if (kw === "leia") return this.cmdLeia();
      if (PALAVRAS_RESERVADAS.indexOf(kw) >= 0) {
        throw this.erro("Comando inesperado: '" + t.valor + "'");
      }
      const nome = this.avancar();
      if (!this.ehOperador("<-")) {
        throw this.erro("Esperado '<-' após '" + nome.valor + "', encontrado '" + this.atual().valor + "'");
      }
      this.avancar();
      const expr = this.expressao();
      return { tipo: "atrib", nome: nome.valor, expr: expr, linha: nome.linha };
    }
    cmdSe() {
      const linha = this.avancar().linha;
      const cond = this.expressao();
      this.consumirPalavra("entao", "entao");
      const entao = this.blocos(["senao", "fimse", "fimalgoritmo"]);
      let senao = [];
      if (this.ehPalavra("senao")) {
        this.avancar();
        senao = this.blocos(["fimse", "fimalgoritmo"]);
      }
      this.consumirPalavra("fimse", "fimse");
      return { tipo: "se", cond: cond, entao: entao, senao: senao, linha: linha };
    }
    cmdEnquanto() {
      const linha = this.avancar().linha;
      const cond = this.expressao();
      this.consumirPalavra("faca", "faca");
      const corpo = this.blocos(["fimenquanto", "fimalgoritmo"]);
      this.consumirPalavra("fimenquanto", "fimenquanto");
      return { tipo: "enquanto", cond: cond, corpo: corpo, linha: linha };
    }
    cmdRepita() {
      const linha = this.avancar().linha;
      const corpo = this.blocos(["ate", "fimalgoritmo"]);
      this.consumirPalavra("ate", "ate");
      const cond = this.expressao();
      return { tipo: "repita", corpo: corpo, cond: cond, linha: linha };
    }
    cmdPara() {
      const linha = this.avancar().linha;
      if (this.atual().tipo !== "palavra") {
        throw this.erro("Esperado o nome da variável no laço 'para'");
      }
      const nome = this.avancar().valor;
      this.consumirPalavra("de", "de");
      const de = this.expressao();
      this.consumirPalavra("ate", "ate");
      const fim = this.expressao();
      let passo = null;
      if (this.ehPalavra("passo")) {
        this.avancar();
        passo = this.expressao();
      }
      this.consumirPalavra("faca", "faca");
      const corpo = this.blocos(["fimpara", "fimalgoritmo"]);
      this.consumirPalavra("fimpara", "fimpara");
      return { tipo: "para", nome: nome, de: de, ate: fim, passo: passo, corpo: corpo, linha: linha };
    }
    cmdEscreva(kw) {
      const tok = this.avancar();
      this.consumirOperador("(");
      const args = [];
      if (!this.ehOperador(")")) {
        while (true) {
          args.push(this.argumento());
          if (this.ehOperador(",")) {
            this.avancar();
            continue;
          }
          break;
        }
      }
      this.consumirOperador(")");
      return { tipo: "escreva", args: args, nl: kw === "escreval", linha: tok.linha };
    }
    argumento() {
      const linha = this.atual().linha;
      const expr = this.expressao();
      let largura = null;
      let casas = null;
      while (this.ehOperador(":") && this.proximo().tipo === "numero") {
        this.avancar();
        const n = this.avancar().valor;
        if (largura === null) largura = n;
        else casas = n;
      }
      return { tipo: "arg", expr: expr, largura: largura, casas: casas, linha: linha };
    }
    cmdLeia() {
      const tok = this.avancar();
      this.consumirOperador("(");
      const nomes = [];
      while (true) {
        if (this.atual().tipo !== "palavra") {
          throw this.erro("Esperado o nome da variável em 'leia'");
        }
        nomes.push(this.avancar().valor);
        if (this.ehOperador(",")) {
          this.avancar();
          continue;
        }
        break;
      }
      this.consumirOperador(")");
      return { tipo: "leia", nomes: nomes, linha: tok.linha };
    }
    expressao() {
      return this.exprOu();
    }
    exprOu() {
      let e = this.exprE();
      while (this.ehPalavra("ou")) {
        const op = this.avancar();
        e = { tipo: "bin", op: "ou", esq: e, dir: this.exprE(), linha: op.linha };
      }
      return e;
    }
    exprE() {
      let e = this.exprNao();
      while (this.ehPalavra("e")) {
        const op = this.avancar();
        e = { tipo: "bin", op: "e", esq: e, dir: this.exprNao(), linha: op.linha };
      }
      return e;
    }
    exprNao() {
      if (this.ehPalavra("nao")) {
        const op = this.avancar();
        return { tipo: "nao", expr: this.exprNao(), linha: op.linha };
      }
      return this.exprRel();
    }
    exprRel() {
      let e = this.exprAditivo();
      while (this.atual().tipo === "operador" && RELACIONAIS.indexOf(this.atual().valor) >= 0) {
        const op = this.avancar();
        e = { tipo: "bin", op: op.valor, esq: e, dir: this.exprAditivo(), linha: op.linha };
      }
      return e;
    }
    exprAditivo() {
      let e = this.exprMult();
      while (this.atual().tipo === "operador" && (this.atual().valor === "+" || this.atual().valor === "-")) {
        const op = this.avancar();
        e = { tipo: "bin", op: op.valor, esq: e, dir: this.exprMult(), linha: op.linha };
      }
      return e;
    }
    exprMult() {
      let e = this.exprUnario();
      while (true) {
        const t = this.atual();
        if (t.tipo === "operador" && (t.valor === "*" || t.valor === "/" || t.valor === "%")) {
          const op = this.avancar();
          e = { tipo: "bin", op: op.valor, esq: e, dir: this.exprUnario(), linha: op.linha };
          continue;
        }
        if (t.tipo === "palavra" && (t.valor.toLowerCase() === "mod" || t.valor.toLowerCase() === "div")) {
          const op = this.avancar();
          const nome = op.valor.toLowerCase() === "mod" ? "%" : "div";
          e = { tipo: "bin", op: nome, esq: e, dir: this.exprUnario(), linha: op.linha };
          continue;
        }
        break;
      }
      return e;
    }
    exprUnario() {
      const t = this.atual();
      if (t.tipo === "operador" && (t.valor === "-" || t.valor === "+")) {
        const op = this.avancar();
        return { tipo: "un", op: op.valor, expr: this.exprUnario(), linha: op.linha };
      }
      return this.exprPotencia();
    }
    exprPotencia() {
      const esq = this.exprPrimario();
      if (this.ehOperador("^")) {
        const op = this.avancar();
        return { tipo: "bin", op: "^", esq: esq, dir: this.exprUnario(), linha: op.linha };
      }
      return esq;
    }
    exprPrimario() {
      const t = this.atual();
      if (t.tipo === "numero") {
        this.avancar();
        return { tipo: "numero", valor: t.valor, inteiro: t.inteiro, linha: t.linha };
      }
      if (t.tipo === "texto") {
        this.avancar();
        return { tipo: "texto", valor: t.valor, linha: t.linha };
      }
      if (this.ehOperador("(")) {
        this.avancar();
        const e = this.expressao();
        this.consumirOperador(")");
        return e;
      }
      if (t.tipo === "palavra") {
        const kw = t.valor.toLowerCase();
        if (kw === "verdadeiro" || kw === "falso") {
          this.avancar();
          return { tipo: "logico", valor: kw === "verdadeiro", linha: t.linha };
        }
        if (
          t.valor.toLowerCase() === "potencia" &&
          this.proximo().tipo === "operador" &&
          this.proximo().valor === "("
        ) {
          this.avancar();
          this.avancar();
          const base = this.expressao();
          this.consumirOperador(",");
          const expoente = this.expressao();
          this.consumirOperador(")");
          return { tipo: "bin", op: "^", esq: base, dir: expoente, linha: t.linha };
        }
        this.avancar();
        return { tipo: "var", nome: t.valor, linha: t.linha };
      }
      throw this.erro("Expressão inválida perto de '" + t.valor + "'");
    }
  };
})();
