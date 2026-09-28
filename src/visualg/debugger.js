// §28 — Debugger Core.
//
// ## O que este arquivo é, e o que ele NÃO é
//
// Ele é uma CASCA. Toda a semântica de depuração mora no `runtime.js`:
// `step`, `resume`, `stop`, breakpoints, ExecutionPoint, variáveis, call stack e
// perfil são métodos do runtime. Este arquivo só:
//
//   1. segura a `Sessao` (§17) e repassa os comandos;
//   2. traduz o estado do runtime em um retrato que a UI desenha;
//   3. guarda as preferências do debugger (breakpoints, frame focado, Watches).
//
// ## Por que não há estado aqui
//
// §39.3 e §39.4 exigem que a call stack do debugger seja a do runtime e que as
// variáveis mostradas sejam o `Environment` real. A forma de garantir isso é não
// ter segunda estrutura: o que este arquivo mostra vem de
// `runtime.getCallStack()` e `runtime.getVariables()`, que são a mesma coisa que
// o executor está usando. §39.12 (a UI não muta o Environment) vale porque não
// há API de escrita de variável aqui.
//
// ## A armadilha que este desenho evita
//
// A primeira versão do projeto pausava DERRUBANDO a execução e reexecutando o
// programa do começo a cada "continuar", pulando os comandos já rodados. Era
// impossível de usar: o `leia` pendente morria com a execução anterior, o
// `escreva` era silenciado durante o prefixo e o console ficava inconsistente,
// e extensões não determinísticas (`aleatorio`, `cronometro`) devolviam valores
// diferentes na segunda passagem. Aqui a execução é UMA e contínua: a barreira do
// runtime segura o statement e `resume`/`step` a solta. Nada é reexecutado, e
// §39.7 e §39.8 passam por construção.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const ESTADO = VG.Scheduler.ESTADO;
  const Diagnostics = VG.Diagnostics;

  /** Motivos de pausa que a UI precisa distinguir ao mostrar o status. */
  const MOTIVO = {
    BREAKPOINT: "breakpoint",
    CONDICIONAL: "condicional",
    SOBRE: "sobre",
    DENTRO: "dentro",
    FORA: "fora",
    RUN_TO_CURSOR: "run_to_cursor",
    // §22 / §23 — pausa pedida pelo PRÓPRIO PROGRAMA, não pela UI.
    SOURCE_PAUSE: "source_pause",
    CONDITIONAL_DEBUG: "conditional_debug",
    PAUSE_PEDIDO: "pause_requested",
  };

  /** §30 — modos de passo, que são extensão do playground (D9). */
  const PASSO = { SOBRE: "sobre", DENTRO: "dentro", FORA: "fora" };

  class Debug {
    constructor(codigo, opcoes) {
      const o = opcoes || {};
      this.opcoes = o;
      this.ouvintes = [];
      this.breakpoints = new Set();
      this.condicionais = new Map();
      this.watches = [];
      this.quadroFocado = null;
      this.variavelModificada = null;
      this.motivo = null;
      this.snapshot = null;
      this.erro = null;
      this.estado = ESTADO.IDLE;
      this.sessao = null;
      this.desligado = false;
      if (typeof codigo === "string" && codigo.length) this.carregar(codigo);
    }

    // ------------------------------------------------------------- ciclo base

    carregar(codigo) {
      this.codigo = codigo;
      this.sessao = VG.Api.criarSessao(codigo, this.opcoesRuntime());
      this.ligarEventos();
      return this.sessao;
    }

    /**
     * As opções passadas ao runtime, com os callbacks que o Core usa para
     * manter o retrato atualizado. Tudo aqui é OBSERVADOR: nenhum deles
     * decide se o programa pausa.
     */
    opcoesRuntime() {
      const self = this;
      const base = this.opcoes || {};
      return Object.assign({}, base, {
        aoPausa: function (snap) {
          self.snapshot = snap;
          self.motivo = snap && snap.motivo ? snap.motivo : MOTIVO.BREAKPOINT;
          self.estado = ESTADO.PAUSED;
          // §28.5/§28.6 — recarrega os breakpoints no runtime novo. Eles são
          // estado do DEBUGGER (preferência do usuário), não do runtime, e o
          // runtime acabou de nascer.
          for (const l of self.breakpoints) self.sessao.addBreakpoint(l);
          for (const [l, expr] of self.condicionais) self.sessao.setBreakpointCondicional(l, expr);
          if (typeof base.aoPausa === "function") base.aoPausa(snap);
          self.emitir();
        },
        aoErro: function (e, rt, cmd) {
          const serializado = Diagnostics.serializar(e);
          // §40 — o snapshot fica CONGELADO no instante do erro, com a pilha de
          // pé. `callStack` e `variables` vêm do runtime, e é por isso que o
          // painel mostra o contexto do erro e não o de depois dele.
          self.erro = {
            codigo: serializado.codigo,
            mensagem: serializado.mensagem,
            sourceLine: serializado.linha,
            sourceColumn: serializado.coluna,
            length: serializado.length,
            errorCode: serializado.codigo,
            callStack: rt.getCallStack(),
            variables: rt.getVariables(),
            executionPoint: rt.executionPoint,
          };
          self.estado = ESTADO.ERROR;
          if (typeof base.aoErro === "function") base.aoErro(e, rt, cmd);
          self.emitir();
        },
        aoVariavel: function (e) {
          // §32 — a UI destaca a variável que mudou. O Core só guarda o
          // último evento; quem decide focar é o painel.
          self.variavelModificada = e;
          if (typeof base.aoVariavel === "function") base.aoVariavel(e);
          self.emitir();
        },
        aoLinha: function (linha, no, ponto) {
          if (typeof base.aoLinha === "function") base.aoLinha(linha, no, ponto);
        },
      });
    }

    /** Liga os eventos da sessão ao retrato do Core. */
    ligarEventos() {
      const self = this;
      const s = this.sessao;
      s.on("estado", function () {
        self.estado = s.estado;
        self.emitir();
      });
      s.on("passo", function (ponto) {
        if (ponto) self.pontoAtual = ponto;
        // O perfil é lido do runtime, que é quem conta (§28.9). A UI só
        // desenha, e nunca recalcula.
      });
    }

    // ------------------------------------------------------------- §28.2-4

    /** §28.2 — um statement observável. `modo` = sobre | dentro | fora. */
    passo(modo) {
      if (!this.sessao) return false;
      this.motivo = modo || MOTIVO.SOBRE;
      this.estado = ESTADO.STEPPING;
      const r = this.sessao.step(modo || PASSO.SOBRE);
      this.emitir();
      return r;
    }

    /** §28.3 — continua. Não fica preso no mesmo breakpoint (§28.3). */
    continuar() {
      if (!this.sessao) return false;
      this.motivo = MOTIVO.BREAKPOINT;
      this.estado = ESTADO.RUNNING;
      const r = this.sessao.resume();
      this.emitir();
      return r;
    }

    /** §11C — Run to Cursor. */
    irAte(linha) {
      if (!this.sessao) return false;
      this.motivo = MOTIVO.RUN_TO_CURSOR;
      this.estado = ESTADO.STEPPING;
      const r = this.sessao.stepAte(linha);
      this.emitir();
      return r;
    }

    /**
     * §28.4 — `stop`. Preserva código e breakpoints.
     *
     * §40 — depois de `error`, `stop()` é o que limpa o estado congelado.
     */
    parar() {
      if (!this.sessao) return false;
      const r = this.sessao.stop();
      this.estado = ESTADO.STOPPED;
      this.erro = null;
      this.snapshot = null;
      this.emitir();
      return r;
    }

    /** Pausa a partir do próximo statement, sem derrubar a execução. */
    pausar() {
      if (!this.sessao) return false;
      this.pausarPede = true;
      this.emitir();
      return true;
    }

    /** Executa. Devolve a promessa da execução inteira. */
    executar(opcoes) {
      if (!this.sessao) this.carregar(this.codigo);
      this.erro = null;
      this.snapshot = null;
      this.motivo = null;
      this.estado = ESTADO.RUNNING;
      this.emitir();
      const self = this;
      // Com breakpoint marcado, a execução CORRE até o primeiro deles, que é o
      // que uma IDE faz com F5. Sem nenhum, pausa no primeiro statement, para
      // o botão Debug mostrar o estado inicial em vez de o programa disparar até
      // o fim. `pausarNoInicio` explícito sempre vence.
      const padrao = { depurar: true, pausarNoInicio: this.linhas().length === 0 };
      return this.sessao.executar(Object.assign(padrao, opcoes || {})).then(function (r) {
        self.estado = self.sessao.estado;
        self.emitir();
        return r;
      });
    }

    // ------------------------------------------------------------- §28.5

    alternar(linha) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      if (this.breakpoints.has(n)) {
        this.breakpoints.delete(n);
        this.condicionais.delete(n);
        if (this.sessao) this.sessao.removeBreakpoint(n);
        this.emitir();
        return false;
      }
      this.breakpoints.add(n);
      if (this.sessao) this.sessao.addBreakpoint(n);
      this.emitir();
      return true;
    }

    tem(linha) {
      return this.breakpoints.has(Number(linha));
    }

    linhas() {
      return Array.from(this.breakpoints).sort((a, b) => a - b);
    }

    limparBreakpoints() {
      this.breakpoints.clear();
      this.condicionais.clear();
      if (this.sessao) this.sessao.clearBreakpoints();
      this.emitir();
    }

    /**
     * §11C — breakpoint condicional. É extensão do playground, e a condição é
     * avaliada pelo evaluator da engine.
     */
    definirCondicional(linha, expressao) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      const expr = String(expressao || "").trim();
      if (!expr) {
        this.condicionais.delete(n);
        if (this.sessao) this.sessao.setBreakpointCondicional(n, "");
        this.emitir();
        return true;
      }
      this.breakpoints.add(n);
      this.condicionais.set(n, expr);
      if (this.sessao) this.sessao.setBreakpointCondicional(n, expr);
      this.emitir();
      return true;
    }

    condicionalDe(linha) {
      const v = this.condicionais.get(Number(linha));
      return v === undefined ? null : v;
    }

    // ------------------------------------------------------------- §30 Watch

    /**
     * §30 — Watch expressions. EXTENSÃO DO PLAYGROUND (D9): não é comando do
     * VisuAlg e não aparece como tal na UI.
     *
     * Cada watch é uma expressão reavaliada com o evaluator da engine contra o
     * runtime atual. Reavaliar (e não recalcular) é o que faz a watch mostrar o
     * valor de AGORA.
     */
    adicionarWatch(expressao) {
      const src = String(expressao || "").trim();
      if (!src) return false;
      this.watches.push({ expressao: src, valor: null, erro: null });
      this.avaliarWatches();
      this.emitir();
      return true;
    }
    removerWatch(indice) {
      if (indice < 0 || indice >= this.watches.length) return false;
      this.watches.splice(indice, 1);
      this.emitir();
      return true;
    }
    limparWatches() {
      this.watches.length = 0;
      this.emitir();
    }
    avaliarWatches() {
      const rt = this.sessao && this.sessao.runtime;
      for (const w of this.watches) {
        w.erro = null;
        w.valor = null;
        if (!rt) continue;
        try {
          const prog = VG.Api.analisar('Algoritmo "w"\nInicio\n   x <- ' + w.expressao + "\nFimalgoritmo\n");
          w.valor = rt.avaliar(prog.corpo[0].valor);
        } catch (e) {
          w.erro = e && e.message ? e.message : String(e);
        }
      }
      return this.watches;
    }

    // ------------------------------------------------------------- §33 frames

    /**
     * §33 — frame selection. Muda SÓ o contexto de inspeção, nunca a execução.
     * Por isso ele não toca no runtime: é um índice de leitura.
     */
    focar(profundidade) {
      this.quadroFocado = profundidade === null || profundidade === undefined ? null : Number(profundidade);
      this.emitir();
    }

    // ------------------------------------------------------------- retrato

    aoMudar(cb) {
      this.ouvintes.push(cb);
      return () => {
        const i = this.ouvintes.indexOf(cb);
        if (i >= 0) this.ouvintes.splice(i, 1);
      };
    }

    emitir() {
      const r = this.retrato();
      for (const cb of this.ouvintes.slice()) {
        try {
          cb(r);
        } catch (e) {
          // painel quebrado
        }
      }
    }

    /**
     * O retrato que a UI desenha. Tudo aqui vem do runtime; nada é mantido em
     * paralelo.
     */
    retrato() {
      // `runtime || ultimoRuntime`: depois que a execução acaba, o perfil e as
      // variáveis do último instante continuam sendo o que o painel deve mostrar.
      const rt = (this.sessao && (this.sessao.runtime || this.sessao.ultimoRuntime)) || null;
      const vars = rt ? rt.getVariables(this.quadroFocado) : { globais: [], quadros: [], foco: 0 };
      const pilha = rt ? rt.getCallStack() : [];
      const perfil = rt ? rt.getProfile("execucoes") : [];
      return {
        estado: this.estado,
        pausado: this.estado === ESTADO.PAUSED,
        motivo: this.motivo,
        executionPoint: rt ? rt.executionPoint : null,
        callStack: pilha,
        variaveis: vars,
        perfil: perfil,
        perfilPorLinha: rt ? rt.getProfile("linha") : [],
        breakpoints: this.linhas(),
        condicionais: Array.from(this.condicionais).map(([linha, expressao]) => ({ linha, expressao })),
        watches: this.avaliarWatches(),
        quadroFocado: this.quadroFocado,
        variavelModificada: this.variavelModificada,
        erro: this.erro,
        // §26 — custos visíveis, nunca escondidos.
        stats: rt ? { comandos: rt.proximoStatementId - 1, passos: rt.scheduler.passos } : null,
      };
    }

    // Aliases que a primeira versão usava, para não quebrar painel já escrito.
    estadoDebug() {
      return this.retrato();
    }
    perfilOrdenado(ordem) {
      const rt = (this.sessao && (this.sessao.runtime || this.sessao.ultimoRuntime)) || null;
      return rt ? rt.getProfile(ordem === "linha" ? "linha" : "execucoes") : [];
    }
    maisExecutadas(n) {
      return this.perfilOrdenado("execucoes").slice(0, n || 10);
    }
  }

  VG.Debugger = {
    criar: (codigo, opcoes) => new Debug(codigo, opcoes),
    Debug: Debug,
    PASSO: PASSO,
    MOTIVO: MOTIVO,
    ESTADO: ESTADO,
  };
})(W.VG);
