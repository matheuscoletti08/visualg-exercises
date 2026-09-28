// §52 — CLIENTE DE WEB WORKER (com a decisão D1 do backlog manda por cima).
//
// A §52 pede: executar o interpretador dentro de um Web Worker, para que
// `enquanto verdadeiro faca fimEnquanto` não congele a aba. O problema é que
// ESTE projeto abre `index.html` por `file://`, e aí worker não existe:
//
//   Chrome:  SecurityError: Failed to construct 'Worker': Script at
//            'file:///...' cannot be accessed from origin 'null'.
//   Firefox: idem, com a mesma origem nula.
//
// A D1 do `backlog.md` é "preservar `file://`" — e as duas saídas possíveis
// dessa escolha (tirar o worker, ou exigir servidor) foram rejeitadas: a
// primeira joga fora a §52, a segunda quebra a premissa do projeto inteiro. O
// que sobra é a terceira, e é a que está aqui:
//
//   O WORKER É TENTADO, NUNCA EXIGIDO. Se o protocolo permitir e o construtor
//   existir, o cliente cria o worker. Se qualquer coisa der errado — protocolo
//   `file:`, `Worker` inexistente, construtor lançando, CSP, worker morrendo no
//   meio da execução — o programa roda no runtime principal pelo executor
//   cooperativo da engine, que já cede o event loop e já tem `maxPassos` e
//   `maxExecutionTime` (§53).
//
// A consequência de projeto é uma regra dura: o caminho PRINCIPAL nunca pode
// depender do caminho WORKER. Nada aqui importa o worker, nada aqui o cria por
// padrão, e `criar()` devolve um cliente executável nos dois casos. O cliente é
// criado uma vez e o modo só é reavaliado por `reiniciar()`, porque o caminho de
// execução não muda no meio de uma execução.
//
// SOBRE O EVENT LOOP: o fallback não é "executa de vez". Ele usa
// `Vg.criarExecucao` — a Sessao do §17 (§40), que checa `deveParar()` a cada comando e cede o
// event loop entre comandos. Um laço infinito no fallback é cortado por
// `maxPassos`/`maxExecutionTime` e devolve `{ ok: false, interrompido: true }`
// — a UI volta, o editor continua, e o aluno não perdeu o código. É o que a §52
// queria, e a §53 é quem garante.
//
// SOBRE O WORKER EM SI: ele NÃO é deste arquivo (é `src/visualg/worker.js`, outra
// onda). Este lado é só o cliente: detecção, criação, protocolo de mensagens e
// a política de queda. Por isso o protocolo é declarado aqui como constante e o
// cliente fala dele por nome — se o outro lado mudar, a constante muda junto e o
// teste de contrato continua valendo.
//
// MOCKÁVEL DE PROPÓSITO: `WorkerCtor`, `criarWorker`, `protocolo`, `Vg` e os
// ganchos são todos injetáveis, e os handlers são instalados em
// `onmessage`/`onerror`/`onmessageerror` (propriedades, não `addEventListener`),
// porque um mock de três linhas basta para testar construtor-que-lança,
// worker-que-morre e protocolo-`file:` sem browser nenhum.
//
// NENHUM `fetch` — quebraria `file://`. Nenhum `eval`. Nenhum módulo ES. Nenhum
// DOM: quem chama decide o que fazer com a saída.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  /**
   * Comandos que o cliente MANDA. A §52 fixa o conjunto; as grafias são as do
   * `task.md` (maiúsculas) e o cliente aceita minúsculas na entrada, porque um
   * `{tipo:"run"}` num mock é erro de mock, não erro de protocolo.
   */
  const COMANDOS = {
    RUN: "RUN",
    PAUSE: "PAUSE",
    RESUME: "RESUME",
    STEP: "STEP",
    STOP: "STOP",
    INPUT: "INPUT",
    SET_BREAKPOINT: "SET_BREAKPOINT",
  };

  /** Eventos que o worker MANDA de volta. */
  const EVENTOS = {
    OUTPUT: "OUTPUT",
    INPUT_REQUEST: "INPUT_REQUEST",
    STATE_UPDATE: "STATE_UPDATE",
    BREAKPOINT: "BREAKPOINT",
    ERROR: "ERROR",
    FINISHED: "FINISHED",
  };

  /** Protocolo que não permite worker. Origem nula, e é o caso padrão do projeto. */
  const PROTOCOLO_SEM_WORKER = "file:";

  // ------------------------------------------------------------------ detecção

  /**
   * Protocolo atual, injetável. `W.location` é lido dentro de `try` porque em
   * alguns contextos (worker, `about:blank`, Node) ele não existe ou lança.
   */
  function protocoloDe(o) {
    if (o && typeof o.protocolo === "string") return o.protocolo;
    try {
      const loc = W.location;
      if (loc && typeof loc.protocol === "string") return loc.protocol;
    } catch (e) {
      /* sem location: cai no "" abaixo */
    }
    return "";
  }

  /**
   * Construtor de Worker, injetável. Devolve `null` (e não lança) quando não há
   * suporte; a checagem é `typeof === "function"`, que é a superfície que o
   * browser publica.
   */
  function ctorDe(o) {
    if (o && Object.prototype.hasOwnProperty.call(o, "WorkerCtor")) return o.WorkerCtor || null;
    try {
      return typeof W.Worker === "function" ? W.Worker : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * A worker pode ser usada aqui? Devolve `{ ok, motivo }` — o motivo é o texto
   * que o painel de status mostra, e ele existe para o `file://` deixar de ser um
   * mistério: o aluno vê "executando na aba (Web Worker indisponível em file://)".
   *
   * A ordem das checagens é CONTRATO, não estética: o protocolo é testado
   * ANTES de qualquer tentativa de criar worker. Construir um worker sob
   * `file://` lança `SecurityError`, e um cliente que "tenta e cai" gastaria uma
   * exceção por execução para descobrir o que já sabia pela query string.
   */
  function suporta(opcoes) {
    const o = opcoes || {};
    const protocolo = protocoloDe(o);
    if (protocolo === PROTOCOLO_SEM_WORKER) {
      return {
        ok: false,
        protocolo: protocolo,
        motivo:
          "arquivo aberto direto do disco (file:): o navegador recusa Web Worker com SecurityError, " +
          "porque a origem é 'null'. A execução roda na aba.",
      };
    }
    if (o && o.workerUrl != null && typeof o.workerUrl !== "string") {
      return { ok: false, protocolo: protocolo, motivo: "workerUrl deveria ser o caminho de um script" };
    }
    if (typeof o.criarWorker === "function") {
      // Fábrica injetada: quem fornece a fábrica tem o construtor, mesmo que o
      // runtime onde o cliente roda não o exponha (Node, teste, worker aninhado).
      return { ok: true, protocolo: protocolo, motivo: "" };
    }
    if (!ctorDe(o)) {
      return { ok: false, protocolo: protocolo, motivo: "este ambiente não tem Web Worker" };
    }
    return { ok: true, protocolo: protocolo, motivo: "" };
  }

  // ----------------------------------------------------------------- o cliente

  /**
   * Cria o cliente. NUNCA devolve `null` e NUNCA lança.
   *
   * O objeto devolvido é executável nos dois modos, e `modo` diz em qual deles a
   * PRÓXIMA execução vai rodar:
   *
   *   "worker"    — o worker foi criado com sucesso e está vivo;
   *   "principal" — execução no runtime principal (o caminho de `file://`).
   *
   * `opcoes`:
   *   WorkerCtor  — construtor injetável; `null` força o modo principal.
   *   protocolo   — string injetável; padrão `location.protocol`.
   *   workerUrl   — caminho do script do worker; sem ele, o modo worker exige
   *                 `criarWorker`, porque não há URL para inventar (e inventar
   *                 uma seria adivinhar onde a outra onda vai escrever).
   *   criarWorker — fábrica alternativa: `() => worker`. Tem precedência sobre
   *                 `workerUrl`, e é o gancho de teste mais direto.
   *   Vg          — engine injetável; padrão `W.Vg`.
   *   maxPassos, maxExecutionTime, maxPassosWorker — repassados ao caminho que
   *                 aceitar (§53).
   *
   * Métodos: `executar(codigo, ganchos)`, `parar()`, `pausar()`, `retomar()`,
   * `passo()`, `entrada(valor)`, `breakpoints(lista)`, `reiniciar()`, `estado()`.
   */
  function criar(opcoes) {
    const o = opcoes || {};

    let worker = null;
    let geracao = 0; // invalida os callbacks de um worker já morto
    let controle = null; // Execucao da §40, só no caminho principal
    let corrida = null; // { resolve, ganchos } da execução em curso, ou null
    let encerrada = false; // o `await` de quem chamou já recebeu resposta

    const cliente = {
      modo: "principal",
      disponivel: false,
      motivo: "",
      protocolo: protocoloDe(o),
      estado: estado,
      get worker() {
        return worker;
      },
      get executando() {
        return corrida !== null;
      },
    };

    // ------------------------------------------------------------------ decisão

    /**
     * Decide o modo e, se der, cria o worker. Chamada na construção do cliente e
     * em `reiniciar()` — nunca no meio de uma execução, porque trocar o caminho
     * com um programa no ar significaria resolver a mesma promessa duas vezes.
     *
     * `suporta(o)` é RECONSULTADO, e não guardado: é o que faz `reiniciar()`
     * reavaliar de verdade, em vez de repetir a decisão que já tinha sido tomada
     * (o caso "o aluno abriu o playground por HTTP agora" muda o protocolo, e o
     * módulo não pode carregar um veredito velho para sempre).
     */
    function decidir() {
      const apoio = suporta(o);
      cliente.protocolo = apoio.protocolo;
      cliente.modo = "principal";
      cliente.disponivel = false;
      if (!apoio.ok) {
        cliente.motivo = apoio.motivo;
        return false;
      }
      let criado;
      try {
        criado = criarWorker();
      } catch (e) {
        cliente.motivo = "não consegui criar o Web Worker (" + nomeDeErro(e) + "); a execução roda na aba";
        return false;
      }
      if (!criado) {
        cliente.motivo = "o Web Worker não foi criado; a execução roda na aba";
        return false;
      }
      worker = criado;
      cliente.modo = "worker";
      cliente.disponivel = true;
      cliente.motivo = "";
      instalarHandlers(criado);
      return true;
    }

    /** Constrói o worker. Só é chamado depois de `suporta()` dizer que dá. */
    function criarWorker() {
      if (typeof o.criarWorker === "function") return o.criarWorker();
      if (typeof o.workerUrl === "string" && o.workerUrl) return new (ctorDe(o))(o.workerUrl);
      throw new Error("nenhuma forma de criar o worker: informe `workerUrl` ou `criarWorker`");
    }

    /**
     * Handlers por PROPRIEDADE (`onmessage`), não por `addEventListener`. Nos
     * dois runtimes reais as duas formas funcionam; a propriedade é a que um mock
     * implementa em três linhas, e é o que permite testar queda e morte sem
     * browser. Cada callback confere a `geracao`, para a resposta de um worker já
     * morto não resolver a execução que o substituiu.
     */
    function instalarHandlers(w) {
      const minha = ++geracao;
      w.onmessage = function (ev) {
        if (minha !== geracao) return;
        tratarMensagem(ev && ev.data !== undefined ? ev.data : ev);
      };
      w.onerror = function (ev) {
        if (minha !== geracao) return;
        morrer("o Web Worker parou com erro" + (ev && ev.message ? " (" + ev.message + ")" : ""));
      };
      w.onmessageerror = function () {
        if (minha !== geracao) return;
        morrer("o Web Worker mandou mensagem ilegível");
      };
    }

    // ------------------------------------------------------------ caminho worker

    /** Roteia um evento do worker. `tipo` em maiúsculas, como a §52 escreve. */
    function tratarMensagem(dados) {
      if (!dados || typeof dados !== "object") return;
      const tipo = String(dados.tipo || dados.type || "").toUpperCase();
      switch (tipo) {
        case EVENTOS.OUTPUT:
          if (corrida && typeof corrida.ganchos.saida === "function") {
            corrida.ganchos.saida(dados.texto !== undefined ? dados.texto : dados.text);
          }
          break;
        case EVENTOS.INPUT_REQUEST:
          atenderEntrada(dados);
          break;
        case EVENTOS.STATE_UPDATE:
          if (corrida && typeof corrida.ganchos.estado === "function") corrida.ganchos.estado(dados.estado);
          break;
        case EVENTOS.BREAKPOINT:
          if (corrida && typeof corrida.ganchos.breakpoint === "function") {
            corrida.ganchos.breakpoint(dados.linha !== undefined ? dados.linha : null, dados.ativa !== false);
          }
          break;
        case EVENTOS.ERROR:
          terminar({
            ok: false,
            interrompido: dados.interrompido === true,
            erro: erroNormalizado(dados.erro || dados),
            modo: "worker",
          });
          break;
        case EVENTOS.FINISHED:
          terminar({
            ok: dados.ok !== false,
            interrompido: dados.interrompido === true,
            erro: dados.ok === false ? erroNormalizado(dados.erro) : null,
            resultado: dados.resultado === undefined ? null : dados.resultado,
            modo: "worker",
          });
          break;
        default:
          // Evento desconhecido é ignorado de propósito: a §52 lista sete, e
          // travar a execução por um evento novo seria pior que perdê-lo.
          break;
      }
    }

    /**
     * O worker pediu entrada. O gancho pode devolver string ou Promise (é o que a
     * engine espera: `leia` é assíncrono). Cancelamento responde com
     * `cancelado: true` e encerra como interrompido, que é o Parar do usuário.
     */
    function atenderEntrada(dados) {
      if (!corrida) return;
      const id = dados.id !== undefined ? dados.id : null;
      const prompt = dados.prompt !== undefined ? dados.prompt : dados.texto;
      const g = corrida.ganchos;
      Promise.resolve()
        .then(() => (typeof g.entrada === "function" ? g.entrada(prompt, id) : ""))
        .then(
          (valor) => {
            mandar({ tipo: COMANDOS.INPUT, id: id, valor: valor === undefined || valor === null ? "" : String(valor) });
          },
          () => {
            mandar({ tipo: COMANDOS.INPUT, id: id, valor: "", cancelado: true });
            terminar({ ok: false, interrompido: true, erro: null, modo: "worker" });
          }
        );
    }

    /** Envia um comando. `postMessage` que lança também derruba para a aba. */
    function mandar(mensagem) {
      if (!worker) return false;
      try {
        worker.postMessage(mensagem);
        return true;
      } catch (e) {
        morrer("não consegui falar com o Web Worker (" + nomeDeErro(e) + ")");
        return false;
      }
    }

    // ---------------------------------------------------------- caminho principal

    /**
     * O executor cooperativo: `Vg.criarExecucao` — a Sessao do §17 (§40), que cede o event loop a
     * cada comando e respeita `pausar`/`parar`/`passo`. É o caminho que roda em
     * `file://`, então é o caminho que precisa ser bom — não é um plano B.
     */
    function executarNaAba(codigo, ganchos) {
      const Vg = o.Vg || W.Vg;
      if (!Vg || typeof Vg.criarExecucao !== "function") {
        return Promise.resolve({
          ok: false,
          modo: "principal",
          erro: {
            mensagem: "a engine (W.Vg) não está carregada: sem executor cooperativo",
            linha: null,
            codigo: "SEM_ENGINE",
            tipo: "Error",
          },
        });
      }
      let promessa;
      try {
        controle = Vg.criarExecucao(codigo, {
          saida: (t) => {
            if (typeof ganchos.saida === "function") ganchos.saida(t);
          },
          entrada: (p) => {
            if (typeof ganchos.entrada === "function") return ganchos.entrada(p);
            return Promise.resolve("");
          },
          onEstado: (e, i) => {
            if (typeof ganchos.estado === "function") ganchos.estado(e, i);
          },
          aoLinha: (l, n) => {
            if (typeof ganchos.linha === "function") ganchos.linha(l, n);
          },
          // §53: os limites vêm da criação do cliente, e um `executar` pode
          // sobrescrevê-los — "rodar este exercício com passo a passo" e "rodar o
          // programa da demonstração sem teto" são o mesmo cliente.
          maxPassos: typeof ganchos.maxPassos === "number" ? ganchos.maxPassos : typeof o.maxPassos === "number" ? o.maxPassos : undefined,
          maxExecutionTime:
            typeof ganchos.maxExecutionTime === "number" ? ganchos.maxExecutionTime : typeof o.maxExecutionTime === "number" ? o.maxExecutionTime : undefined,
        });
        // `pausarNoInicio: false` — o caminho principal NÃO deve pausar no
        // primeiro statement. Sem debugger UI aqui, essa parada seria um
        // travamento silencioso: o programa pararia e nada responderia.
        promessa = controle.executar({ depurar: false, pausarNoInicio: false });
      } catch (e) {
        // `criarExecucao` chama `analisar`, que LANÇA em erro de sintaxe. Um
        // programa com `escreva(` sem fechar é erro do aluno, não exceção
        // solta no console.
        return Promise.resolve({ ok: false, modo: "principal", erro: erroNormalizado(e) });
      }
      return promessa.then((r) => {
        controle = null;
        return { ok: r.ok, interrompido: r.interrompido === true, erro: r.erro || null, modo: "principal" };
      });
    }

    // ------------------------------------------------------------- transições

    /** Resolve a promessa de `executar` uma única vez, e avisa o gancho. */
    function terminar(resultado) {
      if (!corrida || encerrada) return;
      encerrada = true;
      const atual = corrida;
      corrida = null;
      if (typeof atual.ganchos.retomar === "function") atual.ganchos.retomar(resultado);
      atual.resolve(resultado);
    }

    /**
     * O worker morreu com o programa no ar.
     *
     * A queda NÃO abandona a execução: o programa é reexecutado no runtime
     * principal e é o resultado dela que chega ao `await` de quem chamou. Isso é
     * seguro porque o programa do aluno é determinístico e o único efeito externo
     * é a saída — a alternativa (devolver erro e parar) jogaria fora a execução
     * inteira por causa de uma falha de infraestrutura, que é a pior das duas.
     * A saída parcial que o worker já mandou é problema da UI: quem integra limpa
     * o terminal no início de cada `executar`.
     */
    function morrer(motivo) {
      descartarWorker();
      cliente.modo = "principal";
      cliente.disponivel = false;
      cliente.motivo = motivo + "; a execução foi retomada na aba";
      if (!corrida || encerrada) return;
      const atual = corrida;
      corrida = null;
      const codigo = atual.codigo;
      executarNaAba(codigo, atual.ganchos).then(
        (r) => {
          encerrada = false;
          r.retomadoNaAba = true;
          r.motivoQueda = motivo;
          if (typeof atual.ganchos.retomar === "function") atual.ganchos.retomar(r);
          atual.resolve(r);
        },
        (e) => {
          encerrada = false;
          const r = { ok: false, modo: "principal", retomadoNaAba: true, motivoQueda: motivo, erro: erroNormalizado(e) };
          if (typeof atual.ganchos.retomar === "function") atual.ganchos.retomar(r);
          atual.resolve(r);
        }
      );
    }

    /** Termina o worker e invalida os callbacks dele. Nunca lança. */
    function descartarWorker() {
      if (worker) {
        try {
          worker.terminate();
        } catch (e) {
          /* já morreu: `terminate()` em worker morto não lança em browser nenhum */
        }
      }
      worker = null;
      geracao++;
    }

    /**
     * Executa o programa. Devolve SEMPRE uma promessa, e no caminho worker essa
     * promessa só é resolvida por `FINISHED`/`ERROR` ou por uma queda.
     */
    function executar(codigo, ganchos) {
      const g = ganchos || {};
      const fonte = typeof codigo === "string" ? codigo : "";
      if (corrida) {
        return Promise.resolve({
          ok: false,
          interrompido: true,
          modo: cliente.modo,
          erro: { mensagem: "já há uma execução em andamento", linha: null, codigo: "OCUPADO", tipo: "Error" },
        });
      }
      if (cliente.modo !== "worker") return executarNaAba(fonte, g);
      let resolve;
      const promessa = new Promise(function (r) {
        resolve = r;
      });
      encerrada = false;
      corrida = { codigo: fonte, ganchos: g, resolve: resolve };
      const enviou = mandar({
        tipo: COMANDOS.RUN,
        codigo: fonte,
        maxPassos: typeof g.maxPassos === "number" ? g.maxPassos : typeof o.maxPassosWorker === "number" ? o.maxPassosWorker : o.maxPassos,
        maxExecutionTime: typeof g.maxExecutionTime === "number" ? g.maxExecutionTime : typeof o.maxExecutionTime === "number" ? o.maxExecutionTime : undefined,
      });
      // `mandar` já chamou `morrer()` se o `postMessage` explodiu, e `morrer` já
      // resolveu a promessa pelo caminho principal. Sem exceção, é esperar. O
      // `corrida === null` cobre o `false` de `mandar` quando o worker já era
      // nulo: nesse caso ninguém resolveu nada e a promessa ficaria pendurada.
      if (!enviou && corrida !== null) {
        terminar({ ok: false, interrompido: true, modo: "principal", retomadoNaAba: true, erro: null });
      }
      return promessa;
    }

    /** Estado legível do cliente, para o painel de status do playground. */
    function estado() {
      return {
        modo: cliente.modo,
        disponivel: cliente.disponivel,
        motivo: cliente.motivo,
        protocolo: cliente.protocolo,
        executando: corrida !== null,
        temControle: controle !== null,
      };
    }

    // ------------------------------------------------------------- comandos UI

    function parar() {
      if (cliente.modo === "worker" && worker) return mandar({ tipo: COMANDOS.STOP });
      if (controle) controle.stop();
      return false;
    }

    function pausar() {
      if (cliente.modo === "worker" && worker) return mandar({ tipo: COMANDOS.PAUSE });
      if (controle) controle.step("sobre");
      return false;
    }

    function retomar() {
      if (cliente.modo === "worker" && worker) return mandar({ tipo: COMANDOS.RESUME });
      if (controle) controle.resume();
      return false;
    }

    function passo() {
      if (cliente.modo === "worker" && worker) return mandar({ tipo: COMANDOS.STEP });
      if (controle) controle.step("sobre");
      return false;
    }

    function entrada(valor) {
      if (cliente.modo === "worker" && worker) return mandar({ tipo: COMANDOS.INPUT, valor: valor });
      return false;
    }

    function breakpoints(lista) {
      if (cliente.modo === "worker" && worker) {
        return mandar({ tipo: COMANDOS.SET_BREAKPOINT, linhas: Array.isArray(lista) ? lista : [] });
      }
      return false;
    }

    /**
     * Reavalia o suporte e, se der, cria o worker de novo. É o que a UI chama
     * quando o aluno abre o playground por HTTP depois de tê-lo aberto por
     * `file://` — ou o contrário.
     */
    function reiniciar() {
      descartarWorker();
      controle = null;
      return decidir();
    }

    decidir();

    cliente.executar = executar;
    cliente.parar = parar;
    cliente.pausar = pausar;
    cliente.retomar = retomar;
    cliente.passo = passo;
    cliente.entrada = entrada;
    cliente.breakpoints = breakpoints;
    cliente.reiniciar = reiniciar;
    return cliente;
  }

  /** Nome da exceção, para mensagem de queda que não grita `undefined`. */
  function nomeDeErro(e) {
    if (!e) return "erro desconhecido";
    if (e.name && e.name !== "Error") return e.name;
    return String(e && e.message ? e.message : e);
  }

  /**
   * Traduz a exceção de execução no MESMO formato que a §46 usa
   * (`{ mensagem, linha, coluna, codigo, tipo }`), para que o painel de erro do
   * playground não tenha dois formatos de erro dependendo do caminho de execução.
   *
   * `Vg.Diagnostics.serializar` é consultado por chamada (e não capturado no
   * carregamento) porque a ordem de carga é contrato; sem engine carregada, o
   * formato manual cobre o caso com a mesma frase.
   */
  function erroNormalizado(erro) {
    if (!erro) return { mensagem: "erro desconhecido", linha: null, coluna: null, codigo: "DESCONHECIDO", tipo: "Error" };
    if (typeof erro === "string") {
      return { mensagem: erro, linha: null, coluna: null, codigo: "DESCONHECIDO", tipo: "Error" };
    }
    if (typeof erro === "object" && typeof erro.mensagem === "string" && erro.linha !== undefined && "codigo" in erro) {
      return erro; // já está no formato da §46
    }
    const D = W.Vg && W.VG && W.VG.Diagnostics;
    if (D && typeof D.serializar === "function") {
      try {
        return D.serializar(erro);
      } catch (e) {
        /* cai no formato manual abaixo */
      }
    }
    return {
      mensagem: erro.mensagem || erro.message || String(erro),
      linha: erro.linha !== undefined ? erro.linha : null,
      coluna: erro.coluna !== undefined ? erro.coluna : null,
      codigo: erro.codigo || "DESCONHECIDO",
      tipo: erro.name || "Error",
    };
  }

  /**
   * Atalho para o caminho principal declarado: `criar({ usarPrincipal: true })`
   * na API vira `criarPrincipal()` aqui. Existe para o chamador dizer a
   * intenção em vez de omitir um campo, e para os testes pedirem o caminho de
   * `file://` sem montar objeto de protocolo.
   */
  function criarPrincipal(opcoes) {
    return criar(Object.assign({}, opcoes || {}, { WorkerCtor: null }));
  }

  GP.WorkerClient = {
    COMANDOS: COMANDOS,
    EVENTOS: EVENTOS,
    PROTOCOLO_SEM_WORKER: PROTOCOLO_SEM_WORKER,
    suporta: suporta,
    criar: criar,
    criarPrincipal: criarPrincipal,
  };
})(W.VGPlay);
