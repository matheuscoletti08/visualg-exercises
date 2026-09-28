// §47 — Análise semântica: a porta que o parser deixa aberta.
//
// O parser aceita tudo que é BEM-FORMADO. Ele não sabe se `x` existe, se
// `x <- "abc"` faz sentido para `x: inteiro`, se `f(1,2)` casa com a assinatura
// de `f`, se `interrompa` está dentro de um laço, ou se um `retorne` com valor
// apareceu dentro de um `procedimento`. Tudo isso é ESTÁTICO, e §47 exige ser
// pego ANTES da execução — não no primeiro passo do programa, quando a metade
// das saídas já foi impressa.
//
// Decisões de porta (leia antes de mexer):
//
//   1. Os erros saem por `Diagnostics.criar` (§46), nunca `Error` cru. A UI já
//      sabe formatar `ErroVisualG`, e um `TypeError` do JavaScript no meio de
//      uma checagem estática é indistinguível de bug do interpretador.
//
//   2. Os nomes são comparados pela GRAFIA BRUTA, em minúsculas, e é a mesma
//      regra de `Environment.definir` (`String(nome).toLowerCase()`). É por
//      isso que `faccat/ex21.alg` funciona: ele declara `inicio: inteiro` e usa
//      `inicio` como variável em cinco posições. O parser desambigua com o `:`
//      seguinte e grava o nome BRUTO, então esta análise PRECISA procurar
//      `inicio`, nunca `início`. "Corrigir" a grafia aqui quebraria o corpus
//      inteiro — e, mais importante, quebraria programa de gente.
//
//   3. Erro é lançado na HORA. Uma frente só, primeira falha visível. Acumular
//      uma lista de erros é coisa de compilador de verdade, e este projeto ainda
//      não tem onde mostrar a lista inteira.
//
//   4. Só se acusa o que é DECIFRÁVEL. `x: real <- t` onde `t: literal` pode
//      ser "2.5" ou "Ana" — o runtime (`Values.coagir`) trata os dois casos, e
//      um erro aqui reprovaria programa que roda. Já `x: inteiro <- "abc"` não
//      tem duas leituras possíveis, e é esse o exemplo da §47.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;

  // ------------------------------------------------------------------ tipos

  /**
   * Categorias de tipo, para comparar declarado x usado.
   *
   * O parser normaliza `caracter`/`caractere` e `logico`/`lógico` para a forma
   * canônica (`Tokens.PALAVRAS`), mas `literal` continua sendo tipo próprio e o
   * runtime trata `caractere` e `literal` como o mesmo valor (`Values.zeroDe` e
   * `Values.coagir` nunca separam os dois). Aqui eles viram a categoria `texto`.
   */
  function categoria(tipo) {
    if (tipo === null || tipo === undefined) return null;
    if (tipo === "caractere" || tipo === "literal") return "texto";
    if (tipo === "lógico") return "logico";
    return String(tipo);
  }

  function ehNumerico(t) {
    return t === "inteiro" || t === "real";
  }

  /**
   * Faixa de tipo de uma expressão: categoria, se o número é inteiro conhecido,
   * tipo do elemento (vetor/matriz) e o texto do literal quando houver.
   *
   * `QUALQUER` (null) significa "não dá para saber". Nenhuma verificação
   * dispara nesse caso — erro falso é pior que erro tarde.
   */
  const QUALQUER = null;
  function faixa(cat, inteiro, elemento, texto) {
    const f = { cat: cat, inteiro: inteiro === undefined ? null : inteiro, elemento: elemento || null };
    if (texto !== undefined) f.texto = texto;
    return f;
  }

  /**
   * Faixa a partir de um tipo DECLARADO.
   *
   * `inteiro` é `num` com `inteiro: true` — a variável sempre carrega número
   * inteiro, por definição do tipo. `real` é `num` com `inteiro: null`, porque
   * `2.0` é `real` por declaração e inteiro por valor: tratá-lo como fracionário
   * reprovaria `x: inteiro <- y` com `y: real` valendo 7.
   */
  function faixaDeTipo(tipo, elemento) {
    const cat = categoria(tipo);
    if (cat === null) return QUALQUER;
    if (cat === "inteiro") return faixa("num", true, elemento);
    if (cat === "real") return faixa("num", null, elemento);
    return faixa(cat, null, elemento);
  }

  const ARITMETICOS = ["+", "-", "*", "/", "\\", "div", "%", "^"];
  const RELACIONAIS = ["=", "<>", "<", ">", "<=", ">="];
  const LOGICOS = ["e", "ou", "xou"];

  /**
   * Dobra de constantes dos operadores aritméticos.
   *
   * Existe por um motivo só: decidir se `i: inteiro <- 6 / 3` é erro. O
   * resultado vale 2, o runtime aceita, e inferir "real" sem olhar o valor
   * reprovaria divisão exata. O `\` trunca em zero e o `^` é `Math.pow` — as
   * duas semânticas que §10 e `Values.aritmetica` já usam, copiadas para não
   * divergirem.
   */
  const V_CONSTANTE = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => (b === 0 ? NaN : a / b),
    "\\": (a, b) => (b === 0 ? NaN : a < 0 === b < 0 ? Math.ceil(a / b) : Math.floor(a / b)),
    div: (a, b) => (b === 0 ? NaN : a < 0 === b < 0 ? Math.ceil(a / b) : Math.floor(a / b)),
    "%": (a, b) => (b === 0 ? NaN : a % b),
    "^": (a, b) => Math.pow(a, b),
  };

  /** `true` quando o texto é número na sintaxe aceita por `Values.paraNumero`. */
  function ehTextoNumerico(texto) {
    return /^-?\d+(\.\d+)?$/.test(String(texto).trim().replace(",", "."));
  }

  // ------------------------------------------------------------------ classe

  class Semantica {
    constructor(programa, fonte) {
      this.programa = programa;
      this.fonte = fonte === undefined ? null : fonte;

      /** Escopo global: `{ nomes: Map, pai: null }`. */
      this.escopoGlobal = { nomes: new Map(), pai: null };
      /** Subprogramas do próprio programa, por nome em minúsculas. */
      this.subprogramas = new Map();
      /** Escopo em uso (`bloco` empilha e restaura). */
      this.contexto = null;
      /** Relatório acumulado; `analisar()` devolve isto. */
      this.relatorio = { variaveis: 0, subprogramas: 0, chamadas: 0 };
    }

    // ------------------------------------------------------------- diagnóstico

    /**
     * Único caminho de saída de erro do arquivo.
     *
     * `Diagnostics.criar` recebe posição e código; `fonte` é o quarto argumento
     * para montar o trecho com cursor que a UI imprime no console.
     */
    erro(codigo, mensagem, no) {
      const pos = {
        linha: no && no.linha != null ? no.linha : null,
        coluna: no && no.coluna != null ? no.coluna : null,
      };
      throw Diagnostics.criar(codigo, mensagem, pos, this.fonte);
    }

    /** Chave de escopo: EXATAMENTE a de `Environment.definir`/`buscar`. */
    chave(nome) {
      return String(nome).toLowerCase();
    }

    // ------------------------------------------------------------------ entrada

    analisar() {
      if (!this.programa || this.programa.tipo !== "programa") {
        this.erro("TIPO_NAO_DECLARADO", "A análise semântica espera o programa devolvido por analisar()", null);
      }
      this.coletarSubprogramas();
      this.coletarVariaveis();
      this.bloco(this.programa.corpo, { escopo: this.escopoGlobal, laco: 0, sub: null });
      for (const sub of this.subprogramas.values()) this.analisarSubprograma(sub);
      return this.relatorio;
    }

    /**
     * §23–§27 — os subprogramas são coletados ANTES do corpo porque VisuAlg
     * aceita chamada recursiva e mutua: `fatorial` chama a si mesmo, e `par` e
     * `impar` chamam um ao outro. Uma coleta sob demanda deixaria a primeira
     * chamada pendente.
     */
    coletarSubprogramas() {
      const lista = this.programa.subprogramas || [];
      for (const sub of lista) {
        const chave = this.chave(sub.nome);
        if (this.subprogramas.has(chave)) {
          this.erro("TIPO_NAO_DECLARADO", "Subprograma '" + sub.nome + "' declarado duas vezes", sub);
        }
        this.acusarReservado(sub.nome, sub);
        this.subprogramas.set(chave, sub);
      }
      this.relatorio.subprogramas = lista.length;
    }

    /**
     * §6 — bloco `var`. A verificação de duplicado acontece AQUI porque
     * `Ambiente.definir` só descobre a colisão em tempo de execução, depois de
     * o programa já ter impresso metade da saída.
     */
    coletarVariaveis() {
      for (const d of this.programa.variaveis || []) {
        for (const nome of d.nomes || []) {
          this.acusarReservado(nome, d);
          const chave = this.chave(nome);
          if (this.escopoGlobal.nomes.has(chave)) {
            this.erro("TIPO_NAO_DECLARADO", "Variável '" + nome + "' já declarada neste escopo", d);
          }
          this.escopoGlobal.nomes.set(chave, {
            nome: nome,
            tipo: d.tipo === null || d.tipo === undefined ? null : d.tipo,
            tipoElemento: d.tipoElemento || null,
            dimensoes: d.dimensoes || [],
          });
          this.relatorio.variaveis++;
        }
      }
    }

    /**
     * §29.4 — nome reservado. A lista vem de `Environment.NOMES_RESERVADOS`, e
     * não de uma cópia local: aquela é a mesma contra a qual a stdlib se
     * registra, e uma segunda lista aqui voltaria a divergir no primeiro builtin
     * novo.
     */
    acusarReservado(nome, no) {
      const E = VG.Environment;
      if (!E || typeof E.ehNomeReservado !== "function") return;
      if (E.ehNomeReservado(nome)) {
        this.erro(
          "RUNTIME_NOME_RESERVADO",
          "'" + nome + "' é nome reservado (§29.4) e não pode ser redeclarado",
          no
        );
      }
    }

    // ------------------------------------------------------------------ escopo

    /**
     * Procura um identificador e acusa "não declarada" quando não acha.
     *
     * A comparação é por minúsculas da grafia bruta, idêntica a
     * `Ambiente.buscar`: quem grava é o parser, e ele grava `inicio`.
     */
    resolver(nome, no) {
      const chave = this.chave(nome);
      let esc = this.contexto ? this.contexto.escopo : this.escopoGlobal;
      while (esc) {
        const v = esc.nomes.get(chave);
        if (v) return v;
        esc = esc.pai;
      }
      this.erro("TIPO_NAO_DECLARADO", "Variável '" + nome + "' não declarada", no);
      return null;
    }

    /** Empilha o escopo dos parâmetros (§25) sobre o global. */
    escopoDoSubprograma(sub) {
      const escopo = { nomes: new Map(), pai: this.escopoGlobal };
      for (const p of sub.parametros || []) {
        this.acusarReservado(p.nome, p);
        const chave = this.chave(p.nome);
        if (escopo.nomes.has(chave)) {
          this.erro("TIPO_NAO_DECLARADO", "Parâmetro '" + p.nome + "' declarado duas vezes", p);
        }
        escopo.nomes.set(chave, {
          nome: p.nome,
          tipo: p.tipo || null,
          tipoElemento: null,
          parametro: true,
        });
      }
      return escopo;
    }

    // --------------------------------------------------------------- comandos

    bloco(comandos, ctx) {
      const anterior = this.contexto;
      this.contexto = ctx;
      try {
        for (const cmd of comandos || []) {
          if (cmd === null || cmd === undefined) continue;
          this.comando(cmd, ctx);
        }
      } finally {
        this.contexto = anterior;
      }
    }

    comando(cmd, ctx) {
      switch (cmd.tipo) {
        case "declaracao":
          // §6 não tem `var` local: o parser só aceita o bloco antes do
          // `início`. Chegar aqui é um `null` de Statement ou nó futuro.
          this.erro("TIPO_NAO_DECLARADO", "Declaração de variável fora do bloco 'var'", cmd);
          return;

        case "escrever":
          for (const arg of cmd.argumentos || []) this.faixaDe(arg.expr);
          return;

        case "ler":
          for (const alvo of cmd.alvos || []) this.alvoDeLeitura(alvo);
          return;

        case "atribuicao":
          this.atribuicao(cmd.alvo, cmd.valor);
          return;

        case "expressao":
          this.faixaDe(cmd.valor);
          return;

        // Nó das extensões §31–§39 (adicionado na onda 9). Os argumentos já
        // vêm validados pelo parser contra a forma declarada do comando, então
        // aqui só interessa a faixa dos identificadores citados e o fato de a
        // extensão não_valor não devolver nada usável como alvo.
        case "extensao":
          for (const arg of cmd.argumentos || []) this.faixaDe(arg);
          return;

        case "se":
          this.exigirLogico(cmd.condicao, "condição do 'se'");
          this.bloco(cmd.entao, ctx);
          this.bloco(cmd.senao, ctx);
          return;

        case "enquanto":
          this.exigirLogico(cmd.condicao, "condição do 'enquanto'");
          this.bloco(cmd.corpo, this.dentroDeLaco(ctx));
          return;

        case "repita":
          this.bloco(cmd.corpo, this.dentroDeLaco(ctx));
          this.exigirLogico(cmd.condicao, "condição do 'até'");
          return;

        case "para":
          this.comandoPara(cmd, ctx);
          return;

        case "escolha":
          this.faixaDe(cmd.seletor);
          // §18 — o corpo do `caso` sai com `interrompa`, então ele conta como
          // laço para o `interrompa` (o runtime também trata assim).
          this.comandoEscolha(cmd, this.dentroDeLaco(ctx));
          return;

        case "interrompa":
          // §22 — `interrompa` só existe dentro de laço (ou de `escolha`).
          if (ctx.laco === 0) {
            this.erro(
              "TIPO_INCOMPATIVEL",
              "'interrompa' fora de 'para', 'enquanto', 'repita' ou 'escolha' (§22)",
              cmd
            );
          }
          return;

        case "retorne":
          this.comandoRetorne(cmd, ctx);
          return;

        case "fim-algoritmo":
          return;

        default:
          this.erro("TIPO_NAO_DECLARADO", "Comando desconhecido para a análise: '" + cmd.tipo + "'", cmd);
      }
    }

    dentroDeLaco(ctx) {
      return { escopo: ctx.escopo, laco: ctx.laco + 1, sub: ctx.sub };
    }

    comandoEscolha(cmd, ctx) {
      for (const caso of cmd.casos || []) {
        for (const v of caso.valores || []) {
          if (v && v.intervalo) {
            this.faixaDe(v.de);
            this.faixaDe(v.ate);
          } else {
            this.faixaDe(v);
          }
        }
        this.bloco(caso.corpo, ctx);
      }
      if (cmd.outrocaso) this.bloco(cmd.outrocaso.corpo, ctx);
    }

    /**
     * §22 — variável de controle, limites e passo. `passo 0` literal já é erro
     * de sintaxe (`SINTESE_PASSO_ZERO`, onda 3); aqui sobra só o estático.
     */
    comandoPara(cmd, ctx) {
      const v = this.resolver(cmd.variavel.nome, cmd.variavel);
      if (v && v.tipo) {
        const cat = categoria(v.tipo);
        if (cat !== null && !ehNumerico(cat)) {
          this.erro(
            "TIPO_INCOMPATIVEL",
            "Variável de controle '" + cmd.variavel.nome + "' é " + v.tipo + " e o 'para' exige número",
            cmd.variavel
          );
        }
      }
      for (const limite of [cmd.de, cmd.ate, cmd.passo]) {
        this.exigirNumero(limite, "limite do 'para'");
      }
      // §15 — `passo 0` tem sintaxe válida e semântica inválida. O código
      // INVALID_LOOP_STEP é exigido pelo backlog-debugger.md §15, e a classe é
      // `ErroSemantica` (não `ErroSintaxe`) pela mesma razão.
      //
      // Só o literal zero é detectável aqui. `passo n` com `n` valendo zero em
      // tempo de execução é caso dinâmico, e quem barra é o runtime.
      if (cmd.passo && cmd.passo.tipo === "literal" && cmd.passo.valor === 0) {
        this.erro("INVALID_LOOP_STEP", "Passo do 'para' não pode ser zero", cmd.passo);
      }
      this.bloco(cmd.corpo, this.dentroDeLaco(ctx));
    }

    /**
     * §26 — `retorne`. Três regras, todas decidíveis sem executar:
     *   · fora de função/procedimento → erro;
     *   · com valor dentro de `procedimento` → erro (o §23 dá ao procedimento
     *     retorno vazio, e o runtime já lança `TIPO_INCOMPATIVEL` nesse caso);
     *   · com valor dentro de `funcao` → o tipo é conferido contra o retorno
     *     declarado.
     */
    comandoRetorne(cmd, ctx) {
      if (!ctx.sub) {
        this.erro("TIPO_INCOMPATIVEL", "'retorne' só existe dentro de 'função' ou 'procedimento' (§26)", cmd);
        return;
      }
      if (cmd.valor === null || cmd.valor === undefined) {
        // `retorne` sem valor sai da subrotina com o neutro: válido nas duas.
        return;
      }
      const f = this.faixaDe(cmd.valor);
      if (ctx.sub.tipo === "procedimento") {
        this.erro(
          "TIPO_INCOMPATIVEL",
          "Procedimento '" + ctx.sub.nome + "' não retorna valor: 'retorne' aqui precisa ser sem valor (§26)",
          cmd
        );
        return;
      }
      this.conferir(ctx.sub.retorno, f, cmd, "retorno de '" + ctx.sub.nome + "'");
    }

    // ------------------------------------------------------------- subprogramas

    /**
     * Verifica o corpo de cada subprograma, com o escopo dos parâmetros.
     *
     * §23–§27 — as variáveis do VisuAlg são todas globais, então o escopo do
     * subprograma é o global MAIS os parâmetros. Nada mais é empilhado.
     */
    analisarSubprograma(sub) {
      this.bloco(sub.corpo, { escopo: this.escopoDoSubprograma(sub), laco: 0, sub: sub });
      this.revisarRetorno(sub);
    }

    /**
     * §23 — função que declara tipo de retorno tem de ter `retorne` em TODOS os
     * caminhos. O runtime é tolerante (`V.zeroDe(sub.retorno)`), e é essa
     * tolerância que produz o bug clássico: a função devolve 0 e o programa
     * segue com um número inventado, sem aviso.
     */
    revisarRetorno(sub) {
      if (sub.tipo !== "funcao") return;
      if (sub.retorno === null || sub.retorno === undefined) return;
      if (this.retornaEmTodosOsCaminhos(sub.corpo)) return;
      this.erro(
        "TIPO_INCOMPATIVEL",
        "Função '" + sub.nome + "' declara retorno '" + sub.retorno +
          "' mas nem todos os caminhos chegam a um 'retorne' (§26)",
        sub
      );
    }

    /**
     * `true` quando a lista de comandos tem um ponto em que o controle é
     * inevitavelmente transferido com `retorne`.
     *
     * Só o que é estrutural conta: `se`/`senao` com os dois ramos retornando, e
     * `escolha` com `outrocaso` e todas as cláusulas retornando. Um laço não
     * retorna por si só — nem `repita ate falso`, que é a resposta
     * conservadora certa (reprovar é melhor que aceitar função que devolve
     * número inventado).
     */
    retornaEmTodosOsCaminhos(comandos) {
      for (const cmd of comandos || []) {
        if (cmd === null || cmd === undefined) continue;
        if (cmd.tipo === "retorne") return true;
        if (cmd.tipo === "se" && cmd.senao) {
          if (this.retornaEmTodosOsCaminhos(cmd.entao) && this.retornaEmTodosOsCaminhos(cmd.senao)) {
            return true;
          }
          continue;
        }
        if (cmd.tipo === "escolha" && cmd.outrocaso) {
          let todos = this.retornaEmTodosOsCaminhos(cmd.outrocaso.corpo);
          for (const caso of cmd.casos || []) {
            if (!todos) break;
            todos = this.retornaEmTodosOsCaminhos(caso.corpo);
          }
          if (todos) return true;
          continue;
        }
      }
      return false;
    }

    // ------------------------------------------------------------------ alvos

    /**
     * §9 — alvo de `atribuicao`. Confere a EXISTÊNCIA do alvo e, quando o tipo
     * do lado direito é determinável, a compatibilidade com o tipo declarado.
     */
    atribuicao(alvo, valor) {
      const fValor = this.faixaDe(valor);
      const decl = this.alvo(alvo);
      if (!decl) return;
      this.conferir(decl.tipo, fValor, alvo, "atribuição a '" + decl.nome + "'");
    }

    /** Alvo de `leia` (§10): tem de existir. O digitado é texto, logo não há tipo a inferir. */
    alvoDeLeitura(alvo) {
      if (alvo.tipo === "identificador") {
        this.resolver(alvo.nome, alvo);
        return;
      }
      if (alvo.tipo === "indice") {
        this.indice(alvo);
        return;
      }
      this.erro("TIPO_INCOMPATIVEL", "Alvo de 'leia' inválido", alvo);
    }

    /**
     * Resolve um alvo de escrita e devolve `{nome, tipo}` do que é escrito.
     * `x: inteiro` → `{tipo: "inteiro"}`; `v[3]` com `v: vetor [1..5] de real` →
     * `{tipo: "real"}`, que é o tipo que o elemento realmente recebe.
     */
    alvo(no) {
      if (no.tipo === "identificador") return this.resolver(no.nome, no);
      if (no.tipo === "indice") {
        const f = this.indice(no);
        if (f && f.declarado) return { nome: no.alvo.nome, tipo: f.declarado };
        return null;
      }
      this.erro("TIPO_INCOMPATIVEL", "Alvo de escrita inválido", no);
      return null;
    }

    // -------------------------------------------------------------- expressões

    /** Inferência de tipo de uma expressão. `QUALQUER` = desconhecido. */
    faixaDe(no) {
      if (no === null || no === undefined) return QUALQUER;
      switch (no.tipo) {
        case "literal": {
          if (no.tipoLiteral === "lógico") return faixa("logico");
          if (no.tipoLiteral === "literal") return faixa("texto", null, null, String(no.valor));
          if (typeof no.valor === "number") return faixa("num", Number.isInteger(no.valor));
          return QUALQUER;
        }
        case "identificador": {
          const v = this.resolver(no.nome, no);
          if (!v || !v.tipo) return QUALQUER;
          return faixaDeTipo(v.tipo, v.tipoElemento);
        }
        case "indice":
          return this.indice(no);
        case "vetor-literal":
          return faixa("vetor");
        case "matriz-literal":
          return faixa("matriz");
        case "unario":
          return this.unario(no);
        case "binario":
          return this.binario(no);
        case "chamada":
          return this.chamada(no);
        default:
          return QUALQUER;
      }
    }

    unario(no) {
      if (no.operador === "não") {
        this.exigirLogico(no.operando, "operando de 'não'");
        return faixa("logico");
      }
      const f = this.faixaDe(no.operando);
      if (f === QUALQUER) return QUALQUER;
      if (f.cat === "num") return faixa("num", f.inteiro);
      this.erro("TIPO_INCOMPATIVEL", "'" + no.operador + "' unário espera número e recebeu " + this.nome(f), no);
      return QUALQUER;
    }

    /** §10, §13, §14 — aritmética, comparação e lógica. */
    binario(no) {
      const op = no.operador;
      if (LOGICOS.indexOf(op) >= 0) {
        this.exigirLogico(no.esquerda, "operando esquerdo de '" + op + "'");
        this.exigirLogico(no.direita, "operando direito de '" + op + "'");
        return faixa("logico");
      }
      if (RELACIONAIS.indexOf(op) >= 0) {
        this.faixaDe(no.esquerda);
        this.faixaDe(no.direita);
        return faixa("logico");
      }
      if (ARITMETICOS.indexOf(op) < 0) return QUALQUER;

      const a = this.faixaDe(no.esquerda);
      const b = this.faixaDe(no.direita);
      // §14 — `+` concatena quando algum lado é texto.
      if (op === "+" && ((a && a.cat === "texto") || (b && b.cat === "texto"))) {
        return faixa("texto");
      }
      this.exigirNumero(no.esquerda, "operando esquerdo de '" + op + "'");
      this.exigirNumero(no.direita, "operando direito de '" + op + "'");
      if (a === QUALQUER || b === QUALQUER) return faixa("num");

      if (no.esquerda.tipo === "literal" && no.direita.tipo === "literal") {
        const r = V_CONSTANTE[op](Number(no.esquerda.valor), Number(no.direita.valor));
        if (Number.isFinite(r)) return faixa("num", Number.isInteger(r));
      }
      if (op === "/" || op === "^") return faixa("num");
      // `+ - * \ div %` de dois inteiros é inteiro.
      return faixa("num", a.inteiro === true && b.inteiro === true ? true : null);
    }

    /**
     * §28 — `v[i]` e `m[i][j]`. O alvo tem de ser vetor ou matriz, a contagem de
     * índices tem de bater, e a faixa devolvida é a do ELEMENTO, que é o que a
     * atribuição confere. `declarado` guarda o tipo do elemento como foi
     * escrito, para a mensagem de `alvo()` dizer a verdade.
     */
    indice(no) {
      const f = this.faixaDe(no.alvo);
      if (f === QUALQUER) return QUALQUER;
      if (f.cat !== "vetor" && f.cat !== "matriz") {
        this.erro(
          "TIPO_INCOMPATIVEL",
          "'" + (no.alvo.nome || "valor") + "' é " + this.nome(f) + " e não aceita índice",
          no
        );
      }
      if (f.cat === "vetor" && no.indices.length !== 1) {
        this.erro("TIPO_INCOMPATIVEL", "Vetor '" + no.alvo.nome + "' espera 1 índice", no);
      }
      if (f.cat === "matriz" && no.indices.length !== 2) {
        this.erro("TIPO_INCOMPATIVEL", "Matriz '" + no.alvo.nome + "' espera 2 índices", no);
      }
      for (const i of no.indices) this.exigirNumero(i, "índice");
      if (!f.elemento) return QUALQUER;
      const elemento = faixaDeTipo(f.elemento);
      elemento.declarado = f.elemento;
      return elemento;
    }

    // ---------------------------------------------------------------- chamadas

    /**
     * §23–§27 — chamada. Subprograma declarado no próprio programa tem
     * assinatura conhecida e é conferido aqui; builtin vai para a stdlib, que
     * valida aridade e domínio com mensagem própria (§29.4, §30).
     */
    chamada(no) {
      this.relatorio.chamadas++;
      const sub = this.subprogramas.get(this.chave(no.nome));
      if (!sub) return this.chamadaDesconhecida(no);
      const params = sub.parametros || [];
      if (no.argumentos.length !== params.length) {
        this.erro(
          "TIPO_ARGUMENTOS",
          "'" + no.nome + "' espera " + params.length + " argumento(s) e recebeu " + no.argumentos.length,
          no
        );
      }
      for (let i = 0; i < params.length; i++) {
        this.conferirArgumento(no, params[i], i);
      }
      if (sub.tipo === "funcao" && sub.retorno) return faixaDeTipo(sub.retorno);
      return QUALQUER;
    }

    /**
     * §47 — "função inexistente".
     *
     * O registro de builtins é lido de `Vg.registros` (§29, §30) e é OPCIONAL:
     * se a stdlib não estiver carregada, o nome desconhecido é aceito, porque
     * acusar a falta de `Sen` com a stdlib fora seria pior que o bug.
     */
    chamadaDesconhecida(no) {
      const Vg = W.Vg;
      const registros = Vg && Vg.registros;
      if (registros && typeof registros === "object" && registros[this.chave(no.nome)] === undefined) {
        this.erro("TIPO_NAO_DECLARADO", "Subprograma '" + no.nome + "' não declarado", no);
      }
      return QUALQUER;
    }

    /**
     * Tipo de cada argumento contra o parâmetro. Parâmetro `var` (§25) exige
     * VARIÁVEL, não valor: o runtime liga o slot do chamador por alias, e um
     * `x + 1` não tem slot nenhum.
     */
    conferirArgumento(chamada, p, i) {
      const arg = chamada.argumentos[i];
      if (p.porReferencia) {
        if (arg.tipo !== "identificador" && arg.tipo !== "indice") {
          this.erro(
            "TIPO_ARGUMENTOS",
            "Parâmetro '" + p.nome + "' é por referência e precisa de uma variável, não de um valor calculado",
            arg
          );
        }
        if (arg.tipo === "indice") {
          this.indice(arg);
          return;
        }
        this.resolver(arg.nome, arg);
        return;
      }
      this.conferir(p.tipo, this.faixaDe(arg), arg, "argumento " + (i + 1) + " de '" + chamada.nome + "'");
    }

    // ------------------------------------------------------- checagens de tipo

    /**
     * Confere declarado x usado, e só acusa quando a faixa é DETERMINADA.
     *
     * A regra é deliberadamente permissiva com texto vindo de outra variável:
     * `x: real <- t` com `t: literal` funciona em runtime se `t` for "2.5" e
     * falha se for "Ana" — não é decidível aqui, então não é erro aqui. Já
     * `x: inteiro <- "abc"` tem literal do lado direito, e é o exemplo da §47.
     */
    conferir(declarado, f, no, rotulo) {
      const cat = categoria(declarado);
      if (cat === null || f === QUALQUER || f.cat === null) return;

      if (ehNumerico(cat)) {
        if (f.cat === "num") {
          if (cat === "inteiro" && f.inteiro === false) {
            this.erro(
              "TIPO_INCOMPATIVEL",
              "Não dá para atribuir um real com parte fracionária a " + declarado + " (" + rotulo + ")",
              no
            );
          }
          return;
        }
        if (f.cat === "texto") {
          if (typeof f.texto !== "string") {
            // Texto vindo de outra variável: `Values.coagir` aceita se for
            // número e recusa se for palavra, e aqui não há como saber qual.
            return;
          }
          // Literal de texto: o runtime aceitaria "42" e recusaria "abc", e dá
          // para decidir qual dos dois é sem executar nada.
          const s = f.texto.trim().replace(",", ".");
          if (!ehTextoNumerico(s)) {
            this.erro(
              "TIPO_INCOMPATIVEL",
              "Não dá para atribuir o texto '" + f.texto + "' a " + declarado + " (" + rotulo + ")",
              no
            );
          } else if (cat === "inteiro" && !/^-?\d+$/.test(s)) {
            this.erro(
              "TIPO_INCOMPATIVEL",
              "O texto '" + f.texto + "' não é inteiro e o destino é " + declarado + " (" + rotulo + ")",
              no
            );
          }
          return;
        }
        this.erro(
          "TIPO_INCOMPATIVEL",
          "Não dá para atribuir " + this.nome(f) + " a " + declarado + " (" + rotulo + ")",
          no
        );
        return;
      }

      if (cat === "texto" || cat === "logico") {
        // `Values.coagir` converte número e lógico nos dois casos; só vetor e
        // matriz são recusados.
        if (f.cat === "vetor" || f.cat === "matriz") {
          this.erro(
            "TIPO_INCOMPATIVEL",
            "Não dá para atribuir " + this.nome(f) + " a " + declarado + " (" + rotulo + ")",
            no
          );
        }
        return;
      }

      if (f.cat !== cat) {
        this.erro(
          "TIPO_INCOMPATIVEL",
          "Não dá para atribuir " + this.nome(f) + " a " + declarado + " (" + rotulo + ")",
          no
        );
      }
    }

    /** Condição de `se`/`enquanto`/`até` e operandos lógicos: tem de ser lógico. */
    exigirLogico(no, rotulo) {
      if (no === null || no === undefined) return;
      const f = this.faixaDe(no);
      if (f === QUALQUER || f.cat === null) return;
      if (f.cat !== "logico") {
        this.erro("TIPO_INCOMPATIVEL", "A " + rotulo + " precisa ser lógica e é " + this.nome(f), no);
      }
    }

    /** Limites de `para` e índices: têm de ser numéricos (§10, §28). */
    exigirNumero(no, rotulo) {
      if (no === null || no === undefined) return;
      const f = this.faixaDe(no);
      if (f === QUALQUER || f.cat === null) return;
      if (f.cat !== "num") {
        this.erro("TIPO_INCOMPATIVEL", "O " + rotulo + " precisa ser numérico e é " + this.nome(f), no);
      }
    }

    /** Nome legível do tipo, para a mensagem. */
    nome(f) {
      if (f === QUALQUER) return "desconhecido";
      switch (f.cat) {
        case "num": return "número";
        case "texto": return "texto";
        case "logico": return "lógico";
        default: return f.cat;
      }
    }
  }

  VG.Semantica = Semantica;
})(W.VG);
