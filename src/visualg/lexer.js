// Lexer do VisualG — onda 2.
//
// Diferenças em relação a `interpreter/lexer.js` (que continua vivo até o gate
// da onda 5, para o rollback):
//
//   1. Todo token carrega `coluna`, além de `linha`. Destrava §41 (gutter de
//      breakpoints), §42 (linha atual) e o `length` de §46.
//   2. Palavras-chave são emitidas como `palavra-chave`, com a forma canônica
//      acentuada, em vez de `palavra` crua que o parser reinterpreta a cada
//      regra. A aceitação de `entao` e `então` está em `tokens.js`.
//   3. `:=` (§7), `\` divisão inteira (§10) e `;` como separador.
//   4. Erros passam por `Diagnostics.criar`, que dá subclasse de `Error` real
//      e posição completa. O lexer antigo lançava objeto literal `{vgErro}`.
//
// NÃO há sequência de escape em string. O VisuAlg não as usa nessa posição e
// o corpus dos 95 exercícios não tem — introduzir `\"` mudaria a semântica de
// um literal que hoje fecha normalmente. Se aparecer, é onda própria.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const T = VG.Tokens.T;
  const Diagnostics = VG.Diagnostics;

  class Lexer {
    constructor(codigo) {
      this.codigo = typeof codigo === "string" ? codigo : "";
      this.i = 0;
      this.linha = 1;
      this.coluna = 1;
      this.tokens = [];
    }

    /** Erro léxico com posição completa e trecho de origem. */
    erro(codigo, mensagem, linha, coluna, comprimento) {
      throw Diagnostics.criar(
        codigo,
        mensagem,
        { linha: linha, coluna: coluna, comprimento: comprimento },
        this.codigo
      );
    }

    avanca(n) {
      for (let k = 0; k < n; k++) {
        const c = this.codigo.charAt(this.i);
        this.i++;
        if (c === "\n") {
          this.linha++;
          this.coluna = 1;
        } else {
          this.coluna++;
        }
      }
    }

    digito(c) {
      return c >= "0" && c <= "9";
    }

    /** Letra ASCII, `_`, ou qualquer caractere acima de 127 (acentos, §). */
    letra(c) {
      if (!c) return false;
      if (c === "_" || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) return true;
      return c.charCodeAt(0) > 127;
    }

    tokenizar() {
      while (this.i < this.codigo.length) {
        const c = this.codigo.charAt(this.i);

        if (c === "\n" || c === "\r" || c === " " || c === "\t" || c === "\f" || c === "\v") {
          this.avanca(1);
          continue;
        }

        // Comentário de linha: sempre descartado, em qualquer coluna.
        //
        // NÃO é marcador de breakpoint. A §42 define breakpoint como clique na
        // margem do editor (`●`), que é conceito de UI e chega pela API do
        // runtime — não é sintaxe de fonte. Uma versão anterior deste lexer
        // emitia token de breakpoint para comentário na coluna 1 e quebrou 95
        // arquivos, porque cabeçalho de attribution (`// Professor : ...`) é
        // exatamente isso.
        if (c === "/" && this.codigo.charAt(this.i + 1) === "/") {
          while (this.i < this.codigo.length && this.codigo.charAt(this.i) !== "\n") this.avanca(1);
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

        if (this.lerOperador()) continue;

        this.erro("LEXICO_CARACTERE_INVALIDO", "Caractere inválido: '" + c + "'", this.linha, this.coluna, 1);
      }
      this.tokens.push({ tipo: T.FIM, valor: "<fim>", linha: this.linha, coluna: this.coluna });
      return this.tokens;
    }

    lerTexto(aspa) {
      const linha = this.linha;
      const coluna = this.coluna;
      this.avanca(1);
      let s = "";
      while (this.i < this.codigo.length) {
        const c = this.codigo.charAt(this.i);
        if (c === "\n") break;
        this.avanca(1);
        if (c === aspa) {
          this.tokens.push({ tipo: T.TEXTO, valor: s, linha, coluna, comprimento: s.length + 2 });
          return;
        }
        s += c;
      }
      this.erro("LEXICO_TEXTO_NAO_FECHADO", "Texto não fechado", linha, coluna, null);
    }

    lerNumero() {
      const linha = this.linha;
      const coluna = this.coluna;
      let s = "";
      while (this.digito(this.codigo.charAt(this.i))) {
        s += this.codigo.charAt(this.i);
        this.avanca(1);
      }
      if (this.codigo.charAt(this.i) === "." && this.digito(this.codigo.charAt(this.i + 1))) {
        s += ".";
        this.avanca(1);
        while (this.digito(this.codigo.charAt(this.i))) {
          s += this.codigo.charAt(this.i);
          this.avanca(1);
        }
      }
      this.tokens.push({
        tipo: T.NUMERO,
        valor: Number(s),
        inteiro: s.indexOf(".") < 0,
        linha,
        coluna,
        comprimento: s.length,
      });
    }

    lerPalavra() {
      const linha = this.linha;
      const coluna = this.coluna;
      let s = "";
      while (this.i < this.codigo.length) {
        const c = this.codigo.charAt(this.i);
        if (this.letra(c) || this.digito(c)) {
          s += c;
          this.avanca(1);
        } else break;
      }
      const canonica = VG.Tokens.palavraChaveDe(s);
      if (canonica !== null) {
        this.tokens.push({ tipo: T.PALAVRA_CHAVE, valor: canonica, bruto: s, linha, coluna, comprimento: s.length });
      } else {
        this.tokens.push({ tipo: T.IDENTIFICADOR, valor: s, linha, coluna, comprimento: s.length });
      }
    }

    lerOperador() {
      const linha = this.linha;
      const coluna = this.coluna;
      for (const op of VG.Tokens.OPERADORES) {
        if (this.codigo.substr(this.i, op.length) !== op) continue;
        this.avanca(op.length);
        let tipo = T.OPERADOR;
        if (op === ":=") tipo = T.ATRIBUICAO;
        else if (op === "<-") tipo = T.ATRIBUICAO;
        else if (op === ",") tipo = T.VIRGULA;
        else if (op === ":") tipo = T.DOIS_PONTOS;
        else if (op === ";") tipo = T.PONTO_E_VIRGULA;
        this.tokens.push({ tipo, valor: op, linha, coluna, comprimento: op.length });
        return true;
      }
      return false;
    }
  }

  VG.Lexer = Lexer;
})(W.VG);
