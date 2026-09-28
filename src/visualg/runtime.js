// Executor da AST nova (onda 5).
//
// O que NÃO pode mudar, porque os 21 testes unitários afirmam as strings
// exatas de saída e de mensagem de erro:
//
//   · `escreva` com `:N:M` — as casas decimais são aplicadas PRIMEIRO e a
//     largura depois. Inverter produz "3.14  " em vez de "  3.14".
//   · `maxPassos` corta em `>=`, e a mensagem contém "Possível loop infinito".
//   · O prompt de `leia` é "Entre com o valor de <nome>" — o harness de teste
//     extrai o nome com regex a partir desse texto.
//   · Erro de runtime precisa trazer `linha` numérica, sempre.
//
// O que MUDA, de propósito, por exigência do spec:
//
//   · `Verdadeiro`/`Falso` passa a `VERDADEIRO`/`FALSO` (§5).
//   · Comparação de texto passa a ser case-insensitive (§11).
//   · `2.75` atribuído a `inteiro` vira erro, não truncamento (§10 + §46).
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const V = VG.Values;
  const E = VG.Environment;
  const S = VG.Scheduler;
  const Diagnostics = VG.Diagnostics;

  /**
   * A linha (ou célula de vetor) contém uma chamada de função?
   *
   * É o que permite dizer "dentro" de "sobre" sem a AST precisar classificar
   * statements: se a linha não chama nada, descer de profundidade é impossível
   * e "passo dentro" tem que se comportar como "passo sobre".
   */
  function contemChamada(no) {
    if (!no || typeof no !== "object") return false;
    if (no.tipo === "chamada") return true;
    for (const chave of Object.keys(no)) {
      if (chave === "linha" || chave === "coluna" || chave === "statementId") continue;
      if (contemChamada(no[chave])) return true;
    }
    return false;
  }

  /**
   * §28.1 — linha e coluna do FIM de um statement, para o gutter ocupar a
   * extensão real e `sourceEndLine`/`sourceEndColumn` não serem estimativa.
   */
  function limiteDoNoPadrao(no) {
    if (!no || typeof no !== "object") return null;
    let fimLinha = no.linha != null ? no.linha : null;
    let fimColuna = no.coluna != null ? no.coluna : null;
    let achou = false;
    (function anda(x) {
      if (achou || !x || typeof x !== "object") return;
      if (Array.isArray(x)) {
        for (const y of x) anda(y);
        return;
      }
      if (x.linha === null || x.linha === undefined) return;
      if (x.linha > fimLinha || (x.linha === fimLinha && x.coluna > fimColuna)) {
        fimLinha = x.linha;
        fimColuna = x.coluna;
        achou = true;
      }
      for (const chave of Object.keys(x)) {
        if (chave === "linha" || chave === "coluna") continue;
        anda(x[chave]);
      }
    })(no);
    return { linha: fimLinha, coluna: fimColuna };
  }

  class Runtime {
    constructor(programa, opcoes) {
      const o = opcoes || {};
      this.programa = programa;
      this.contexto = new E.Contexto({ limiteRecursao: o.limiteRecursao });
      this.scheduler = new S.Scheduler({
        maxPassos: o.maxPassos,
        maxExecutionTime: o.maxExecutionTime,
        onEstado: o.onEstado,
      });
      this.saida = typeof o.saida === "function" ? o.saida : () => {};
      this.entrada = typeof o.entrada === "function" ? o.entrada : () => Promise.resolve("");
      this.deveParar = typeof o.deveParar === "function" ? o.deveParar : () => false;
      this.registros = o.registros || {}; // builtins (§29, §30) e extensões (§31–§39)
      this.aoLinha = typeof o.aoLinha === "function" ? o.aoLinha : null;
      // §40 — gancho de SUSPENSÃO, chamado no topo de cada comando, antes dele
      // executar. Devolve `undefined` para seguir, ou uma Promise que resolve
      // quando o debugger manda seguir.
      //
      // É a peça que faltava para o debugger não precisar REBOBINAR. Antes o
      // runtime não tinha como ser pausado, então "continuar" refazia o programa
      // do zero: o `leia` pendente morria com a execução anterior e o aluno
      // tinha que digitar tudo de novo. Aqui a execução é uma só, contínua, e
      // pausar é só esperar uma Promise.
      this.barreira = typeof o.barreira === "function" ? o.barreira : null;
      // §40 "stop on error": chamado quando um comando Lança, com a pilha ainda
      // de pé. Sem isto, o `finally` de `chamar` já teria desfeito os frames e o
      // painel de call stack mostraria vazio no momento do erro, que é
      // justamente quando ela mais interessa.
      this.aoErro = typeof o.aoErro === "function" ? o.aoErro : null;

      // ================================================================
      // §28 — superfície de debugger, NO RUNTIME.
      //
      // §28.1: a linha atual nunca é inferida lendo o editor, e §39.3 exige que
      // a call stack do debugger seja a do runtime. Por isso tudo que o debugger
      // precisa mora AQUI, e o `debugger.js` vira só apresentação + política de
      // passo. Nada de segunda call stack, nada de segunda tabela de variáveis.
      //
      // §28.9: o perfil conta por `statementId`, e não por `sourceLine`. Duas
      // linhas diferentes são statements diferentes, e um statement numa linha
      // pode ser o mesmo statement em execuções diferentes — o perfil por linha
      // é uma AGREGAÇÃO, não a identidade.
      this.breakpoints = new Set();
      this.breakpointsCondicionais = new Map(); // linha -> { expressao, fn }
      this.proximoStatementId = 1;
      this.perfil = new Map(); // statementId -> { statementId, linha, contagem }
      this.executionPoint = null;
      this.modoPasso = null; // null | "sobre" | "dentro" | "fora" | "ate"
      this.profundidadePausa = 0;
      this.pausaTemChamada = false;
      this.retomarPausa = null;
      this.pedidoParada = false;
      this.ouvintesVariaveis = [];
      this.ultimosValores = new Map();
      this.limiteElementos = typeof o.limiteElementos === "number" ? o.limiteElementos : 200;
      this.limiteDoNo = typeof o.limiteDoNo === "function" ? o.limiteDoNo : limiteDoNoPadrao;
      this.aoPausa = typeof o.aoPausa === "function" ? o.aoPausa : null;
      this.aoPausarFonte = typeof o.aoPausarFonte === "function" ? o.aoPausarFonte : null;
      this.onStop = typeof o.onStop === "function" ? o.onStop : null;
      this.motivoPausa = null;
      this.linhaAlvo = null;
    }

    // ------------------------------------------------------ §28 ExecutionPoint

    /**
     * §28.1 — o ponto de execução, derivado da AST.
     *
     * `sourceEndLine`/`sourceEndColumn` existem porque o gutter precisa saber o
     * que é "a linha do statement", e um statement que começa na linha 5 e
     * termina na 6 ocupa duas linhas na margem. Chamar `limiteDe` aqui em vez
     * de estimar é o que mantém §39.5 (a posição exibida é a real).
     */
    pontoDe(cmd) {
      if (!cmd) return null;
      const linha = cmd.linha != null ? cmd.linha : null;
      const coluna = cmd.coluna != null ? cmd.coluna : null;
      let fimLinha = linha;
      let fimColuna = coluna;
      if (typeof this.limiteDoNo === "function") {
        const lim = this.limiteDoNo(cmd);
        if (lim) {
          fimLinha = lim.linha;
          fimColuna = lim.coluna;
        }
      }
      return {
        node: cmd,
        tipo: cmd.tipo,
        sourceLine: linha,
        sourceColumn: coluna,
        sourceEndLine: fimLinha,
        sourceEndColumn: fimColuna,
        statementId: cmd.statementId != null ? cmd.statementId : null,
        callFrame: this.contexto.profundidade,
      };
    }

    // --------------------------------------------------------- §28.5 breakpoints

    /** §28.5 — API de breakpoint. A linha é sempre 1-based, como na UI. */
    addBreakpoint(linha) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      this.breakpoints.add(n);
      return true;
    }
    removeBreakpoint(linha) {
      return this.breakpoints.delete(Number(linha));
    }
    toggleBreakpoint(linha) {
      const n = Number(linha);
      if (this.breakpoints.has(n)) {
        this.breakpoints.delete(n);
        this.breakpointsCondicionais.delete(n);
        return false;
      }
      return this.addBreakpoint(n);
    }
    clearBreakpoints() {
      this.breakpoints.clear();
      this.breakpointsCondicionais.clear();
    }
    getBreakpoints() {
      return Array.from(this.breakpoints).sort((a, b) => a - b);
    }

    /**
     * §11C — breakpoint condicional, como extensão do playground (não é
     * recurso nativo do VisuAlg). A condição é avaliada com o evaluator DA
     * ENGINE, nunca com `eval` do JavaScript.
     */
    setBreakpointCondicional(linha, expressao) {
      const n = Number(linha);
      if (!Number.isInteger(n) || n < 1) return false;
      const src = String(expressao || "").trim();
      if (!src) {
        this.breakpointsCondicionais.delete(n);
        return true;
      }
      // Compila uma vez: avaliar a condição a cada statement é caro, e o texto
      // não muda durante a sessão.
      try {
        const tokens = new VG.Lexer("Algoritmo \"bp\"\nInicio\n   x <- " + src + "\nFimalgoritmo\n").tokenizar();
        const prog = new VG.Parser(tokens).parse();
        this.breakpointsCondicionais.set(n, { expressao: src, no: prog.corpo[0].valor });
      } catch (e) {
        throw Diagnostics.criar("SINTESE_ESPERADO", "Condição de breakpoint inválida: " + e.message, { linha: n });
      }
      this.breakpoints.add(n);
      return true;
    }
    getBreakpointCondicional(linha) {
      const b = this.breakpointsCondicionais.get(Number(linha));
      return b ? b.expressao : null;
    }

    // ------------------------------------------------------ §28.6/§28.8 getters

    /**
     * §28.6 — variáveis. Lidas do `Environment` real, nunca de cópia paralela.
     * §39.4 exige que o que a UI mostra seja o que existe.
     */
    getVariables(profundidade) {
      const limite = this.limiteElementos || 200;
      const contexto = this.contexto;
      const pilha = contexto.pilha;
      const alvo =
        profundidade === null || profundidade === undefined
          ? pilha.length
          : Math.min(Math.max(1, profundidade), Math.max(1, pilha.length));
      const quadros = [];
      for (let i = pilha.length - 1, p = 1; i >= 0; i--, p++) {
        const f = pilha[i];
        const variaveis = [];
        for (const [nome, slot] of f.ambiente.slots) {
          variaveis.push(this.descreverSlot(nome, slot, "local", limite));
        }
        quadros.push({
          profundidade: p,
          nome: f.nome,
          linha: f.linha,
          coluna: f.coluna,
          parametros: (f.parametros || []).map((x) => ({ nome: x.nome, referencia: !!x.referencia })),
          variaveis,
          selecionado: p === alvo,
        });
      }
      const nomesLocais = new Set();
      for (const q of quadros) for (const v of q.variaveis) nomesLocais.add(v.nome);
      const globais = [];
      for (const [nome, slot] of contexto.variaveis()) {
        if (nomesLocais.has(nome)) continue;
        globais.push(this.descreverSlot(nome, slot, "global", limite));
      }
      return { globais, quadros, foco: alvo };
    }

    /**
     * §28.8 — call stack do runtime. É a MESMA que `getVariables` usa para os
     * quadros, então §39.3 vale por construção: não existe segunda pilha.
     */
    getCallStack() {
      const pilha = this.contexto.pilha;
      const saida = [];
      for (let i = pilha.length - 1, p = 1; i >= 0; i--, p--) {
        const f = pilha[i];
        saida.push({
          nome: f.nome,
          linha: f.linha,
          coluna: f.coluna,
          profundidade: pilha.length - i,
          parametros: (f.parametros || []).map((x) => ({ nome: x.nome, referencia: !!x.referencia })),
        });
      }
      return saida;
    }

    descreverSlot(nome, slot, escopo, limite) {
      const v = {
        nome: nome,
        tipo: slot.tipo,
        escopo: escopo,
        valor: V.paraPainel(slot.valor),
        linha: slot.linha,
      };
      const val = slot.valor;
      if (V.ehVetor(val)) {
        const d = val.dimensoes[0];
        const itens = [];
        for (let i = d.de; i <= d.ate && itens.length < limite; i++) {
          itens.push({ indice: i, valor: V.paraPainel(val.obter(i)) });
        }
        v.elementos = itens;
        v.totalElementos = d.ate - d.de + 1;
      } else if (V.ehMatriz(val)) {
        const d0 = val.dimensoes[0];
        const itens = [];
        outer: for (let i = d0.de; i <= d0.ate; i++) {
          const linha = [];
          for (let j = val.dimensoes[1].de; j <= val.dimensoes[1].ate; j++) {
            linha.push({ indice: j, valor: V.paraPainel(val.obter(i, j)) });
            if (itens.length >= limite) break outer;
          }
          itens.push({ indice: i, linha });
        }
        v.elementos = itens;
      }
      return v;
    }

    /**
     * §28.7 — `variable_changed`.
     *
     * Comparado com o último valor CONHECIDO, e não com o valor anterior do
     * statement anterior: se o debugger entra tarde, o primeiro `lê` de cada
     * variável emite uma mudança que é informação nova para quem está olhando.
     * Emitir "mudou" a cada statement seria ruído.
     */
    observarVariaveis() {
      for (const [nome, slot] of this.contexto.variaveis()) {
        const atual = V.paraPainel(slot.valor);
        const chave = nome;
        if (this.ultimosValores.has(chave) && this.ultimosValores.get(chave) !== atual) {
          this.emitirVariavel(chave, slot, this.ultimosValores.get(chave), atual);
        }
        this.ultimosValores.set(chave, atual);
      }
    }

    onVariableChanged(cb) {
      this.ouvintesVariaveis.push(cb);
      return () => {
        const i = this.ouvintesVariaveis.indexOf(cb);
        if (i >= 0) this.ouvintesVariaveis.splice(i, 1);
      };
    }

    emitirVariavel(nome, slot, anterior, atual) {
      for (const cb of this.ouvintesVariaveis.slice()) {
        try {
          cb({
            type: "variable_changed",
            scope: this.contexto.profundidade === 0 ? "global" : "local",
            name: nome,
            previousValue: anterior,
            value: atual,
            sourceLine: slot.linha,
          });
        } catch (e) {
          // Um painel quebrado não derruba o programa.
        }
      }
    }

    // ------------------------------------------------------------ §28.9 perfil

    /**
     * §28.9 — perfil por `statementId`, com a visão agregada por linha.
     * §39.6: só cresce quando statements executam de fato.
     */
    contarStatement(cmd) {
      if (cmd.statementId === undefined || cmd.statementId === null) {
        cmd.statementId = this.proximoStatementId++;
      }
      let reg = this.perfil.get(cmd.statementId);
      if (!reg) {
        reg = { statementId: cmd.statementId, linha: cmd.linha, tipo: cmd.tipo, execucoes: 0 };
        this.perfil.set(cmd.statementId, reg);
      }
      reg.execucoes++;
      return cmd.statementId;
    }

    getProfile(ordem) {
      const itens = Array.from(this.perfil.values());
      if (ordem === "linha") {
        const porLinha = new Map();
        for (const it of itens) {
          const cur = porLinha.get(it.linha);
          if (!cur) porLinha.set(it.linha, { linha: it.linha, execucoes: it.execucoes, statements: 1 });
          else {
            cur.execucoes += it.execucoes;
            cur.statements++;
          }
        }
        const saida = Array.from(porLinha.values());
        saida.sort((a, b) => a.linha - b.linha);
        return saida;
      }
      itens.sort((a, b) => b.execucoes - a.execucoes || a.linha - b.linha);
      return itens;
    }

    pos(no) {
      return no ? { linha: no.linha, coluna: no.coluna, comprimento: no.length || null } : null;
    }

    // ------------------------------------------------------------ ciclo maior

    async executar() {
      this.scheduler.iniciar();
      try {
        await this.declararGlobais();
        await this.bloco(this.programa.corpo);
        this.scheduler.mudarPara(S.ESTADO.FINISHED);
        return { ok: true };
      } catch (e) {
        if (S.ehParada(e)) {
          this.scheduler.mudarPara(S.ESTADO.STOPPED);
          return { ok: false, interrompido: true };
        }
        this.scheduler.mudarPara(S.ESTADO.ERROR);
        return { ok: false, erro: Diagnostics.serializar(e) };
      }
    }

    /** Declara globais e registra os subprogramas (§23–§27). */
    async declararGlobais() {
      for (const d of this.programa.variaveis || []) {
        for (const nome of d.nomes) {
          let valor;
          if (d.tipo === "vetor") {
            valor = this.criarVetor(nome, d);
          } else if (d.tipo === "matriz") {
            valor = this.criarMatriz(nome, d);
          }
          this.contexto.global.definir(nome, d.tipo, valor, this.pos(d));
        }
      }
      this.subprogramas = new Map();
      for (const sub of this.programa.subprogramas || []) {
        this.subprogramas.set(String(sub.nome).toLowerCase(), sub);
      }
    }

    criarVetor(nome, d) {
      const faixa = d.dimensoes[0];
      return new V.Vetor(
        nome,
        V.limiteDe(faixa.de, nome),
        V.limiteDe(faixa.ate, nome),
        elementoDe(d, this, nome)
      );
    }

    criarMatriz(nome, d) {
      return new V.Matriz(
        nome,
        d.dimensoes.map((f, i) => ({ de: V.limiteDe(f.de, nome + " (dimensão " + (i + 1) + ")"), ate: V.limiteDe(f.ate, nome) })),
        elementoDe(d, this, nome)
      );
    }

    // ------------------------------------------------------------ statements

    async bloco(comandos) {
      if (!comandos) return;
      for (const cmd of comandos) {
        if (cmd === null) continue;
        await this.comando(cmd);
      }
    }

    /**
     * §28.7 — observa em volta do statement, não só antes.
     *
     * A observação precisa ser ANTES e DEPOIS do comando. Só antes, a última
     * atribuição do programa nunca era vista — o laço observava o estado
     * anterior ao statement, e `n <- 7` como última linha só emitia o par
     * `0 -> 1`. O painel ficava permanentemente uma atualização atrasado, e era
     * justamente o valor que o aluno acabou de digitar que não aparecia.
     */
    async comando(cmd) {
      if (!this.deveObservarVariaveis()) return this.comandoSemObservar(cmd);
      this.observarVariaveis();
      try {
        return await this.comandoSemObservar(cmd);
      } finally {
        this.observarVariaveis();
      }
    }

    /**
     * Observar custa uma passada pelo escopo por statement. Só vale a pena
     * quando alguém está de fato olhando: com debugger ligado, ou com ouvinte
     * registrado. Sem isso, execução normal pagaria uma varredura de variáveis em todo
     * comando do programa para nada.
     */
    deveObservarVariaveis() {
      return this.barreira !== null || this.ouvintesVariaveis.length > 0;
    }

    async comandoSemObservar(cmd) {
      if (this.pedidoParada || this.deveParar()) throw new S.SinalParada("parado");
      await this.scheduler.checar(cmd.linha);

      // §28.2/§28.9 — o statement recebe identidade e é contado ANTES de
      // qualquer decisão de pausa. Contar depois faria o statement pausado não
      // aparecer no perfil, e §39.6 exige que o perfil reflita execução real.
      this.contarStatement(cmd);

      // §28.1 — ExecutionPoint, derivado da AST, nunca do texto do editor.
      this.executionPoint = this.pontoDe(cmd);
      if (this.aoLinha) this.aoLinha(cmd.linha, cmd, this.executionPoint);

      // §40 — barreira de suspensão. Só paga o custo quando existe debugger; o
      // caminho normal é um `if` por comando, e sem `await` quando não há pausa.
      if (this.barreira) {
        const espera = this.barreira(cmd, this);
        if (espera) await espera;
      }

      try {
        switch (cmd.tipo) {
          case "escrever": return await this.comandoEscrever(cmd);
          case "ler": return await this.comandoLer(cmd);
          case "atribuicao": return await this.comandoAtribuicao(cmd);
          case "se": return await this.comandoSe(cmd);
          case "enquanto": return await this.comandoEnquanto(cmd);
          case "repita": return await this.comandoRepita(cmd);
          case "para": return await this.comandoPara(cmd);
          case "escolha": return await this.comandoEscolha(cmd);
          case "interrompa": throw new S.SinalInterrompa(null);
          case "retorne": throw new S.SinalRetorno(cmd.valor === undefined ? null : await this.avaliar(cmd.valor));
          case "expressao": await this.avaliar(cmd.valor); return;
          case "extensao": return await this.comandoExtensao(cmd);
          case "fim-algoritmo": return;
          default:
            throw Diagnostics.criar("RUNTIME_NAO_DECLARADA", "Comando desconhecido: '" + cmd.tipo + "'", this.pos(cmd));
        }
      } catch (e) {
        // §40 — notifica o erro com a pilha de chamadas ainda montada.
        if (this.aoErro && !S.ehParada(e) && !S.ehInterrompa(e) && !S.ehRetorno(e)) {
          this.aoErro(e, this, cmd);
        }
        throw e;
      }
    }

    /**
     * §31–§39 — despacho de comando de extensão.
     *
     * A tabela é `VG.Extensoes.comandos`, lida NO MOMENTO da execução e não no
     * topo do arquivo, porque `extensions.js` entra na carga depois de
     * `runtime.js`. Um runtime que procurasse a tabela no construtor quebraria
     * a ordem de carga; procurar por comando quebra em NENHUM ponto, porque os
     * dois já estão carregados quando o primeiro comando roda.
     *
     * O comando que devolve valor imprime sozinho, com quebra de linha, que é o
     * comportamento do VisuAlg para `TAMANHO("a.txt")` sozinho na linha. Os de
     // efeito puro declaram `imprime: false` e devolvem `null`.
     */
    async comandoExtensao(cmd) {
      const X = W.VG && W.VG.Extensoes;
      if (!X || !X.comandos) {
        throw Diagnostics.criar(
          "RUNTIME_NAO_DECLARADA",
          "Extensões não carregadas: '" + cmd.comando + "' não pode ser executado",
          this.pos(cmd)
        );
      }
      const def = X.comandos[String(cmd.comando).toLowerCase()];
      if (!def || typeof def.executar !== "function") {
        throw Diagnostics.criar(
          "RUNTIME_NAO_DECLARADA",
          "Comando de extensão desconhecido: '" + cmd.comando + "'",
          this.pos(cmd)
        );
      }
      const argumentos = [];
      for (const a of cmd.argumentos || []) argumentos.push(await this.avaliar(a));
      const pos = this.pos(cmd);
      const valor = await def.executar(argumentos, this, pos);
      if (def.imprime !== false && valor !== undefined && valor !== null) {
        this.saida(V.paraTexto(valor) + "\n");
      }
    }

    /**
     * §16–§17. A ordem casas-depois-largura é obrigatória: `escreval("x: ",
     * v:6:2)` com v=3.14159 precisa sair "  3.14", com o preenchimento applied
     * depois do arredondamento.
     */
    // ================================================================
    // §40 / §28.2 / §28.3 / §28.4 — controle de execução.
    //
    // A barreira e estes quatro métodos são o TODO do debugger no runtime. A
    // primeira versão do projeto pausava desempilhando tudo e reexecutando o
    // programa; aqui a execução é uma só, e a barreira segura um statement
    // enquanto a UI decide.
    // ================================================================

    /**
     * Instala a barreira de depuração.
     *
     * A decisão é por PROFUNDIDADE de frame, e não por linha: é o que separa
     * "sobre" de "dentro" e "fora" sem a AST precisar distinguir chamada de
     * comando comum. §30 chama esses modos de extensão do playground, e não de
     * recurso nativo do VisuAlg — daí o prefixo `modoDebug`.
     */
    ativarDepuracao() {
      if (this.barreira) return;
      this.barreira = (cmd, rt) => this.decidirPausa(cmd, rt);
      this.scheduler.mudarPara(S.ESTADO.RUNNING);
    }

    desativarDepuracao() {
      this.barreira = null;
      this.modoPasso = null;
      this.destravarPausa();
    }

    /** §28.5 — o breakpoint para ANTES do statement correspondente. */
    temBreakpoint(linha) {
      return this.breakpoints.has(linha);
    }

    /**
     * Decide se este statement pausa.
     *
     * Devolve `undefined` no caminho rápido (sem debugger ativo, ou sem motivo
     * de pausa), e uma Promise SÓ quando precisa segurar o statement. Não pode
     * ser `async`: uma função `async` devolve Promise sempre, e o `runtime`
     * pagaria um microtask por statement mesmo sem debugger.
     */
    decidirPausa(cmd, rt) {
      if (this.pedidoParada) return undefined;

      // Pausa de fonte: `pausa` (§22) e `debug <expr>` (§23) pedem a pausa pelo
      // hook `aoPausarFonte`, e não por breakpoint. Eles entram por este
      // callback, e a decisão abaixo é a mesma para os dois.
      if (typeof this.aoPausarFonte === "function") {
        const viaFonte = this.aoPausarFonte(cmd, rt);
        if (viaFonte) return this.pausar(cmd, rt, viaFonte);
      }

      const prof = rt.contexto.profundidade;
      if (this.modoPasso) {
        if (this.modoPasso === "inicio") {
          // Pausa no PRIMEIRO statement da sessão. É o que faz o botão Debug
          // mostrar o estado inicial em vez de o programa disparar até o fim
          // quando não há nenhum breakpoint marcado.
          return this.pausar(cmd, rt, "inicio");
        }
        if (this.modoPasso === "ate") {
          // §11C Run to Cursor: roda até a linha que o usuário escolheu.
          if (cmd.linha === this.linhaAlvo) return this.pausar(cmd, rt, "run_to_cursor");
          return undefined;
        }
        if (this.modoPasso === "sobre" && prof <= this.profundidadePausa) return this.pausar(cmd, rt, "sobre");
        if (this.modoPasso === "dentro") {
          if (!this.pausaTemChamada) {
            // Sem chamada na linha corrente, o programa nunca desce de
            // profundidade e "dentro" rodaria até o fim. Aí ele É "sobre".
            if (prof <= this.profundidadePausa) return this.pausar(cmd, rt, "dentro");
            return undefined;
          }
          if (prof > this.profundidadePausa) return this.pausar(cmd, rt, "dentro");
          return undefined;
        }
        if (this.modoPasso === "fora" && prof < this.profundidadePausa) return this.pausar(cmd, rt, "fora");
        return undefined;
      }

      if (this.breakpoints.has(cmd.linha)) {
        const cond = this.breakpointsCondicionais.get(cmd.linha);
        if (!cond) return this.pausar(cmd, rt, "breakpoint");
        // §11C — condição avaliada com o evaluator da engine, nunca com `eval`.
        // É o único caminho que precisa devolver Promise, porque avaliar a
        // condição é assíncrono.
        const self = this;
        return rt.avaliar(cond.no).then(
          function (v) {
            // O valor tem de ser `true`, não "lógico": `ehLogico` aqui pausaria
            // também com `FALSO`, que é o oposto do que breakpoint condicional
            // significa. Um valor não lógico também não pausa — é condição
            // malformada, e o erro do parser já teria aparecido antes.
            return v === true ? self.pausar(cmd, rt, "condicional") : undefined;
          },
          function () {
            // Condição que dá erro não pode derrubar o programa: trata como falsa.
            return undefined;
          }
        );
      }
      return undefined;
    }

    /**
     * Pausa de verdade: registra o ponto e segura o statement.
     *
     * Não lança `SinalParada` (que derrubaria a execução) e não reinicia
     * nada. Devolve a Promise que `resume`/`step`/`stop` vai resolver.
     */
    pausar(cmd, rt, motivo) {
      this.profundidadePausa = rt.contexto.profundidade;
      this.pausaTemChamada = contemChamada(cmd);
      this.modoPasso = null;
      this.motivoPausa = motivo || "breakpoint";
      this.executionPoint = this.pontoDe(cmd);
      this.scheduler.mudarPara(S.ESTADO.PAUSED);
      this.emitirPausa();
      const self = this;
      return new Promise((resolve) => {
        self.retomarPausa = resolve;
      });
    }

    destravarPausa() {
      const r = this.retomarPausa;
      this.retomarPausa = null;
      if (r) r();
    }

    /**
     * §22 / §23 — pausa pedida pelo PRÓPRIO PROGRAMA.
     *
     * `pausa` e `debug <expr>` são comandos da linguagem (§ D8: continuam sendo
     * recurso do programa, não botão da UI), mas a pausa que eles provocam é a
     * MESMA do debugger: mesmo estado, mesma ExecutionPoint, mesmos botões de
     * continuar/passo/parar. Por isso eles chamam este método em vez de esperar
     * uma Promise do lado da interface — que era o caminho antigo, e deixava o
     * programa travado se ninguém estivesse olhando.
     *
     * Sem debugger ativo, `pausa` é no-op. Isso é deliberado: `pausa` pausa o
     * PSEUDOCÓDIGO para inspeção, e sem ninguém inspecionando não há o que fazer.
     */
    pausarDeFonte(motivo, pos) {
      if (!this.barreira) return Promise.resolve(false);
      this.motivoPausa = motivo || "source_pause";
      if (pos) {
        this.linhaAtual = pos.linha;
        this.colunaAtual = pos.coluna != null ? pos.coluna : null;
      }
      this.scheduler.mudarPara(S.ESTADO.PAUSED);
      this.emitirPausa();
      const self = this;
      return new Promise((resolve) => {
        self.retomarPausa = resolve;
      });
    }

    emitirPausa() {
      if (typeof this.aoPausa === "function") {
        this.aoPausa({
          executionPoint: this.executionPoint,
          callStack: this.getCallStack(),
          variables: this.getVariables(),
          motivo: this.motivoPausa,
        });
      }
    }

    /** §28.3 — `resume`: continua de `paused` sem ficar preso no mesmo bp. */
    resume() {
      // Aceitar STEPPING aqui não é um detalhe: `step()` libera a barreira e o
      // programa segue até a PRÓXIMA pausa, e esse intervalo é justamente onde o
      // botão Continuar pode ser apertado. Restringir a PAUSED fazia o comando
      // virar no-op, e o programa voltava a pausar na linha seguinte sem nunca
      // mais receber comando — travado, com o botão aparentemente sem efeito.
      if (this.scheduler.estado !== S.ESTADO.PAUSED && this.scheduler.estado !== S.ESTADO.STEPPING) return false;
      this.modoPasso = null;
      this.scheduler.mudarPara(S.ESTADO.RUNNING);
      this.destravarPausa();
      return true;
    }

    /**
     * §28.2 — `step(modo)`: uma chamada executa UM statement observável.
     * §39.8 exige que não execute dois, e o teste mede a linha antes e depois.
     */
    step(modo) {
      if (this.scheduler.estado !== S.ESTADO.PAUSED) return false;
      this.modoPasso = modo || "sobre";
      this.scheduler.mudarPara(S.ESTADO.STEPPING);
      this.destravarPausa();
      return true;
    }

    /** §11C — Run to Cursor. */
    stepAte(linha) {
      if (this.scheduler.estado !== S.ESTADO.PAUSED) return false;
      this.modoPasso = "ate";
      this.linhaAlvo = Number(linha);
      this.scheduler.mudarPara(S.ESTADO.STEPPING);
      this.destravarPausa();
      return true;
    }

    /**
     * §28.4 — `stop`.
     *
     * Precisa preservar código e breakpoints: parar é parar a EXECUÇÃO, não
     * descartar o trabalho do aluno. Por isso `clearBreakpoints` NÃO é chamado
     * aqui, ao contrário do que seria o impulso de "voltar ao estado inicial".
     */
    stop() {
      this.pedidoParada = true;
      this.modoPasso = null;
      this.scheduler.mudarPara(S.ESTADO.STOPPED);
      this.destravarPausa();
      if (typeof this.onStop === "function") this.onStop();
      return true;
    }

    async comandoEscrever(cmd) {
      for (const arg of cmd.argumentos) {
        const v = await this.avaliar(arg.expr);
        let t;
        if (arg.casas !== null && arg.casas !== undefined && V.ehNumerico(v)) {
          let casas = Math.trunc(arg.casas);
          if (casas < 0) casas = 0;
          if (casas > 100) casas = 100;
          t = v.toFixed(casas);
        } else {
          t = V.paraTexto(v);
        }
        if (arg.largura !== null && arg.largura !== undefined) {
          const largura = Math.trunc(arg.largura);
          if (largura > 0 && t.length < largura) t = t.padStart(largura, " ");
        }
        this.saida(t);
      }
      if (cmd.comQuebra) this.saida("\n");
    }

    async comandoLer(cmd) {
      for (const alvo of cmd.alvos) {
        // O prompt precisa ser "Entre com o valor de <nome>": o harness de teste
        // extrai o nome da variável com regex desse texto.
        //
        // §31/§32 — as extensões são a FONTE dos dados quando estão ativas
        // (`aleatorio on` e o `LERA` da §32). `antesDeEntrada` devolve `null`
        // quando não há nada a injectar, e aí o caminho é o de sempre: prompt e
        // `entrada`. A ordem dentro da extensão também importa — o que o `LERA`
        // enfileirou é mais específico que o gerador do `aleatorio`, e sai antes.
        const prompt = "Entre com o valor de " + alvo.nome;
        const injetado = this.entradaDasExtensoes(prompt);
        let digitado;
        if (injetado !== null && injetado !== undefined) {
          digitado = injetado;
        } else {
          // Rejeição do `entrada` (usuário apertou Parar) é interrupção, não erro.
          try {
            digitado = await this.entrada(prompt);
          } catch (e) {
            throw new S.SinalParada(e && e.message ? e.message : "parado");
          }
        }
        // §38 — `eco on` mostra o valor lido no terminal. O default é eco DESLIGADO
        // (ver `Extensoes.deveEco`): os testes de `tools/testar.mjs` afirmam as
        // listas exatas de saída de programas com `leia`, e ecoar por padrão mudaria
        // todas elas.
        const X = W.VG && W.VG.Extensoes;
        if (X && typeof X.deveEco === "function" && X.deveEco(this)) {
          this.saida(V.paraTexto(digitado));
        }
        // `digitado` é TEXTO CRU, não um nó de AST, então não pode passar por
        // `atribuirAlvo`. A coerção para o tipo declarado acontece em
        // `Ambiente.atribuir` e em `Vetor.definir`.
        if (alvo.tipo === "identificador") {
          this.ambienteAtual().atribuir(alvo.nome, digitado, this.pos(alvo));
        } else {
          const base = await this.avaliar(alvo.alvo);
          const i0 = await this.avaliar(alvo.indices[0]);
          if (V.ehVetor(base)) {
            base.definir(i0, digitado, this.pos(alvo));
          } else if (V.ehMatriz(base)) {
            const i1 = await this.avaliar(alvo.indices[1]);
            base.definir(i0, i1, digitado, this.pos(alvo));
          } else {
            throw Diagnostics.criar("RUNTIME_INDICE", "Alvo de 'leia' não é vetor nem matriz", this.pos(alvo));
          }
        }
      }
    }

    /**
     * §31/§32 — o que a extensão tem a dizer sobre a próxima leitura.
     *
     * `null` significa "não há nada"; aí o runtime pergunta ao usuário. A
     * extensão é lida por propriedade no instante do uso, porque ela é carregada
     * depois deste arquivo.
     */
    entradaDasExtensoes(prompt) {
      const X = W.VG && W.VG.Extensoes;
      if (!X || typeof X.antesDeEntrada !== "function") return null;
      return X.antesDeEntrada(this, prompt);
    }

    async comandoAtribuicao(cmd) {
      await this.atribuirAlvo(cmd.alvo, cmd.valor);
    }

    async comandoSe(cmd) {
      const c = await this.avaliar(cmd.condicao);
      if (!V.ehLogico(c)) {
        throw Diagnostics.criar("TIPO_INCOMPATIVEL", "A condição do 'se' precisa ser verdadeira ou falsa", this.pos(cmd));
      }
      if (c) await this.bloco(cmd.entao);
      else if (cmd.senao) await this.bloco(cmd.senao);
    }

    async comandoEnquanto(cmd) {
      while (true) {
        if (this.deveParar()) throw new S.SinalParada("parado");
        await this.scheduler.checar(cmd.linha);
        const c = await this.avaliar(cmd.condicao);
        if (!V.ehLogico(c)) {
          throw Diagnostics.criar("TIPO_INCOMPATIVEL", "A condição do 'enquanto' precisa ser verdadeira ou falsa", this.pos(cmd));
        }
        if (!c) return;
        try {
          await this.bloco(cmd.corpo);
        } catch (e) {
          if (S.ehInterrompa(e)) return; // §22
          throw e;
        }
      }
    }

    async comandoRepita(cmd) {
      while (true) {
        if (this.deveParar()) throw new S.SinalParada("parado");
        await this.scheduler.checar(cmd.linha);
        try {
          await this.bloco(cmd.corpo);
        } catch (e) {
          if (S.ehInterrompa(e)) return; // §22
          throw e;
        }
        const c = await this.avaliar(cmd.condicao);
        if (!V.ehLogico(c)) {
          throw Diagnostics.criar("TIPO_INCOMPATIVEL", "A condição do 'até' precisa ser verdadeira ou falsa", this.pos(cmd));
        }
        if (c) return;
      }
    }

    async comandoPara(cmd) {
      const de = await this.avaliar(cmd.de);
      const ate = await this.avaliar(cmd.ate);
      const passo = cmd.passo ? await this.avaliar(cmd.passo) : 1;
      if (!V.ehNumerico(de) || !V.ehNumerico(ate) || !V.ehNumerico(passo)) {
        throw Diagnostics.criar("TIPO_INCOMPATIVEL", "O laço 'para' precisa de valores numéricos", this.pos(cmd));
      }
      if (passo === 0) {
        // §15 — o parser NÃO barra `passo 0` (sintaxe válida). O analisador
        // semântico barra o literal; aqui vai o caso dinâmico, `passo n` com n
        // valendo zero. Mesmo código, mesma classe, para que quem pesquisa
        // INVALID_LOOP_STEP encontre os dois caminhos.
        throw Diagnostics.criar("INVALID_LOOP_STEP", "Passo do 'para' não pode ser zero", this.pos(cmd));
      }
      const nome = cmd.variavel.nome;
      const inicio = de;
      const alvo = ate;
      const incr = passo;
      // Laço por contagem: a variável de controle é atribuída ANTES de cada
      // corpo, e o passo é avaliado uma vez só. Isso evita o `v = v + passo` do
      // runtime antigo, que reavaliava nada mas também não parava se o corpo
      // alterasse a própria variável de controle.
      for (let v = inicio; incr > 0 ? v <= alvo : v >= alvo; v += incr) {
        if (this.deveParar()) throw new S.SinalParada("parado");
        await this.scheduler.checar(cmd.linha);
        this.ambienteAtual().atribuir(nome, v, this.pos(cmd.variavel));
        try {
          await this.bloco(cmd.corpo);
        } catch (e) {
          if (S.ehInterrompa(e)) return; // §22
          throw e;
        }
      }
    }

    /**
     * §18 — `escolha`. Sem `break` implícito: o corpo de um `caso` só sai se
     * terminar em `interrompa`, senão a §601 proíbe cair no próximo caso.
     */
    async comandoEscolha(cmd) {
      const seletor = await this.avaliar(cmd.seletor);
      let executou = false;
      for (const caso of cmd.casos) {
        for (const valor of caso.valores) {
          const bate = valor.intervalo
            ? this.dentroDoIntervalo(seletor, valor, cmd)
            : V.comparar("=", seletor, await this.avaliar(valor.de !== undefined ? valor.de : valor), this.pos(cmd));
          if (bate) {
            try {
              await this.bloco(caso.corpo);
            } catch (e) {
              if (S.ehInterrompa(e)) return; // §22
              throw e;
            }
            executou = true;
            break;
          }
        }
        if (executou) return;
      }
      if (cmd.outrocaso) {
        try {
          await this.bloco(cmd.outrocaso.corpo);
        } catch (e) {
          if (S.ehInterrompa(e)) return;
          throw e;
        }
      }
    }

    async dentroDoIntervalo(seletor, faixa, cmd) {
      const de = await this.avaliar(faixa.de);
      const ate = await this.avaliar(faixa.ate);
      const min = Math.min(de, ate);
      const max = Math.max(de, ate);
      return V.comparar(">=", seletor, min, this.pos(cmd)) && V.comparar("<=", seletor, max, this.pos(cmd));
    }

    // ------------------------------------------------------------ expressões

    async avaliar(e) {
      if (e === null || e === undefined) return null;
      switch (e.tipo) {
        case "literal": return e.valor;
        case "identificador": {
          const v = this.ambienteAtual().ler(e.nome, this.pos(e));
          return this.desreferenciar(v, e);
        }
        case "indice": return this.avaliarIndice(e);
        case "unario": return V.unario(e.operador, await this.avaliar(e.operando), this.pos(e));
        case "binario": return this.avaliarBinario(e);
        case "chamada": return this.chamar(e, null);
        default:
          throw Diagnostics.criar("RUNTIME_NAO_DECLARADA", "Expressão desconhecida: '" + e.tipo + "'", this.pos(e));
      }
    }

    async avaliarIndice(e) {
      const base = await this.avaliar(e.alvo);
      const i0 = await this.avaliar(e.indices[0]);
      if (V.ehVetor(base)) return base.obter(i0, this.pos(e));
      if (V.ehMatriz(base)) {
        const i1 = await this.avaliar(e.indices[1]);
        return base.obter(i0, i1, this.pos(e));
      }
      throw Diagnostics.criar(
        "RUNTIME_INDICE",
        "'" + (e.alvo.nome || "valor") + "' não é vetor nem matriz",
        this.pos(e)
      );
    }

    async avaliarBinario(e) {
      const op = e.operador;
      if (op === "e" || op === "ou") {
        // Curto-circuito: `e` não avalia o direito quando o esquerdo é falso, e
        // `ou` não avalia quando é verdadeiro. Sem isso, `x > 0 e 10 / x > 1`
        // explodiria com divisão por zero.
        const a = await this.avaliar(e.esquerda);
        if (op === "e" && a === false) return false;
        if (op === "ou" && a === true) return true;
        return V.logico(op, a, await this.avaliar(e.direita), this.pos(e));
      }
      const a = await this.avaliar(e.esquerda);
      const b = await this.avaliar(e.direita);
      if (op === "xou" || op === "não") return V.logico(op, a, b, this.pos(e));
      if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") {
        return V.comparar(op, a, b, this.pos(e));
      }
      return V.aritmetica(op, a, b, this.pos(e));
    }

    // ------------------------------------------------------------- chamadas

    /**
     * §23–§27 — chamada de função ou procedimento.
     *
     * `slotAlvo` é o slot do chamador quando o parâmetro foi declarado `var`
     * (§25): nesse caso o argumento é ligado por alias, não por cópia. Para
     * vetor e matriz, o alias aponta para a célula, que é o que faz
     * `procedimento dobrar(var v: inteiro)` alterar o vetor do chamador.
     */
    async chamar(e, slotAlvo) {
      const nome = String(e.nome).toLowerCase();
      const sub = this.subprogramas && this.subprogramas.get(nome);
      if (!sub) {
        // A chave do registro é a forma SEM ACENTO em minúsculas, e não só
        // `toLowerCase()`: é o que faz `CABEÇALHO` e `CABECALHO` — as duas
        // grafias do VisuAlg para a mesma §32 — caírem no mesmo builtin. É a
        // mesma normalização que o lexer e o `parser.js` já usam, então o
        // nome do builtin é o mesmo nos três lugares.
        const builtin = this.registros[VG.Tokens.chaveDe(e.nome)];
        if (typeof builtin === "function") {
          const args = [];
          for (const a of e.argumentos) args.push(await this.avaliar(a));
          // A posição vai como TERCEIRO argumento: a stdlib (§29, §30) e as
          // extensões (§31–§39) assinam `(args, runtime, pos)` e sem isto todo
          // erro de builtin saía sem linha.
          return builtin(args, this, e);
        }
        throw Diagnostics.criar("RUNTIME_NAO_DECLARADA", "Subprograma '" + e.nome + "' não declarado", this.pos(e));
      }
      if (e.argumentos.length !== sub.parametros.length) {
        throw Diagnostics.criar(
          "TIPO_ARGUMENTOS",
          "'" + e.nome + "' espera " + sub.parametros.length + " argumento(s), veio " + e.argumentos.length,
          this.pos(e)
        );
      }
      const frame = this.contexto.empilharFrame(e.nome, this.pos(e));
      try {
        for (let i = 0; i < sub.parametros.length; i++) {
          const p = sub.parametros[i];
          if (p.porReferencia) {
            const arg = e.argumentos[i];
            const slot = this.slotDoArgumento(arg, p);
            frame.ambiente.definirPorReferencia(p.nome, p.tipo, slot, this.pos(p));
            frame.parametros.push({ nome: p.nome, referencia: true });
          } else {
            frame.ambiente.definir(p.nome, p.tipo, await this.avaliar(e.argumentos[i]), this.pos(p));
            frame.parametros.push({ nome: p.nome, referencia: false });
          }
        }
        // Subprogramas podem declarar suas próprias variáveis globais? Não. O
        // VisuAlg não tem `var` local; variáveis são todas globais. O corpo
        // então roda no frame, enxergando o global por cadeia lexical.
        try {
          await this.bloco(sub.corpo);
        } catch (err) {
          if (S.ehRetorno(err)) {
            if (sub.tipo === "funcao") return err.valor;
            if (err.valor !== null && err.valor !== undefined) {
              throw Diagnostics.criar(
                "TIPO_INCOMPATIVEL",
                "Procedimento '" + e.nome + "' não retorna valor",
                this.pos(e)
              );
            }
            return null;
          }
          throw err;
        }
        if (sub.tipo === "funcao") {
          // §23 — função sem `retorne` explícito devolve o neutro do tipo.
          return V.zeroDe(sub.retorno);
        }
        return null;
      } finally {
        this.contexto.desempilharFrame();
      }
    }

    /**
     * Resolve o slot de um argumento passado por referência. Para `v[2]` o slot
     * é uma célula sintética que escreve direto no vetor.
     */
    slotDoArgumento(arg, p) {
      if (arg.tipo === "indice") {
        const base = this.ambienteAtual().ler(arg.alvo.nome, this.pos(arg));
        if (V.ehVetor(base)) {
          const exprIndice = arg.indices[0];
          // Só o índice literal pode virar célula sintética agora; um índice
          // calculado seria avaliado em outro momento, e um slot sintético
          // correria o risco de escrever no elemento errado.
          if (!(exprIndice.tipo === "literal" && typeof exprIndice.valor === "number")) {
            throw Diagnostics.criar(
              "RUNTIME_INDICE",
              "Passagem por referência exige índice constante",
              this.pos(exprIndice)
            );
          }
          const i = exprIndice.valor;
          base.linear(i, this.pos(arg)); // valida a faixa aqui
          const celula = new E.Slot(arg.alvo.nome + "[" + i + "]", p.tipo, base.obter(i, this.pos(arg)), this.pos(arg));
          celula.definirEm = (v) => base.definir(i, v, this.pos(arg));
          // Leitura também atravessa: sem isto, `v` dentro do procedimento
          // ficaria com o valor congelado no momento da chamada.
          celula.lerEm = () => base.obter(i, this.pos(arg));
          return celula;
        }
      }
      return this.ambienteAtual().buscar(arg.nome, this.pos(arg));
    }

    // ------------------------------------------------------------- alvos

    ambienteAtual() {
      return this.contexto.ambiente;
    }

    desreferenciar(valor, no) {
      // Célula sintética de vetor (§25) resolve para o vetor, ao vivo.
      if (valor && typeof valor.lerEm === "function") return valor.lerEm();
      return valor;
    }

    async atribuirAlvo(alvo, valor) {
      if (alvo.tipo === "identificador") {
        const v = await this.avaliar(valor);
        this.ambienteAtual().atribuir(alvo.nome, v, this.pos(alvo));
        return;
      }
      if (alvo.tipo === "indice") {
        const base = await this.avaliar(alvo.alvo);
        const i0 = await this.avaliar(alvo.indices[0]);
        const v = await this.avaliar(valor);
        if (V.ehVetor(base)) {
          base.definir(i0, v, this.pos(alvo));
          return;
        }
        if (V.ehMatriz(base)) {
          const i1 = await this.avaliar(alvo.indices[1]);
          base.definir(i0, i1, v, this.pos(alvo));
          return;
        }
        throw Diagnostics.criar("RUNTIME_INDICE", "Alvo não é vetor nem matriz", this.pos(alvo));
      }
      throw Diagnostics.criar("RUNTIME_NAO_DECLARADA", "Alvo de atribuição inválido", this.pos(alvo));
    }
  }

  /** Tipo do elemento de um vetor/matriz declarado por `vetor [a..b] de T`. */
  function elementoDe(d, runtime, nome) {
    // O parser guardou o tipo do elemento em `tipoElemento` quando presente.
    return d.tipoElemento || "real";
  }

  // A classe é exportada direto (como `Lexer` e `Parser`) porque `api.js` faz
  // `new VG.Runtime(...)`. `Environment` e `Scheduler` continuam sendo namespace,
  // porque a API deles é um conjunto de tipos.
  VG.Runtime = Runtime;
})(W.VG);
