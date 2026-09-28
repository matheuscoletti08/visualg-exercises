// §25, §27 — ambientes, frames e passagem por referência.
//
// §27 pede Global Environment -> Function Call Frame -> Local Environment, e
// §25 exige referência REAL, não cópia do valor. A cópia é o modo de erro
// clássico aqui: `procedimento somar(var x)` que só escreve numa cópia passa nos
// testes ingênuos e não muda nada no chamador.
//
// A referência é feita por `alias` no slot: o slot do parâmetro aponta para o
// slot do chamador, e leitura/escrita atravessam o ponteiro. Nenhum boxing
// needed, e a mutação é visível dos dois lados sem API extra.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const V = VG.Values;
  const Diagnostics = VG.Diagnostics;

  /**
   * Nomes reservados do VisuAlg (§29.4): as funções matemática e de string não
   * podem ser redeclaradas pelo usuário, senão `sen` deixa de ser `sen` e o
   * programa fica dependente da ordem de declaração.
   *
   * A lista precisa casar EXATAMENTE com os builtins registrados pela onda 8.
   * Uma versão anterior trazia os legados `caracp`, `caract` e `todos`, que não
   * existem no spec, e omitia `copia`, `arccos`, `arcsen`, `arcsin`, `arctan`,
   * `rand` e `randi` — o que permitia ao usuário sombrear um builtin
   * simplesmente declarando uma variável ou função com o mesmo nome.
   */
  const NOMES_RESERVADOS = [
    // §29 — matemática
    "abs", "arred", "arredp", "arccos", "arcsen", "arctan", "cos", "cotan",
    "exp", "grauprad", "int", "log", "logn", "pi", "quad", "radpgrau",
    "raizq", "rand", "randi", "sen", "tan",
    // §30 — texto
    "asc", "carac", "caracpnum", "compr", "copia", "maiusc", "minusc",
    "numpcarac", "pos",
    // §32/§39 — primitivas de arquivo virtual. `fim` e `nome` ficam de FORA de
    // propósito: o corpus declara variáveis com esses nomes (`faccat/ex21.alg`
    // tem `fim: inteiro`), e §29.4 proíbe declarar o que é builtin. Eles
    // continuam existindo como método do VFS.
    "existe", "tamanho", "conteudo", "cabecalho", "lista", "apague",
    "renomeie", "escrever", "lera", "arquivos",
  ];

  /** Uma variável: nome, tipo declarado, valor, e o alias de §25. */
  class Slot {
    constructor(nome, tipo, valor, pos) {
      this.nome = nome;
      this.tipo = tipo;
      this.valor = valor === undefined ? V.zeroDe(tipo) : valor;
      this.alias = null; // quando não nulo, este slot é referência a outro
      this.linha = pos && pos.linha != null ? pos.linha : null;
      this.coluna = pos && pos.coluna != null ? pos.coluna : null;
      this.constante = false;
    }
  }

  function erro(codigo, mensagem, pos) {
    return Diagnostics.criar(codigo, mensagem, pos);
  }

  /**
   * Um ambiente. `Map` e não objeto porque §67 e a auditoria originals apontam
   * o mesmo risco: nome de variável `constructor` ou `__proto__` num objeto
   * comum envenena o prototype. `Map` não tem esse problema.
   */
  class Ambiente {
    constructor(nome, pai) {
      this.nome = nome;
      this.pai = pai || null;
      this.slots = new Map();
    }

    /** Slot efetivo, atravessando `alias` até a raiz da cadeia. */
    resolver(slot) {
      let s = slot;
      let guarda = 0;
      while (s.alias !== null) {
        s = s.alias;
        if (++guarda > 1000) throw erro("RUNTIME_RECURSAO", "Ciclo de alias em '" + slot.nome + "'");
      }
      return s;
    }

    /** Cria variável nova. Erra se o nome já existe NESTE ambiente. */
    definir(nome, tipo, valor, pos) {
      const chave = String(nome).toLowerCase();
      if (this.slots.has(chave)) {
        throw erro("RUNTIME_NAO_DECLARADA", "Variável '" + nome + "' já declarada", pos);
      }
      const slot = new Slot(chave, tipo, valor, pos);
      this.slots.set(chave, slot);
      return slot;
    }

    /** Declara vários nomes com o mesmo tipo (§6). */
    definirVarios(nomes, tipo, pos) {
      return nomes.map((n) => this.definir(n, tipo, undefined, pos));
    }

    /** Procura o slot de um nome, subindo a cadeia de escopos. */
    buscar(nome, pos) {
      const chave = String(nome).toLowerCase();
      let amb = this;
      while (amb) {
        const slot = amb.slots.get(chave);
        if (slot) return slot;
        amb = amb.pai;
      }
      throw erro("RUNTIME_NAO_DECLARADA", "Variável '" + nome + "' não declarada", pos);
    }

    existeLocal(nome) {
      return this.slots.has(String(nome).toLowerCase());
    }

    ler(nome, pos) {
      return this.resolver(this.buscar(nome, pos)).valor;
    }

    /**
     * Atribui. Se o alvo for um slot de vetor/matriz, o runtime resolve antes de
     * chegar aqui, então qualquer coisa que chegue é slot simples.
     *
     * Coage para o tipo declarado: `i: inteiro` receiving `7 / 2` (= 3.5) é
     * erro, não truncamento. Perder informação em silêncio é a classe de bug que
     * §10 e §46 existem para evitar.
     */
    atribuir(nome, valor, pos) {
      const slot = this.buscar(nome, pos);
      const alvo = this.resolver(slot);
      if (alvo.constante) {
        throw erro("RUNTIME_NAO_DECLARADA", "Variável '" + nome + "' é constante", pos);
      }
      // Célula sintética de vetor/matriz passada por referência (§25): a
      // escrita vai direto no vetor, não numa cópia local.
      if (typeof alvo.definirEm === "function") {
        alvo.definirEm(valor);
        return valor;
      }
      const tipo = alvo.tipo;
      const convertido =
        tipo === "vetor" || tipo === "matriz" ? valor : V.coagir(valor, tipo, pos);
      alvo.valor = convertido;
      return convertido;
    }

    /**
     * Declara um parâmetro por referência (§25).
     *
     * `origem` é o slot do chamador. Se o argumento for um elemento de vetor ou
     * matriz, quem chama passa um slot sintético de célula — o runtime resolve.
     */
    definirPorReferencia(nome, tipo, origem, pos) {
      const chave = String(nome).toLowerCase();
      const slot = new Slot(chave, tipo, undefined, pos);
      slot.alias = origem || null;
      if (slot.alias === null) slot.valor = V.zeroDe(tipo);
      this.slots.set(chave, slot);
      return slot;
    }

    /** Nomes visíveis daqui para fora — usado pelo painel de variáveis (§43). */
    visiveis() {
      const fora = [];
      let amb = this;
      while (amb) {
        if (amb !== this) {
          for (const chave of amb.slots.keys()) if (fora.indexOf(chave) < 0) fora.push(chave);
        }
        amb = amb.pai;
      }
      for (const chave of this.slots.keys()) if (fora.indexOf(chave) < 0) fora.push(chave);
      return fora;
    }
  }

  /** Um frame de chamada (§27), com o bastante para o painel de call stack (§44). */
  class Frame {
    constructor(nome, ambiente, pos) {
      this.nome = nome;
      this.ambiente = ambiente;
      this.linha = pos && pos.linha != null ? pos.linha : null;
      this.coluna = pos && pos.coluna != null ? pos.coluna : null;
      this.parametros = [];
    }
  }

  /**
   * Corrente de ambientes + pilha de chamadas.
   *
   * `limiteRecursao` existe porque recursão é a forma mais fácil de estourar a
   * pilha do JavaScript, e um RangeError cru não diz nada de útil para quem
   * escreve o programa. §27 exige call stack exibível, e isso vem junto.
   */
  class Contexto {
    constructor(opcoes) {
      const o = opcoes || {};
      this.global = new Ambiente("global", null);
      this.ambiente = this.global;
      this.pilha = [];
      this.limiteRecursao = o.limiteRecursao || 2000;
      this.profundidade = 0;
    }

    empilharFrame(nome, pos) {
      if (this.pilha.length >= this.limiteRecursao) {
        throw erro(
          "RUNTIME_RECURSAO",
          "Recursão passou de " + this.limiteRecursao + " níveis",
          pos
        );
      }
      const frame = new Frame(nome, new Ambiente(nome, this.ambiente), pos);
      this.pilha.push(frame);
      this.profundidade++;
      this.ambiente = frame.ambiente;
      return frame;
    }

    desempilharFrame() {
      this.pilha.pop();
      this.profundidade--;
      this.ambiente = this.pilha.length > 0 ? this.pilha[this.pilha.length - 1].ambiente : this.global;
    }

    /** Chamada de §44: do mais interno para o mais externo. */
    callStack() {
      const saida = [];
      for (let i = this.pilha.length - 1; i >= 0; i--) {
        const f = this.pilha[i];
        saida.push({ nome: f.nome, linha: f.linha, coluna: f.coluna, profundidade: i + 1 });
      }
      return saida;
    }

    /** Variáveis do ambiente atual, para §43. */
    variaveis() {
      const m = new Map();
      let amb = this.ambiente;
      while (amb) {
        for (const [chave, slot] of amb.slots) {
          if (!m.has(chave)) m.set(chave, this.resolverNo(slot, amb));
        }
        amb = amb.pai;
      }
      return m;
    }

    resolverNo(slot, amb) {
      return amb.resolver(slot);
    }
  }

  VG.Environment = {
    Slot: Slot,
    Ambiente: Ambiente,
    Frame: Frame,
    Contexto: Contexto,
    NOMES_RESERVADOS: NOMES_RESERVADOS,
    ehNomeReservado: (n) => NOMES_RESERVADOS.indexOf(String(n).toLowerCase()) >= 0,
  };
})(W.VG);
