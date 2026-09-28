// §17 (estados) e §53 (orçamentos) — o scheduler.
//
// O executor é cooperativo, não preemptivo: ele cede o event loop a cada bloco
// de passos. É o que permite o Playground travar um programa infinito sem
// congelar a aba, e é o mesmo mecanismo que o runtime antigo usava (ceder a cada
// 50000 passos). A diferença aqui é que o orçamento de tempo é de RELÓGIO DE
// PAREDE, e não só de contagem de passos: um laço que só faz I/O pode passar
// muito tempo sem gastar passos.
//
// Decisão D1 do backlog: isto é o caminho principal, inclusive sob `file://`,
// onde Web Worker não existe. O worker da §52 é um caminho opcional por cima.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;

  /**
   * §17 — estados da execução.
   *
   * Os nomes são os do `backlog-debugger.md` §17, e não os da primeira versão
   * deste arquivo. `stepping` é novo e é o que distingue "pausado esperando o
   * debugger" de "executando um único statement": os dois estão parados, mas só
   * um vai continuar sozinho, e a UI precisa distinguir para não oferecer
   * "Continuar" onde só cabe "Passo".
   */
  const ESTADO = {
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
    STEPPING: "stepping",
    WAITING_INPUT: "waiting_input",
    STOPPED: "stopped",
    FINISHED: "finished",
    ERROR: "error",
  };

  /**
   * Alias dos nomes antigos, para não quebrar consumidor existente.
   *
   * `parado` virou `stopped` e `executando` virou `running`: os valores antigos
   * não descreviam o que acontecia. `concluido` e `erro` mudaram só de grafia
   * para o inglês do resto da tabela.
   */
  const ESTADO_LEGADO = {
    PARADO: "stopped",
    EXECUTANDO: "running",
    PAUSADO: "paused",
    AGUARDANDO_ENTRADA: "waiting_input",
    CONCLUIDO: "finished",
    ERRO: "error",
  };

  const PASSO_ENTREGA = 50000; // comandos entre duas entregas ao event loop
  const INTERVALO_TEMPO_MS = 250; // de quanto em quanto tempo o relógio é conferido

  /**
   * §53 — orçamento de PAREDE, e a decisão é NÃO ter padrão.
   *
   * Havia um padrão de 10 s que derrubava qualquer programa mais longo com
   * "Tempo de execução excedido", mesmo que estivesse fazendo tudo certo — e o pior
   * é que o corte chegava junto com o breakpoint, o passo e o perfil, que são
   * justamente as coisas que levam TEMPO. Quem depura um laço de 300 mil voltas
   * ou um algoritmo de ordenação lento tem o clock de parede como inimigo, não
   * como aliado: um limite fixo não distingue "programa lento" de "trava", e
   *.programa lento é o caso legítimo.
   *
   * A trava que sobra é `maxPassos`, que é o certo: ela conta trabalho, e um
   * loop infinito é trabalho infinito de qualquer jeito. O relógio de parede
   * mede a máquina de quem roda, não o programa, e por isso não é um critério
   * para matar uma execução.
   *
   * Para quem QUER o teto (worker, CI, servidor), basta passar
   * `maxExecutionTime` em milissegundos. `0`, `null` e `undefined` significam
   * "sem teto", para que desligar seja o caso explícito em vez do implícito.
   */
  const SEM_TETO = 0;
  function tetoPadrao(o) {
    const v = o.maxExecutionTime;
    if (v === null || v === undefined) return SEM_TETO;
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return SEM_TETO;
    return v;
  }
  function semTeto(teto) {
    return teto === SEM_TETO;
  }

  class Scheduler {
    constructor(opcoes) {
      const o = opcoes || {};
      this.estado = ESTADO.IDLE;
      this.passos = 0;
      this.maxPassos = typeof o.maxPassos === "number" ? o.maxPassos : 2000000;
      this.maxExecutionTime = tetoPadrao(o);
      this.inicio = 0;
      this.ultimoChecagem = 0;
      this.onEstado = typeof o.onEstado === "function" ? o.onEstado : null;
      this.linhaAtual = null;
    }

    iniciar() {
      this.estado = ESTADO.RUNNING;
      this.inicio = agora();
      this.ultimoChecagem = this.inicio;
      this.passos = 0;
      this.emitirEstado();
    }

    emitirEstado() {
      if (this.onEstado) {
        this.onEstado(this.estado, { passos: this.passos, linha: this.linhaAtual });
      }
    }

    mudarPara(estado) {
      if (this.estado === estado) return;
      this.estado = estado;
      this.emitirEstado();
    }

    /**
     * Conta um comando e aplica os dois orçamentos.
     *
     * O `>=` no maxPassos é intencional e vem do runtime antigo: os testes
     * dependem do corte exatamente no limite. Trocar para `>` atrasaria o corte
     * em um passo e mudaria a linha reportada.
     */
    async checar(linha) {
      this.linhaAtual = linha;
      this.passos++;
      if (this.passos >= this.maxPassos) {
        this.mudarPara(ESTADO.ERROR);
        throw Diagnostics.criar(
          "TEMPO_LIMITE_PASSOS",
          "Possível loop infinito: execução interrompida após " + this.passos + " comandos",
          { linha: linha }
        );
      }
      const t = agora();
      if (!semTeto(this.maxExecutionTime) && t - this.ultimoChecagem >= INTERVALO_TEMPO_MS) {
        this.ultimoChecagem = t;
        if (t - this.inicio > this.maxExecutionTime) {
          this.mudarPara(ESTADO.ERROR);
          throw Diagnostics.criar(
            "TEMPO_LIMITE_PAREDE",
            "Tempo de execução excedido (" + this.maxExecutionTime + "ms)",
            { linha: linha }
          );
        }
      }
      if (this.passos % PASSO_ENTREGA === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    /** Verificação barata, para laços que rodam muito. */
    checarTempo(linha) {
      // Sem teto, não há o que conferir: sair antes de `agora()` também evita o
      // custo de ler o relógio a cada statement de laço quente.
      if (semTeto(this.maxExecutionTime)) return;
      const t = agora();
      if (t - this.ultimoChecagem < INTERVALO_TEMPO_MS) return;
      this.ultimoChecagem = t;
      if (t - this.inicio > this.maxExecutionTime) {
        this.mudarPara(ESTADO.ERROR);
        throw Diagnostics.criar(
          "TEMPO_LIMITE_PAREDE",
          "Tempo de execução excedido (" + this.maxExecutionTime + "ms)",
          { linha: linha }
        );
      }
    }
  }

  function agora() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  /**
   * §26 — `retorne` e §22 — `interrompa` como sinalização interna.
   *
   * São exceções internas capturadas pelo runtime e nunca vazam para o
   * chamador: o `api.js` converte qualquer uma delas em retorno normal. A §26
   * permite exatamente isso, com a condição de que fiquem encapsuladas.
   */
  class SinalRetorno {
    constructor(valor) {
      this.valor = valor;
    }
  }
  class SinalInterrompa {
    constructor(alvo) {
      this.alvo = alvo || null;
    }
  }

  /** Interrupção vinda de Parar/timeout, distinta de `interrompa`. */
  class SinalParada {
    constructor(motivo) {
      this.motivo = motivo || "parado";
    }
  }

  /**
   * §40 — pausa do debugger. Separada de `SinalParada` de propósito: `SinalParada`
   * DERRUBA a execução (é o Parar), enquanto esta segura um statement e o
   * runtime continua vivo. Confundi-las foi o que obrigou a primeira versão do
   * debugger a rebobinar o programa.
   */
  class SinalPausa {
    constructor(ponto) {
      this.ponto = ponto || null;
    }
  }

  const ehRetorno = (e) => e instanceof SinalRetorno;
  const ehInterrompa = (e) => e instanceof SinalInterrompa;
  const ehParada = (e) => e instanceof SinalParada;
  const ehPausa = (e) => e instanceof SinalPausa;

  VG.Scheduler = {
    ESTADO: ESTADO,
    ESTADO_LEGADO: ESTADO_LEGADO,
    Scheduler: Scheduler,
    SinalRetorno: SinalRetorno,
    SinalInterrompa: SinalInterrompa,
    SinalParada: SinalParada,
    SinalPausa: SinalPausa,
    ehRetorno: ehRetorno,
    ehInterrompa: ehInterrompa,
    ehParada: ehParada,
    ehPausa: ehPausa,
  };
})(W.VG);
