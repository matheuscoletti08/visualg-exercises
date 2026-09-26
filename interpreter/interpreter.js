var W = typeof window !== "undefined" ? window : globalThis;
W.Vg = (function () {
  function vgErro(linha, mensagem) {
    return {
      vgErro: true,
      linha: typeof linha === "number" ? linha : null,
      mensagem: mensagem
    };
  }
  function vgInterrompido() {
    return { vgInterrompido: true };
  }
  function texto(v) {
    if (typeof v === "boolean") return v ? "Verdadeiro" : "Falso";
    if (v === null || v === undefined) return "";
    return String(v);
  }
  function valorPadrao(tipo) {
    if (tipo === "inteiro" || tipo === "real") return 0;
    if (tipo === "logico") return false;
    return "";
  }
  class Interprete {
    constructor(opcoes) {
      this.opcoes = opcoes;
      this.vars = new Map();
      this.passos = 0;
      this.maxPassos = opcoes.maxPassos;
    }
    async checar(linha) {
      if (this.opcoes.deveParar()) throw vgInterrompido();
      this.passos++;
      if (this.passos >= this.maxPassos) {
        throw vgErro(
          linha,
          "Possível loop infinito: execução interrompida após " + this.passos + " comandos"
        );
      }
      if (this.passos % 50000 === 0) {
        await new Promise(function (resolve) {
          setTimeout(resolve, 0);
        });
      }
    }
    async executar(prog) {
      for (let i = 0; i < prog.variaveis.length; i++) {
        const d = prog.variaveis[i];
        const chave = d.nome.toLowerCase();
        if (!this.vars.has(chave)) {
          this.vars.set(chave, { nome: d.nome, tipo: d.tipo, valor: valorPadrao(d.tipo) });
        }
      }
      await this.bloco(prog.corpo);
    }
    async bloco(comandos) {
      for (let i = 0; i < comandos.length; i++) {
        await this.comando(comandos[i]);
      }
    }
    async comando(cmd) {
      await this.checar(cmd.linha);
      if (cmd.tipo === "atrib") {
        const v = await this.avaliar(cmd.expr);
        this.definir(cmd.nome, v, cmd.linha);
        return;
      }
      if (cmd.tipo === "se") {
        const c = await this.avaliar(cmd.cond);
        if (typeof c !== "boolean") {
          throw vgErro(cmd.linha, "A condição do 'se' precisa ser verdadeira ou falsa");
        }
        if (c) await this.bloco(cmd.entao);
        else await this.bloco(cmd.senao);
        return;
      }
      if (cmd.tipo === "enquanto") {
        while (true) {
          await this.checar(cmd.linha);
          const c = await this.avaliar(cmd.cond);
          if (typeof c !== "boolean") {
            throw vgErro(cmd.linha, "A condição do 'enquanto' precisa ser verdadeira ou falsa");
          }
          if (!c) break;
          await this.bloco(cmd.corpo);
        }
        return;
      }
      if (cmd.tipo === "repita") {
        while (true) {
          await this.checar(cmd.linha);
          await this.bloco(cmd.corpo);
          const c = await this.avaliar(cmd.cond);
          if (typeof c !== "boolean") {
            throw vgErro(cmd.linha, "A condição do 'ate' precisa ser verdadeira ou falsa");
          }
          if (c) break;
        }
        return;
      }
      if (cmd.tipo === "para") {
        const de = await this.avaliar(cmd.de);
        const ate = await this.avaliar(cmd.ate);
        const passo = cmd.passo ? await this.avaliar(cmd.passo) : 1;
        if (typeof de !== "number" || typeof ate !== "number" || typeof passo !== "number") {
          throw vgErro(cmd.linha, "O laço 'para' precisa de valores numéricos");
        }
        let v = de;
        while (true) {
          await this.checar(cmd.linha);
          if (passo > 0 ? v > ate : v < ate) break;
          this.definir(cmd.nome, v, cmd.linha);
          await this.bloco(cmd.corpo);
          v = v + passo;
        }
        return;
      }
      if (cmd.tipo === "escreva") {
        for (let i = 0; i < cmd.args.length; i++) {
          const arg = cmd.args[i];
          const v = await this.avaliar(arg.expr);
          let t;
          if (arg.casas !== null && typeof v === "number") {
            let casas = Math.trunc(arg.casas);
            if (casas < 0) casas = 0;
            if (casas > 100) casas = 100;
            t = v.toFixed(casas);
          } else {
            t = texto(v);
          }
          if (arg.largura !== null) {
            const largura = Math.trunc(arg.largura);
            if (largura > 0 && t.length < largura) t = t.padStart(largura, " ");
          }
          await this.opcoes.saida(t);
        }
        if (cmd.nl) await this.opcoes.saida("\n");
        return;
      }
      if (cmd.tipo === "leia") {
        for (let i = 0; i < cmd.nomes.length; i++) {
          const nome = cmd.nomes[i];
          const d = this.vars.get(nome.toLowerCase());
          if (!d) throw vgErro(cmd.linha, "Variável '" + nome + "' não declarada");
          let digitado;
          try {
            digitado = await this.opcoes.entrada("Entre com o valor de " + nome);
          } catch (e) {
            throw vgInterrompido();
          }
          d.valor = this.converterLeitura(d, digitado, cmd.linha);
        }
        return;
      }
      throw vgErro(cmd.linha, "Comando desconhecido: '" + cmd.tipo + "'");
    }
    definir(nome, valor, linha) {
      const d = this.vars.get(nome.toLowerCase());
      if (!d) throw vgErro(linha, "Variável '" + nome + "' não declarada");
      if (d.tipo === "inteiro") {
        if (typeof valor !== "number") {
          throw vgErro(linha, "Tipo inválido para '" + d.nome + "': esperado inteiro");
        }
        d.valor = Math.trunc(valor);
        return;
      }
      if (d.tipo === "real") {
        if (typeof valor !== "number") {
          throw vgErro(linha, "Tipo inválido para '" + d.nome + "': esperado real");
        }
        d.valor = valor;
        return;
      }
      if (d.tipo === "caractere" || d.tipo === "literal") {
        if (typeof valor !== "string") {
          throw vgErro(linha, "Tipo inválido para '" + d.nome + "': esperado caractere");
        }
        d.valor = valor;
        return;
      }
      if (typeof valor !== "boolean") {
        throw vgErro(linha, "Tipo inválido para '" + d.nome + "': esperado logico");
      }
      d.valor = valor;
    }
    converterLeitura(d, digitado, linha) {
      const bruto = digitado === null || digitado === undefined ? "" : String(digitado);
      if (d.tipo === "caractere" || d.tipo === "literal") return bruto;
      if (d.tipo === "logico") {
        const t = bruto.trim().toLowerCase();
        if (t === "verdadeiro" || t === "v") return true;
        if (t === "falso" || t === "f") return false;
        throw vgErro(linha, "Valor inválido para '" + d.nome + "': '" + bruto + "'");
      }
      const s = d.tipo === "real" ? bruto.trim().replace(",", ".") : bruto.trim();
      if (s === "" || isNaN(Number(s))) {
        throw vgErro(linha, "Valor inválido para '" + d.nome + "': '" + bruto + "'");
      }
      const n = Number(s);
      return d.tipo === "inteiro" ? Math.trunc(n) : n;
    }
    async avaliar(e) {
      if (e.tipo === "numero") return e.valor;
      if (e.tipo === "texto") return e.valor;
      if (e.tipo === "logico") return e.valor;
      if (e.tipo === "var") {
        const d = this.vars.get(e.nome.toLowerCase());
        if (!d) throw vgErro(e.linha, "Variável '" + e.nome + "' não declarada");
        return d.valor;
      }
      if (e.tipo === "un") {
        const v = await this.avaliar(e.expr);
        if (typeof v !== "number") {
          throw vgErro(e.linha, "O operador '" + e.op + "' precisa de um número");
        }
        return e.op === "-" ? -v : v;
      }
      if (e.tipo === "nao") {
        const v = await this.avaliar(e.expr);
        if (typeof v !== "boolean") {
          throw vgErro(e.linha, "O operador 'nao' precisa de um valor lógico");
        }
        return !v;
      }
      if (e.tipo === "bin") return this.avaliarBin(e);
      throw vgErro(e.linha, "Expressão inválida");
    }
    async avaliarBin(e) {
      const op = e.op;
      if (op === "e" || op === "ou") {
        const a = await this.avaliar(e.esq);
        const b = await this.avaliar(e.dir);
        if (typeof a !== "boolean" || typeof b !== "boolean") {
          throw vgErro(e.linha, "O operador '" + op + "' precisa de valores lógicos");
        }
        return op === "e" ? a && b : a || b;
      }
      const a = await this.avaliar(e.esq);
      const b = await this.avaliar(e.dir);
      if (op === "=") return a === b;
      if (op === "<>") return a !== b;
      if (op === "<" || op === ">" || op === "<=" || op === ">=") {
        return this.relacionar(op, a, b, e.linha);
      }
      if (op === "+") {
        if (typeof a === "string" || typeof b === "string") return texto(a) + texto(b);
        this.numeros(a, b, e);
        return a + b;
      }
      this.numeros(a, b, e);
      if (op === "-") return a - b;
      if (op === "*") return a * b;
      if (op === "/") {
        if (b === 0) throw vgErro(e.linha, "Divisão por zero");
        return a / b;
      }
      if (op === "%") {
        if (Math.trunc(b) === 0) throw vgErro(e.linha, "Divisão por zero");
        return Math.trunc(a) % Math.trunc(b);
      }
      if (op === "div") {
        if (Math.trunc(b) === 0) throw vgErro(e.linha, "Divisão por zero");
        return Math.trunc(Math.trunc(a) / Math.trunc(b));
      }
      if (op === "^") return Math.pow(a, b);
      throw vgErro(e.linha, "Operador desconhecido: '" + op + "'");
    }
    numeros(a, b, e) {
      if (typeof a !== "number" || typeof b !== "number") {
        throw vgErro(e.linha, "O operador '" + e.op + "' precisa de números");
      }
    }
    relacionar(op, a, b, linha) {
      let r = false;
      if (typeof a === "number" && typeof b === "number") {
        r = op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b;
      } else if (typeof a === "string" && typeof b === "string") {
        r = op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b;
      } else {
        throw vgErro(linha, "Comparação inválida entre tipos diferentes");
      }
      return r;
    }
  }
  return {
    async executar(codigo, opcoes) {
      const ops = opcoes || {};
      const cfg = {
        saida: typeof ops.saida === "function" ? ops.saida : function () {},
        entrada:
          typeof ops.entrada === "function"
            ? ops.entrada
            : function () {
                return Promise.resolve("");
              },
        deveParar:
          typeof ops.deveParar === "function"
            ? ops.deveParar
            : function () {
                return false;
              },
        maxPassos: typeof ops.maxPassos === "number" ? ops.maxPassos : 2000000
      };
      try {
        const tokens = new W.VgLexer(codigo).tokenizar();
        const ast = new W.VgParser(tokens).parse();
        await new Interprete(cfg).executar(ast);
        return { ok: true };
      } catch (e) {
        if (e && e.vgInterrompido) return { ok: false, interrompido: true };
        if (e && e.vgErro) {
          return {
            ok: false,
            erro: { linha: typeof e.linha === "number" ? e.linha : null, mensagem: e.mensagem }
          };
        }
        if (e && typeof e.message === "string") {
          return { ok: false, erro: { linha: null, mensagem: e.message } };
        }
        return { ok: false, erro: { linha: null, mensagem: String(e) } };
      }
    }
  };
})();
