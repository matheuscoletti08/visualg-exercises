// §58 / §17 — superfície pública do engine.
//
// Três níveis, porque o Playground precisa dos três em momentos diferentes:
//
//   `analisar(codigo)`  — só lexa e parseia, devolve a AST. Barato, e é o que o
//                        realce/autocomplete/formatter usam a cada tecla.
//   `criarRuntime(...)` — cria o objeto de execução com callbacks. Quem quiser
//                        `step`/`resume`/`stop` segura o objeto.
//   `executar(codigo, opcoes)` — atalho de uso único, compatível com a chamada
//                        que o `script.js` já faz hoje.
//
// `Sessao` é a casca que a UI usa: liga os eventos do runtime a um único objeto
// com callbacks, e é o que traduz `paused`/`finished`/`error` em estado visível.
//
// Nenhum `eval`, nenhuma dependência de DOM, nenhuma rede, nenhum storage: o
// núcleo é utilizável tanto no browser quanto sob `file://` quanto no worker.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;
  const S = VG.Scheduler;
  const ESTADO = S.ESTADO;

  /** Erros de API que o chamador deve poder tratar sem try/catch. */
  class ErroDeUso extends Error {
    constructor(mensagem) {
      super(mensagem);
      this.name = "ErroDeUso";
    }
  }

  /**
   * Registro de builtins a usar.
   *
   * Se o chamador não passar um, usa o global montado por `index.js` (§29, §30,
   * §31–§39). Sem este default, `sen(90)` falhava com "Subprograma não
   * declarado" mesmo com a stdlib carregada — o módulo era publicado, mas
   * ninguém ligava o registro ao runtime.
   */
  function registrosDe(o) {
    if (o && o.registros) return o.registros;
    if (W.Vg && W.Vg.registros) return W.Vg.registros;
    return {};
  }

  /** §58 — lexa e parseia, devolvendo o programa ou lançando erro de §46. */
  function analisar(codigo, opcoes) {
    const o = opcoes || {};
    const fonte = typeof codigo === "string" ? codigo : "";
    const tokens = new VG.Lexer(fonte).tokenizar();
    const programa = new VG.Parser(tokens).parse();
    if (o.analisarSemantica && typeof VG.Semantica === "function") {
      new VG.Semantica(programa, fonte).analisar();
    }
    return programa;
  }

  /**
   * §58 — cria o runtime. `opcoes`:
   *   saida(texto)          — cada pedaço de `escreva`, sem quebra implícita
   *   entrada(prompt)       — Promise do texto digitado
   *   deveParar()           — consultado a cada comando; true interrompe
   *   maxPassos             — §53, padrão 2000000
   *   maxExecutionTime      — §53, ms de relógio de parede. SEM PADRÃO: ausente,
 *                            `0` ou `null` significa "sem teto". A trava contra
 *                            loop infinito é `maxPassos`, que conta trabalho; o
 *                            relógio de parede mede a máquina de quem roda, e
 *                            FIXO só derrubaria programas lentos que estão
 *                            corretos — que é justamente o que se depura.
   *   aoLinha(linha, no, ponto)   — §42
   *   aoPausa(snapshot)     — §40, quando o programa para
   *   aoErro(erro, rt, cmd) — §40, com a pilha ainda de pé
   *   limiteElementos       — teto de itens exibidos nos painéis
   *   registros             — builtins e extensões; padrão é o global
   */
  function criarRuntime(programa, opcoes) {
    if (!programa || programa.tipo !== "programa") {
      throw new ErroDeUso("criarRuntime espera o programa devolvido por analisar()");
    }
    const o = Object.assign({}, opcoes || {});
    o.registros = registrosDe(o);
    return new VG.Runtime(programa, o);
  }

  /**
   * Atalho de uso único. Devolve SEMPRE um objeto, nunca lança: é o contrato
   * que o `script.js` consome e que o harness de teste compara.
   *
   *   { ok: true }
   *   { ok: false, interrompido: true }
   *   { ok: false, erro: { mensagem, linha, coluna, codigo, tipo, ... } }
   */
  async function executar(codigo, opcoes) {
    const o = opcoes || {};
    let programa;
    try {
      programa = new VG.Lexer(typeof codigo === "string" ? codigo : "").tokenizar();
      programa = new VG.Parser(programa).parse();
    } catch (e) {
      return { ok: false, erro: Diagnostics.serializar(e) };
    }
    const runtime = new VG.Runtime(programa, Object.assign({}, o, { registros: registrosDe(o) }));
    return runtime.executar();
  }

  /**
   * §17 / §27 — a sessão controlada: o objeto que a UI segura enquanto o
   * programa roda.
   *
   * Eventos (§17): `entrada`, `saida`, `erro`, `estado`, `passo`.
   * A UI nunca muta o `Environment` — ela só lê `getVariables()` e
   * `getCallStack()` do runtime, e manda `step`/`resume`/`stop`. §39.12.
   */
  class Sessao {
    /**
     * `opcoes` aceita tudo o que `criarRuntime` aceita, mais:
     *   aoPasso(ponto)    — chamado a cada statement, para o gutter e o perfil
     *   aoVariavel(e)     — §28.7 `variable_changed`
     *   aoPausa(snapshot) — §40
     */
    constructor(codigo, opcoes) {
      const o = opcoes || {};
      this.ouvintes = {
        estado: [],
        saida: [],
        entrada: [],
        erro: [],
        passo: [],
        pausa: [],
        variavel: [],
      };
      this.codigo = codigo;
      this.estado = ESTADO.IDLE;
      this.promessa = null;
      this.runtime = null;
      this.ultimoPonto = null;
      this.erro = null;
      this.encerrada = false;
      this.entradaPendente = null;
      this.breakpoints = new Set();
      this.condicionais = new Map();

      const self = this;
      const opcoesRuntime = Object.assign({}, o, {
        saida: function (t) {
          self.emitir("saida", t);
          if (typeof o.saida === "function") o.saida(t);
        },
        entrada: function (p) {
          self.emitir("entrada", { prompt: p });
          self.estado = ESTADO.WAITING_INPUT;
          self.emitirEstado();
          if (typeof o.entrada !== "function") return Promise.resolve("");
          return new Promise(function (resolve, reject) {
            self.entradaPendente = { resolve: resolve, reject: reject };
            Promise.resolve(o.entrada(p)).then(
              function (resposta) {
                self.entradaPendente = null;
                if (self.estado === ESTADO.WAITING_INPUT) {
                  self.estado = ESTADO.RUNNING;
                  self.emitirEstado();
                }
                resolve(resposta);
              },
              function (e) {
                self.entradaPendente = null;
                reject(e);
              }
            );
          });
        },
        aoLinha: function (linha, no, ponto) {
          self.ultimoPonto = ponto || null;
          self.emitir("passo", ponto || null);
          if (typeof o.aoLinha === "function") o.aoLinha(linha, no, ponto);
        },
        aoPausa: function (snap) {
          self.estado = ESTADO.PAUSED;
          self.emitir("pausa", snap);
          self.emitirEstado();
          if (typeof o.aoPausa === "function") o.aoPausa(snap);
        },
        aoErro: function (e, rt, cmd) {
          // §40 — o snapshot fica CONGELADO no instante do erro, com a pilha de
          // pé. Depois de `error`, `step()` e `resume()` não continuam nada: só
          // uma nova execução ou `stop()` limpam.
          //
          // O runtime notifica o erro em CADA nível que o vê: dentro de `quebra`,
          // a pilha é `["quebra"]`; ao desenrolar, o `escreval` que fez a chamada
          // notifica de novo, agora com a pilha vazia. Deixar o segundo passar
          // SOBRESCREVIA o snapshot com a pilha desmontada — que é exatamente a
          // informação que o §40 manda preservar, e o painel de call stack
          // aparecia vazio no momento em que mais interessa. O primeiro a falar
          // é o frame mais interno, que é o que o aluno precisa ver.
          if (self.erro) return;
          const serializado = Diagnostics.serializar(e);
          serializado.callStack = rt.getCallStack();
          serializado.variables = rt.getVariables();
          serializado.executionPoint = rt.executionPoint;
          self.erro = serializado;
          if (typeof o.aoErro === "function") o.aoErro(e, rt, cmd);
        },
        onStop: function () {
          if (typeof o.onStop === "function") o.onStop();
        },
      });
      this.opcoesRuntime = opcoesRuntime;
    }

    on(evento, cb) {
      if (!this.ouvintes[evento]) this.ouvintes[evento] = [];
      this.ouvintes[evento].push(cb);
      return () => this.off(evento, cb);
    }

    off(evento, cb) {
      const l = this.ouvintes[evento];
      if (l) {
        const i = l.indexOf(cb);
        if (i >= 0) l.splice(i, 1);
      }
    }

    emitir(evento, dados) {
      for (const cb of this.ouvintes[evento] || []) {
        try {
          cb(dados);
        } catch (e) {
          // Um painel quebrado não pode derrubar o programa.
        }
      }
    }

    emitirEstado() {
      this.emitir("estado", { estado: this.estado, ponto: this.ultimoPonto });
    }

    /** §58 — troca o código, mantendo o runtime pronto para uma nova execução. */
    carregar(codigo) {
      this.codigo = codigo;
      this.erro = null;
      this.encerrada = false;
      this.estado = ESTADO.IDLE;
      this.ultimoPonto = null;
      return analisar(codigo, { analisarSemantica: true });
    }

    /**
     * Executa. Devolve a promessa da execução INTEIRA: ela só resolve quando o
     * programa termina, erra ou é parado. Pausar NÃO resolve, e é por isso que
     * a UI pode ficar esperando.
     */
    executar(opcoes) {
      const o = opcoes || {};
      if (this.encerrada) return Promise.resolve({ ok: false, interrompido: true });
      let programa;
      try {
        programa = o.codigo ? analisar(o.codigo, { analisarSemantica: true }) : analisar(this.codigo, { analisarSemantica: true });
      } catch (e) {
        this.erro = Diagnostics.serializar(e);
        this.estado = ESTADO.ERROR;
        this.emitir("erro", this.erro);
        this.emitirEstado();
        this.encerrada = true;
        return Promise.resolve({ ok: false, erro: this.erro });
      }

      const runtime = criarRuntime(programa, this.opcoesRuntime);
      this.runtime = runtime;
      // §28 — a barreira é o que dá pausa de verdade. `ativarDepuracao` só a
      // instala se o modo depuração estiver ligado, para que uma execução normal
      // pague um `if` por statement e nada mais.
      if (o.depurar !== false) runtime.ativarDepuracao();
      // §40 — apertar Debug mostra o estado ANTES do primeiro statement, em vez
      // de deixar o programa correr até o fim quando não há breakpoint marcado.
      // `pausarNoInicio: false` é para quem quer depuração silenciosa (perfil,
      // temporizador) sem a parada inicial.
      if (o.depurar !== false && o.pausarNoInicio !== false) runtime.modoPasso = "inicio";
      this.aplicarBreakpoints(runtime);
      // O callback vem de `opcoesRuntime`, e não de `o`: `o` são as opções
      // DESTA execução (`depurar`, `pausarNoInicio`), e nele nunca está o
      // `aoVariavel` do constructor. Buscar em `o` fazia o §28.7 nunca emitir.
      if (typeof runtime.onVariableChanged === "function" && typeof this.opcoesRuntime.aoVariavel === "function") {
        runtime.onVariableChanged((e) => {
          self_emitir(this, e);
          if (typeof this.opcoesRuntime.aoVariavel === "function") this.opcoesRuntime.aoVariavel(e);
        });
      }
      this.estado = ESTADO.RUNNING;
      this.emitirEstado();

      const self = this;
      this.promessa = runtime.executar().then(function (r) {
        self.encerrada = true;
        // O runtime é nullado porque terminou, mas o PERFIL e a call stack do
        // último instante continuam sendo informação útil: é o que o painel
        // mostra quando o programa acaba. `ultimoRuntime` é só leitura.
        self.ultimoRuntime = self.runtime;
        self.runtime = null;
        if (r && r.ok) {
          self.estado = ESTADO.FINISHED;
        } else if (r && r.interrompido) {
          self.estado = ESTADO.STOPPED;
        } else {
          self.estado = ESTADO.ERROR;
          if (!self.erro && r && r.erro) self.erro = r.erro;
          self.emitir("erro", self.erro);
        }
        self.emitirEstado();
        return r;
      });
      return this.promessa;
    }

    // ---------------------------------------------- §28.2 / §28.3 / §28.4

    /** §28.3 — continua de `paused`. */
    resume() {
      if (this.encerrada || !this.runtime) return false;
      return this.runtime.resume();
    }

    /**
     * §28.2 — um statement observável.
     *
     * §40 — depois de `error`, `step()` não continua nada. Sem esta guarda, um
     * painel que insistisse em "passar" o botão revivingiria um programa morto.
     */
    step(modo) {
      if (this.encerrada || !this.runtime) return false;
      if (this.estado === ESTADO.ERROR) return false;
      return this.runtime.step(modo);
    }

    /** §28.4 — para. Preserva código e breakpoints (§28.4). */
    stop() {
      if (this.encerrada) return false;
      if (this.entradaPendente) {
        const p = this.entradaPendente;
        this.entradaPendente = null;
        p.reject(new Error("parado"));
      }
      if (!this.runtime) return false;
      this.encerrada = true;
      this.estado = ESTADO.STOPPED;
      const r = this.runtime.stop();
      this.emitirEstado();
      return r;
    }

    // --------------------------------------------------------- §28.5 a §28.9

    /**
     * Os breakpoints vivem na SESSÃO, não no runtime.
     *
     * Eles são preferência do usuário, e o runtime é descartado a cada execução.
     * Guardá-los só no runtime fazia `addBreakpoint()` antes de executar ser
     * perdido — o programa rodava inteiro sem nunca pausar, que é o sintoma de
     * "marquei o breakpoint e nada acontece".
     */
    aplicarBreakpoints(rt) {
      for (const l of this.breakpoints) {
        rt.addBreakpoint(l);
        const cond = this.condicionais.get(l);
        if (cond) rt.setBreakpointCondicional(l, cond);
      }
    }

    addBreakpoint(linha) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      this.breakpoints.add(n);
      if (this.runtime) this.runtime.addBreakpoint(n);
      return true;
    }
    removeBreakpoint(linha) {
      const n = Number(linha);
      const ok = this.breakpoints.delete(n);
      this.condicionais.delete(n);
      if (this.runtime) this.runtime.removeBreakpoint(n);
      return ok;
    }
    toggleBreakpoint(linha) {
      const n = Number(linha);
      if (this.breakpoints.has(n)) return this.removeBreakpoint(n);
      return this.addBreakpoint(n);
    }
    clearBreakpoints() {
      this.breakpoints.clear();
      this.condicionais.clear();
      if (this.runtime) this.runtime.clearBreakpoints();
    }
    getBreakpoints() {
      return Array.from(this.breakpoints).sort((a, b) => a - b);
    }
    setBreakpointCondicional(linha, expressao) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      const expr = String(expressao || "").trim();
      if (!expr) this.condicionais.delete(n);
      else {
        this.condicionais.set(n, expr);
        this.breakpoints.add(n);
      }
      if (this.runtime) return this.runtime.setBreakpointCondicional(n, expr);
      return true;
    }
    getBreakpointCondicional(linha) {
      const v = this.condicionais.get(Number(linha));
      if (v !== undefined) return v;
      return this.runtime ? this.runtime.getBreakpointCondicional(linha) : null;
    }
    /** §11C — Run to Cursor. */
    stepAte(linha) {
      if (!this.runtime) return false;
      return this.runtime.stepAte(linha);
    }
    getVariables(profundidade) {
      const rt = this.runtime || this.ultimoRuntime;
      return rt ? rt.getVariables(profundidade) : { globais: [], quadros: [], foco: 0 };
    }
    getCallStack() {
      const rt = this.runtime || this.ultimoRuntime;
      return rt ? rt.getCallStack() : [];
    }
    getProfile(ordem) {
      const rt = this.runtime || this.ultimoRuntime;
      return rt ? rt.getProfile(ordem) : [];
    }
    getExecutionPoint() {
      const rt = this.runtime || this.ultimoRuntime;
      return rt ? rt.executionPoint : this.ultimoPonto;
    }
    pause() {
      if (!this.runtime) return false;
      return this.runtime.pausarNoProximo === undefined ? false : (this.runtime.pausarNoProximo = true);
    }
  }

  function self_emitir(sessao, e) {
    for (const cb of sessao.ouvintes.variavel || []) {
      try {
        cb(e);
      } catch (erro) {
        // painel quebrado
      }
    }
  }

  /** §59 — cria a sessão já analisada. */
  function criarSessao(codigo, opcoes) {
    return new Sessao(codigo, opcoes);
  }

  VG.Api = {
    ErroDeUso: ErroDeUso,
    analisar: analisar,
    parse: analisar,
    createRuntime: criarRuntime,
    criarRuntime: criarRuntime,
    criarSessao: criarSessao,
    criarExecucao: criarSessao,
    executar: executar,
    run: executar,
    Sessao: Sessao,
    ESTADO: ESTADO,
  };
})(W.VG);
