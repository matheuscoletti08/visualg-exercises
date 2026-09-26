var W = typeof window !== "undefined" ? window : globalThis;
W.VgLexer = class VgLexer {
  constructor(codigo) {
    this.codigo = typeof codigo === "string" ? codigo : "";
    this.i = 0;
    this.linha = 1;
    this.tokens = [];
  }
  tokenizar() {
    while (this.i < this.codigo.length) {
      const c = this.codigo.charAt(this.i);
      if (c === "\n") {
        this.linha++;
        this.i++;
        continue;
      }
      if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") {
        this.i++;
        continue;
      }
      if (c === "/" && this.codigo.charAt(this.i + 1) === "/") {
        while (this.i < this.codigo.length && this.codigo.charAt(this.i) !== "\n") {
          this.i++;
        }
        continue;
      }
      if (c === '"' || c === "'") {
        this.lerTexto(c);
        continue;
      }
      if (this.digito(c) || (c === "." && this.digito(this.codigo.charAt(this.i + 1)))) {
        this.lerNumero();
        continue;
      }
      if (this.letra(c)) {
        this.lerPalavra();
        continue;
      }
      if (this.lerOperador()) {
        continue;
      }
      throw this.erro("Caractere inválido: '" + c + "'", this.linha);
    }
    this.tokens.push({ tipo: "fim", valor: "<fim>", linha: this.linha });
    return this.tokens;
  }
  digito(c) {
    return c >= "0" && c <= "9";
  }
  letra(c) {
    if (!c) return false;
    if (c === "_" || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) return true;
    return c.charCodeAt(0) > 127;
  }
  lerTexto(aspa) {
    const linha = this.linha;
    this.i++;
    let s = "";
    while (this.i < this.codigo.length) {
      const c = this.codigo.charAt(this.i);
      if (c === "\n") break;
      this.i++;
      if (c === aspa) {
        this.tokens.push({ tipo: "texto", valor: s, linha: linha });
        return;
      }
      s += c;
    }
    throw this.erro("String não fechada", linha);
  }
  lerNumero() {
    const linha = this.linha;
    let s = "";
    while (this.digito(this.codigo.charAt(this.i))) {
      s += this.codigo.charAt(this.i);
      this.i++;
    }
    if (this.codigo.charAt(this.i) === "." && this.digito(this.codigo.charAt(this.i + 1))) {
      s += ".";
      this.i++;
      while (this.digito(this.codigo.charAt(this.i))) {
        s += this.codigo.charAt(this.i);
        this.i++;
      }
    }
    this.tokens.push({
      tipo: "numero",
      valor: Number(s),
      inteiro: s.indexOf(".") < 0,
      linha: linha
    });
  }
  lerPalavra() {
    const linha = this.linha;
    let s = "";
    while (this.i < this.codigo.length) {
      const c = this.codigo.charAt(this.i);
      if (this.letra(c) || this.digito(c)) {
        s += c;
        this.i++;
      } else {
        break;
      }
    }
    this.tokens.push({ tipo: "palavra", valor: s, linha: linha });
  }
  lerOperador() {
    const dois = this.codigo.substr(this.i, 2);
    if (dois === "<-" || dois === "<=" || dois === ">=" || dois === "<>") {
      this.tokens.push({ tipo: "operador", valor: dois, linha: this.linha });
      this.i += 2;
      return true;
    }
    const c = this.codigo.charAt(this.i);
    if ("<>=+-*%^(),:%/".indexOf(c) >= 0) {
      this.tokens.push({ tipo: "operador", valor: c, linha: this.linha });
      this.i++;
      return true;
    }
    return false;
  }
  erro(mensagem, linha) {
    return { vgErro: true, linha: linha, mensagem: mensagem };
  }
};
