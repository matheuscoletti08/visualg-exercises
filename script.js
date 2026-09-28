(function () {
  "use strict";
  var PREFIXO_ROTA = "#/ex/";
  var estado = {
    exercicio: null,
    rodando: false,
    parar: false,
    pendente: null,
    tabLivre: false,
    // §40–§45: a sessão de depuração. `debug` só existe depois que o aluno
    // marca um breakpoint ou aperta Debug, e `modoDebug` é o que faz o botão
    // Executar passar a rodar por ele em vez do caminho direto.
    debug: null,
    modoDebug: false,
    sessao: null,
    // Último retrato emitido por `aoMudar`. É daqui que saem o estado, a linha
    // atual, as variáveis e a call stack que a UI desenha — ler o `Debug`
    // diretamente exigiria adivinhar o estado por inspectores que já não
    // existem (`status`, `currentSourceLocation`).
    retrato: null,
    linhaMarcada: null,
    linhasGutter: 0,
    // Código com que a sessão de debug foi criada. Se o aluno editar o editor
    // depois disso, `sessaoDebug()` recria a sessão em vez de depurar o
    // programa antigo com os passos novos.
    codigoDaSessao: null
  };
  function $(id) {
    return document.getElementById(id);
  }
  var CHAVES = {};
  // O painel §43–§45, criado uma vez e atualizado por `aoMudar`.
  var painelDebug = null;
  var LISTA_CHAVES =
    "algoritmo var inicio fimalgoritmo se senao fimse enquanto fimenquanto " +
    "faca repita ate para fimpara de passo escreva escreval leia inteiro real " +
    "caractere literal logico verdadeiro falso nao e ou mod div potencia";
  var tmpChaves = LISTA_CHAVES.split(" ");
  for (var kc = 0; kc < tmpChaves.length; kc++) CHAVES[tmpChaves[kc]] = true;
  function escapar(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function letra(c) {
    if (!c) return false;
    if (c === "_") return true;
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) return true;
    return c.charCodeAt(0) > 127;
  }
  function digito(c) {
    return c >= "0" && c <= "9";
  }
  function realceTrecho(txt) {
    var html = "";
    var i = 0;
    while (i < txt.length) {
      var c = txt.charAt(i);
      if (letra(c)) {
        var j = i;
        while (j < txt.length && (letra(txt.charAt(j)) || digito(txt.charAt(j)))) j++;
        var palavra = txt.slice(i, j);
        if (CHAVES[palavra.toLowerCase()]) {
          html += '<span class="tk">' + escapar(palavra) + "</span>";
        } else {
          html += escapar(palavra);
        }
        i = j;
        continue;
      }
      if (digito(c) || (c === "." && digito(txt.charAt(i + 1)))) {
        var k = i;
        while (digito(txt.charAt(k))) k++;
        if (txt.charAt(k) === "." && digito(txt.charAt(k + 1))) {
          k++;
          while (digito(txt.charAt(k))) k++;
        }
        html += '<span class="tk-num">' + escapar(txt.slice(i, k)) + "</span>";
        i = k;
        continue;
      }
      var dois = txt.slice(i, i + 2);
      if (dois === "<-" || dois === "<=" || dois === ">=" || dois === "<>") {
        html += '<span class="tk-op">' + escapar(dois) + "</span>";
        i += 2;
        continue;
      }
      if ("<>=+-*/%^(),:".indexOf(c) >= 0) {
        html += '<span class="tk-op">' + escapar(c) + "</span>";
        i++;
        continue;
      }
      html += escapar(c);
      i++;
    }
    return html;
  }
  function realceHtml(codigo) {
    var html = "";
    var modo = "fora";
    var buf = "";
    var aspa = "";
    var i = 0;
    function fechaFora() {
      if (buf) {
        html += realceTrecho(buf);
        buf = "";
      }
    }
    function fechaString() {
      if (buf) {
        html += '<span class="tk-str">' + escapar(buf) + "</span>";
        buf = "";
      }
    }
    function fechaComentario() {
      if (buf) {
        html += '<span class="tk-com">' + escapar(buf) + "</span>";
        buf = "";
      }
    }
    while (i < codigo.length) {
      var c = codigo.charAt(i);
      if (modo === "fora") {
        if (c === '"' || c === "'") {
          fechaFora();
          modo = "string";
          aspa = c;
          buf = c;
          i++;
        } else if (c === "/" && codigo.charAt(i + 1) === "/") {
          fechaFora();
          modo = "comentario";
          buf = "//";
          i += 2;
        } else {
          buf += c;
          i++;
        }
        continue;
      }
      if (modo === "string") {
        if (c === "\n") {
          fechaString();
          modo = "fora";
          buf = "";
          continue;
        }
        buf += c;
        i++;
        if (c === aspa && buf.length > 1) {
          fechaString();
          modo = "fora";
          buf = "";
        }
        continue;
      }
      if (c === "\n") {
        fechaComentario();
        modo = "fora";
        buf = "";
        continue;
      }
      buf += c;
      i++;
    }
    if (modo === "string") fechaString();
    else if (modo === "comentario") fechaComentario();
    else fechaFora();
    return html;
  }
  function realcar() {
    $("editor-pre").innerHTML = realceHtml($("editor").value);
    sincronizarGutter();
  }
  var ROTULO_GRUPO = {
    "faccat-p4": "operadores",
    "faccat-p5": "cálculo linear",
    "faccat-p5-6": "seleção",
    "faccat-p6-8": "seleção",
    "faccat-p8": "lógicos",
    "manzano-p25": "sequencial",
    "manzano-p26": "sequencial",
    "manzano-p46": "enquanto",
    "manzano-p50": "repita",
    "manzano-p66": "para"
  };
  function badgeDoExercicio(ex) {
    if (!ex) return "geral";
    if (ex.id === "playground") return "playground";
    return ROTULO_GRUPO[ex.grupo] || "geral";
  }
  function normalizar(t) {
    return String(t === null || t === undefined ? "" : t).toLowerCase();
  }
  function bateFiltro(ex, filtro) {
    return (
      normalizar(ex.id).indexOf(filtro) >= 0 ||
      normalizar(ex.titulo).indexOf(filtro) >= 0 ||
      normalizar(ex.descricao).indexOf(filtro) >= 0
    );
  }
  function montaCard(ex) {
    var a = document.createElement("a");
    a.className = "card";
    a.href = PREFIXO_ROTA + ex.id;
    var topo = document.createElement("div");
    topo.className = "card-topo";
    var titulo = document.createElement("span");
    titulo.className = "card-titulo";
    titulo.textContent = ex.titulo || ex.id;
    var badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = badgeDoExercicio(ex); badge.dataset.cat = badge.textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    topo.appendChild(titulo);
    topo.appendChild(badge);
    var desc = document.createElement("div");
    desc.className = "card-desc";
    desc.textContent = ex.descricao || "";
    a.appendChild(topo);
    a.appendChild(desc);
    return a;
  }
  function montaGrupo(grupo, itens) {
    var bloco = document.createElement("section");
    bloco.className = "grupo grupo--" + grupo.id;
    var cab = document.createElement("h2");
    cab.className = "grupo-cabecalho";
    var nome = document.createElement("span"); nome.className = "grupo-nome";
    nome.textContent = grupo.rotulo || grupo.id;
    var contagem = document.createElement("span");
    contagem.className = "grupo-contagem";
    contagem.textContent = itens.length + (itens.length === 1 ? " exercício" : " exercícios");
    cab.appendChild(nome);
    cab.appendChild(contagem);
    bloco.appendChild(cab);
    var cards = document.createElement("div");
    cards.className = "cards";
    for (var i = 0; i < itens.length; i++) cards.appendChild(montaCard(itens[i]));
    bloco.appendChild(cards);
    return bloco;
  }
  function renderHome() {
    var cont = $("lista-grupos");
    var aviso = $("aviso");
    cont.innerHTML = "";
    if (!window.GRUPOS || !window.EXERCICIOS) {
      aviso.hidden = false;
      aviso.textContent = "Gere data/exercises.js (node tools/gerar-exercicios.mjs)";
      return;
    }
    aviso.hidden = true;
    var filtro = normalizar($("busca").value);
    var grupos = window.GRUPOS.slice();
    grupos.sort(function (a, b) {
      return (a.ordem || 0) - (b.ordem || 0);
    });
    var total = 0;
    for (var g = 0; g < grupos.length; g++) {
      var grupo = grupos[g];
      var itens = [];
      for (var e = 0; e < window.EXERCICIOS.length; e++) {
        var ex = window.EXERCICIOS[e];
        if (ex.grupo !== grupo.id) continue;
        if (filtro && !bateFiltro(ex, filtro)) continue;
        itens.push(ex);
      }
      if (!itens.length) continue;
      total += itens.length;
      cont.appendChild(montaGrupo(grupo, itens));
    }
    if (!total) {
      var vazio = document.createElement("div");
      vazio.className = "vazio";
      vazio.textContent = "Nenhum exercício encontrado.";
      cont.appendChild(vazio);
    }
  }
  function mostrarHome() {
    pararSeRodando();
    limparSessaoDebug();
    $("tela-exercicio").hidden = true;
    $("tela-home").hidden = false;
    document.title = "VisualG — Exercícios";
    renderHome();
  }
  function abrirExercicio(id) {
    var ex = null;
    if (window.EXERCICIOS) {
      for (var i = 0; i < window.EXERCICIOS.length; i++) {
        if (window.EXERCICIOS[i].id === id) {
          ex = window.EXERCICIOS[i];
          break;
        }
      }
    }
    if (!ex) {
      mostrarHome();
      var aviso = $("aviso");
      aviso.hidden = false;
      aviso.textContent = "Exercício não encontrado: " + id;
      return;
    }
    pararSeRodando();
    limparSessaoDebug();
    estado.exercicio = ex;
    $("tela-home").hidden = true;
    $("tela-exercicio").hidden = false;
    $("ex-titulo").textContent = ex.titulo || ex.id;
    $("ex-descricao").textContent = ex.descricao || "";
    $("ex-badge").textContent = badgeDoExercicio(ex);
    $("editor").value = typeof ex.codigo === "string" ? ex.codigo : "";
    estado.tabLivre = false;
    destacarLinha(null);
    atualizarIndicadorTab();
    limparConsole();
    realcar();
    $("editor").scrollTop = 0;
    $("editor").scrollLeft = 0;
    sincronizaScroll();
    setStatus("Pronto");
    document.title = (ex.titulo || ex.id) + " — VisualG Exercícios";
    window.scrollTo(0, 0);
  }
  function rotear() {
    var hash = location.hash || "";
    if (hash.indexOf(PREFIXO_ROTA) === 0) {
      abrirExercicio(hash.slice(PREFIXO_ROTA.length));
    } else {
      mostrarHome();
    }
  }
  function setStatus(texto, classe) {
    var el = $("status");
    el.textContent = texto;
    ["executando", "erro", "interrompido"].forEach(function (c) { el.classList.toggle(c, c === classe); });
  }
  function atualizarBotoes() {
    $("btn-executar").disabled = estado.rodando;
    $("btn-parar").disabled = !estado.rodando;
    atualizarBotoesDebug();
  }
  function rolarConsole() {
    var pre = $("console-saida");
    pre.scrollTop = pre.scrollHeight;
  }
  function consoleAppend(texto) {
    var pre = $("console-saida");
    pre.appendChild(document.createTextNode(String(texto)));
    rolarConsole();
  }
  function consoleErro(texto) {
    var pre = $("console-saida");
    var span = document.createElement("span");
    span.className = "erro-consola";
    span.textContent = texto + "\n";
    pre.appendChild(span);
    rolarConsole();
  }
  function limparConsole() {
    $("console-saida").innerHTML = "";
  }
  function esconderEntrada() {
    $("console-entrada").hidden = true;
    $("console-input").value = "";
  }
  function pedirEntrada(dica) {
    return new Promise(function (resolve, reject) {
      estado.pendente = { resolve: resolve, reject: reject };
      $("console-dica").textContent = dica + ": ";
      $("console-entrada").hidden = false;
      var campo = $("console-input");
      campo.value = "";
      campo.focus();
      rolarConsole();
    });
  }
  function finalizar(res) {
    estado.rodando = false;
    estado.pendente = null;
    esconderEntrada();
    atualizarBotoes();
    if (!res) {
      setStatus("Erro", "erro");
      return;
    }
    if (res.ok) {
      setStatus("Pronto");
      return;
    }
    if (res.interrompido) {
      consoleErro("-- Execução interrompida --");
      setStatus("Interrompido", "interrompido");
      return;
    }
    if (res.erro) {
      var msg =
        typeof res.erro.linha === "number"
          ? "Linha " + res.erro.linha + ": " + res.erro.mensagem
          : String(res.erro.mensagem);
      consoleErro(msg);
      setStatus("Erro", "erro");
      return;
    }
    setStatus("Erro", "erro");
  }
  function executar() {
    if (estado.rodando) return;
    if (!window.Vg || typeof window.Vg.executar !== "function") {
      consoleErro("-- Interpretador não encontrado: confira interpreter/*.js --");
      setStatus("Erro", "erro");
      return;
    }
    // §41–§45: com breakpoint marcado ou com o modo Debug ligado, a execução
    // passa pelo `W.VG.Debugger`. Sem nenhum dos dois, o caminho direto continua
    // sendo o de sempre — o debugger não pode custar nada a quem não depura.
    if (estado.modoDebug || (estado.debug && estado.debug.linhas().length > 0)) {
      executarComDebug();
      return;
    }
    estado.rodando = true;
    estado.parar = false;
    atualizarBotoes();
    setStatus("Executando...", "executando");
    var contSaida = 0;
    var opcoes = {
      saida: function (texto) {
        consoleAppend(texto);
        contSaida++;
        if (contSaida % 250 === 0) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 0);
          });
        }
      },
      entrada: function (dica) {
        return pedirEntrada(dica);
      },
      deveParar: function () {
        return estado.parar;
      },
      maxPassos: 2000000
    };
    var promessa;
    try {
      promessa = window.Vg.executar($("editor").value, opcoes);
    } catch (e) {
      promessa = Promise.reject(e);
    }
    Promise.resolve(promessa).then(finalizar, function (e) {
      if (e && e.message === "interrompido") {
        finalizar({ ok: false, interrompido: true });
        return;
      }
      finalizar({
        ok: false,
        erro: { linha: null, mensagem: e && e.message ? e.message : String(e) }
      });
    });
  }
  function parar() {
    // §40 — `parar` é a válvula de escape. Ela não pode estar condicionada a
    // `estado.rodando`, que é um espelho do que a UI ACHA que acontece: se esse
    // espelho dessincroniza, o botão fica habilitado e não faz nada, que é a
    // pior combinação possível. O que decide é haver sessão viva.
    var temSessao = !!(estado.sessao && typeof estado.sessao.then === "function");
    var dbgVivo = !!(estado.debug && estado.retrato &&
      (estado.retrato.estado === "running" || estado.retrato.estado === "paused" ||
       estado.retrato.estado === "stepping" || estado.retrato.estado === "waiting_input"));
    if (!estado.rodando && !temSessao && !dbgVivo) return;
    estado.parar = true;
    if (estado.debug) {
      try {
        estado.debug.parar();
      } catch (e) {
        // Derrubar a sessão parada não pode impedir a troca de tela.
      }
    }
    if (estado.pendente) {
      var p = estado.pendente;
      estado.pendente = null;
      esconderEntrada();
      p.reject(new Error("interrompido"));
    }
    if (!estado.debug) {
      // Caminho sem debugger: o executor direto observa `deveParar`.
      estado.rodando = false;
      atualizarBotoes();
    }
  }
  function pararSeRodando() {
    if (estado.rodando) parar();
  }

  // ===========================================================================
  // §40–§45 — a sessão de depuração.
  //
  // `W.VG.Debugger` não sabe de DOM e `W.VGPlay.DebugPanels` não sabe de
  // runtime: este bloco é a cola. Ele cria o `Debug` uma vez, liga o painel
  // aos eventos de `aoMudar` e traduz cada comando (§40) num clique de botão.
  // ===========================================================================
  /**
   * §40–§45 — derruba a sessão de depuração por completo.
   *
   * Chamada de TODO caminho que troca ou reinicia o código: abrir outro
   * exercício, voltar para a home, e "Restaurar original". Sem ela, a sessão
   * sobrevivia à troca de programa com o código velho dentro do `Debug`, os
   * breakpoints da linha 8 apontando para linhas de outro exercício, e os painéis
   * mostrando variáveis que não existem mais. `sessaoDebug()` reaproveita o
   * objeto existente, então descartar a referência é o que faz a próxima
   * depuração nascer do programa novo.
   */
  /**
   * O retrato que a UI desenha quando não há sessão — trocar de exercício, abrir
   * um arquivo, limpar o console.
   *
   * Ele é do MESMO formato de `Debug.retrato()`. A versão anterior era um híbrido
   * dos dois formatos (`variaveis.locais`, `status`, `currentSourceLocation`,
   * `stepMode`, `executionStats`), e o painel lia metade dos campos: o estado
   * vazio era a única pintura que nunca mostrava uma fita coerente. Um objeto
   * que finge ser um retrato tem que ter a forma do retrato.
   */
  var ESTADO_DEBUG_VAZIO = {
    estado: "idle",
    pausado: false,
    motivo: null,
    executionPoint: null,
    callStack: [],
    variaveis: { globais: [], quadros: [], foco: 0 },
    perfil: [],
    perfilPorLinha: [],
    breakpoints: [],
    condicionais: [],
    watches: [],
    quadroFocado: 0,
    variavelModificada: null,
    erro: null,
    stats: null
  };
  function limparSessaoDebug() {
    if (estado.debug && typeof estado.debug.parar === "function") {
      try {
        estado.debug.parar();
      } catch (e) {
        // Derrubar sessão parada não pode impedir a troca de tela.
      }
    }
    estado.debug = null;
    estado.modoDebug = false;
    estado.sessao = null;
    estado.retrato = null;
    estado.rodando = false;
    estado.parar = false;
    estado.codigoDaSessao = null;
    estado.linhasGutter = -1;
    estado.linhaMarcada = null;
    destacarLinha(null);
    marcarGutter();
    mostrarPaineisDebug(false);
    if (painelDebug) {
      try {
        painelDebug.atualizar(ESTADO_DEBUG_VAZIO);
      } catch (e) {
        // Painel quebrado não impede a troca de tela.
      }
    }
    var botaoDebug = $("btn-debug");
    if (botaoDebug) {
      botaoDebug.setAttribute("aria-pressed", "false");
      botaoDebug.classList.remove("primario");
      botaoDebug.classList.add("tonal");
    }
    atualizarBotoesDebug();
  }
  function sessaoDebug() {
    var codigoAtual = $("editor").value;
    if (estado.debug) {
      // Se o aluno editou o código depois da sessão nascer, a sessão aponta para
      // um programa que não existe mais. Recriar aqui evita que "Passo ▸" avance
      // linhas do texto antigo — que é a forma mais confusa de depurar errado,
      // porque a linha realçada não bate com o texto na tela.
      if (estado.codigoDaSessao !== codigoAtual) {
        limparSessaoDebug();
      } else {
        return estado.debug;
      }
    }
    if (!window.VG || !window.VG.Debugger) {
      consoleErro("-- Debugger não carregado: confira src/visualg/debugger.js --");
      return null;
    }
    estado.codigoDaSessao = codigoAtual;
    estado.debug = window.VG.Debugger.criar(codigoAtual, {
      saida: function (texto) {
        consoleAppend(texto);
      },
      entrada: function (dica) {
        return pedirEntrada(dica);
      },
      // §41: uma linha por comando. Só repinta quando a linha MUDA — num laço
      // de 200 mil voltas, repintar a cada comando é o que derruba a aba.
      aoLinha: function (linha) {
        if (linha === estado.linhaMarcada) return;
        destacarLinha(linha);
      },
      maxPassos: 2000000
    });
    // O retrato é o ÚNICO estado que a UI lê. A versão anterior lia
    // `currentSourceLocation.linha`, que não existe: o ponto vem em
    // `executionPoint.sourceLine` (§28.1, derivado da AST). Ler o campo errado
    // dava `null` sempre, e a linha realçada nunca acompanhava a pausa.
    estado.debug.aoMudar(function (retrato) {
      estado.retrato = retrato;
      var ponto = retrato && retrato.executionPoint;
      var linha = ponto && typeof ponto.sourceLine === "number" ? ponto.sourceLine : null;
      if (linha !== estado.linhaMarcada) {
        estado.linhaMarcada = linha;
        destacarLinha(linha);
        if (retrato && retrato.pausado && linha != null) centralizarLinha(linha);
      }
      if (painelDebug) painelDebug.atualizar(retrato);
      atualizarBotoesDebug();
      atualizarStatusDebug(retrato);
    });
    return estado.debug;
  }
  function executarComDebug() {
    var dbg = sessaoDebug();
    if (!dbg) {
      estado.modoDebug = false;
      return;
    }
    if (estado.rodando) return;
    estado.modoDebug = true;
    mostrarPaineisDebug(true);
    limparConsole();
    estado.rodando = true;
    estado.parar = false;
    atualizarBotoes();
    setStatus("Executando...", "executando");
    destacarLinha(null);
    // `executar()`, e não `iniciar()`: o método da API nova se chama `executar`
    // e devolve a promessa DA SESSÃO INTEIRA. A versão anterior chamava
    // `iniciar()`, que não existe mais — o `TypeError` subia antes de
    // `estado.sessao` ser preenchido, e `estado.rodando` ficava ligado para
    // sempre. Era esse o travamento: um throw síncrono deixava a UI convicta de
    // que havia execução em curso, com todos os botões desabilitados e nenhum
    // caminho para desligar isso.
    var promessa;
    try {
      promessa = dbg.executar();
    } catch (e) {
      estado.rodando = false;
      estado.retrato = null;
      consoleErro(String((e && e.message) || e));
      setStatus("Erro", "erro");
      atualizarBotoes();
      atualizarBotoesDebug();
      return;
    }
    estado.sessao = promessa;
    Promise.resolve(promessa).then(aoTerminarSessao, aoTerminarSessao);
  }
  /** O status segue o retrato, para que Pausado/Começar não dependam do clique. */
  function atualizarStatusDebug(retrato) {
    if (!retrato) return;
    if (retrato.pausado) {
      setStatus(
        "Pausado (linha " + (retrato.executionPoint ? retrato.executionPoint.sourceLine : "?") + ")",
        "interrompido"
      );
      return;
    }
    if (retrato.estado === "running" || retrato.estado === "stepping") {
      setStatus("Executando...", "executando");
    }
  }
  function aoTerminarSessao(r) {
    estado.rodando = false;
    estado.sessao = null;
    esconderEntrada();
    // `estado.retrato` é zerado junto: sem isto, a UI continuaria desenhando as
    // variáveis e a linha do ÚLTIMO instante como se a execução estivesse no ar,
    // e o botão Continuar voltava a parecer disponível para uma sessão morta.
    estado.retrato = null;
    estado.linhaMarcada = null;
    destacarLinha(null);
    atualizarBotoes();
    atualizarBotoesDebug();
    if (r && r.ok) {
      setStatus("Pronto");
      return;
    }
    if (r && r.interrompido) {
      consoleErro("-- Execução interrompida --");
      setStatus("Interrompido", "interrompido");
      return;
    }
    var erro = r && r.erro;
    if (erro) {
      var onde = typeof erro.sourceLine === "number" ? "Linha " + erro.sourceLine + ": " : "";
      consoleErro(onde + String(erro.mensagem || erro.message || erro));
      setStatus("Erro", "erro");
      return;
    }
    setStatus("Pronto");
  }
  /**
   * Um comando §40 por função: `acao` é o método do `Debug`.
   *
   * Os comandos de depuração NÃO devolvem promessa. `passo`, `continuar` e
   * `parar` devolvem booleano — a promessa pendente é a da SESSÃO, uma só, criada
   * em `executar()`. A versão anterior tratava cada comando como se devolvesse
   * uma promessa nova e encadeava `.then()` nisso: `false.then` é `TypeError`,
   * o throw saía do clique DEPOIS de `estado.rodando = true`, e o resultado era o
   * botão Passo travando o programa e todos os controles morrendo junto, sem
   * caminho para recuperar.
   *
   * A UI se atualiza pelo `aoMudar`, que dispara a cada mudança de estado.
   */
  function comandoDebug(acao, argumento) {
    var dbg = sessaoDebug();
    if (!dbg) return;
    if (estado.modoDebug) mostrarPaineisDebug(true);
    var r = dbg[acao](argumento);
    if (r === false && acao !== "parar") {
      // O runtime recusou o comando (não está pausado, sessão encerrada). Não é
      // erro, mas o aluno precisa de retorno: sem isto, apertar Passo fora de
      // uma pausa não dá nenhuma pista do porquê.
      setStatus("Nada a avançar: a execução não está pausada", "interrompido");
    }
    atualizarBotoesDebug();
  }
  function mostrarPaineisDebug(visivel) {
    var caixa = $("dbg-caixa");
    if (caixa) caixa.hidden = !visivel;
  }
  function montarPaineisDebug() {
    if ($("dbg-caixa") || !window.VGPlay || !window.VGPlay.DebugPanels) return;
    var tela = $("tela-exercicio");
    if (!tela) return;
    var caixa = document.createElement("div");
    caixa.id = "dbg-caixa";
    caixa.className = "dbg-painel-caixa";
    caixa.hidden = true;
    tela.appendChild(caixa);
    // `criar` só monta o que o chamador pedir: nada é criado no carregamento do
    // módulo, e `doc` é injetado para o mesmo código servir no browser e no teste.
    painelDebug = window.VGPlay.DebugPanels.criar({
      doc: document,
      aoEscolherFrame: function (profundidade) {
        if (estado.debug) estado.debug.focar(profundidade);
      },
      aoEscolherLinha: function (linha) {
        centralizarLinha(linha);
      }
    });
    caixa.appendChild(painelDebug.raiz);
  }
  function criarBotoesDebug() {
    var botoes = document.querySelector(".botoes");
    if (!botoes || $("btn-debug")) return;
    // §40 — o botão "Debug" fica SEMPRE visível: é por ele que se liga o modo
    // depuração na primeira vez. Sem breakpoint e sem modo ligado, o resto do
    // grupo some — quem não depura não paga por nenhum deles.
    var debug = document.createElement("button");
    debug.id = "btn-debug";
    debug.type = "button";
    debug.className = "btn tonal";
    debug.setAttribute("aria-pressed", "false");
    debug.title = "Alterna o modo de depuração (passo a passo, breakpoints e painéis)";
    var iconeDebug = document.createElement("span");
    iconeDebug.className = "btn-icone";
    iconeDebug.setAttribute("aria-hidden", "true");
    debug.appendChild(iconeDebug);
    debug.appendChild(document.createTextNode("Debug"));
    botoes.insertBefore(debug, $("btn-restaurar"));

    var grupo = document.createElement("div");
    grupo.className = "btn-group";
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Comandos de depuração");
    grupo.id = "botoes-debug";
    grupo.hidden = true;
    var modelos = [
      ["btn-continuar", "Continuar", "tonal"],
      ["btn-passo", "Passo \u25b8", "outlined"],
      ["btn-dentro", "Passo \u21a7", "outlined"],
      ["btn-fora", "Passo \u21a5", "outlined"],
      ["btn-limpar-bp", "Limpar bp", "texto"]
    ];
    for (var i = 0; i < modelos.length; i++) {
      var b = document.createElement("button");
      b.id = modelos[i][0];
      b.type = "button";
      b.className = "btn " + modelos[i][2];
      b.title = modelos[i][1];
      var icone = document.createElement("span");
      icone.className = "btn-icone";
      icone.setAttribute("aria-hidden", "true");
      b.appendChild(icone);
      b.appendChild(document.createTextNode(modelos[i][1]));
      grupo.appendChild(b);
    }
    botoes.appendChild(grupo);
    debug.addEventListener("click", function () {
      estado.modoDebug = !estado.modoDebug;
      atualizarBotoesDebug();
      if (estado.modoDebug) {
        mostrarPaineisDebug(true);
        var dbg = sessaoDebug();
        if (dbg && painelDebug) painelDebug.atualizar(dbg.estadoDebug());
      } else {
        mostrarPaineisDebug(false);
      }
    });
    $("btn-continuar").addEventListener("click", function () {
      comandoDebug("continuar");
    });
    $("btn-passo").addEventListener("click", function () {
      if (!window.VG || !window.VG.Debugger) return;
      comandoDebug("passo", window.VG.Debugger.PASSO.SOBRE);
    });
    $("btn-dentro").addEventListener("click", function () {
      if (!window.VG || !window.VG.Debugger) return;
      comandoDebug("passo", window.VG.Debugger.PASSO.DENTRO);
    });
    $("btn-fora").addEventListener("click", function () {
      if (!window.VG || !window.VG.Debugger) return;
      comandoDebug("passo", window.VG.Debugger.PASSO.FORA);
    });
    $("btn-limpar-bp").addEventListener("click", function () {
      // `limparBreakpoints()`, e não `limpar()`: o método antigo foi removido,
      // e esta linha era o que estourava ao limpar todos os breakpoints.
      if (estado.debug) estado.debug.limparBreakpoints();
      marcarGutter();
      atualizarBotoesDebug();
    });
  }
  function atualizarBotoesDebug() {
    var dbg = estado.debug;
    // O retrato é a fonte da verdade. A versão anterior olhava `debug.status`,
    // campo que não existe na API: o estado vive em `retrato.estado`, e ler um
    // campo inexistente dava `undefined`, então `pausado` era SEMPRE falso e
    // todo botão ficava habilitado fora de hora — inclusive o Passo, que é
    // exatamente o botão que trava o aluno quando mente sobre o estado.
    var r = estado.retrato;
    var pausado = !!(r && r.pausado);
    var executando = !!(r && (r.estado === "running" || r.estado === "stepping"));
    var temBp = !!dbg && dbg.linhas().length > 0;
    var botaoDebug = $("btn-debug");
    if (botaoDebug) {
      botaoDebug.classList.toggle("tonal", !estado.modoDebug);
      botaoDebug.classList.toggle("primario", estado.modoDebug);
      botaoDebug.setAttribute("aria-pressed", estado.modoDebug ? "true" : "false");
    }
    var grupo = $("botoes-debug");
    if (!grupo) return;
    grupo.hidden = !(estado.modoDebug || temBp);
    // `parado` é o que trava a execução, não `rodando`. Durante uma pausa a
    // sessão está VIVA, e Continuar precisa ficar clicável — foi o inverso disso
    // que deixava o aluno preso numa pausa sem botão para sair.
    $("btn-continuar").disabled = !pausado;
    $("btn-passo").disabled = !pausado;
    $("btn-dentro").disabled = !pausado;
    $("btn-fora").disabled = !pausado;
    $("btn-limpar-bp").disabled = !temBp;
    if (executando) {
      $("btn-continuar").disabled = true;
      $("btn-passo").disabled = true;
      $("btn-dentro").disabled = true;
      $("btn-fora").disabled = true;
    }
  }
  function restaurar() {
    if (!estado.exercicio) return;
    pararSeRodando();
    // "Restaurar original" devolve o código do exercício, então a sessão de
    // depuração tem que morrer junto: senão ela fica com o texto que o aluno
    // tinha editado, e o próximo Passo avança um programa que saiu da tela.
    limparSessaoDebug();
    $("editor").value =
      typeof estado.exercicio.codigo === "string" ? estado.exercicio.codigo : "";
    destacarLinha(null);
    realcar();
    $("editor").scrollTop = 0;
    $("editor").scrollLeft = 0;
    sincronizaScroll();
    setStatus("Pronto");
  }
  function sincronizaScroll() {
    var pre = $("editor-pre");
    pre.scrollTop = $("editor").scrollTop;
    pre.scrollLeft = $("editor").scrollLeft;
    rolarGutter();
    posicionarLinhaAtual();
  }

  // ===========================================================================
  // §41/§42 — gutter de breakpoints e destaque da linha atual.
  //
  // O gutter é criado por JS e inserido DENTRO de `.editor-wrap`, ao lado de
  // `#editor-pre` e `#editor`. Não podia vir do `index.html` porque o gutter é
  // uma linha por linha do código, e o número delas muda a cada tecla.
  //
  // As duas invariantes que não podem quebrar:
  //   · o gutter rola JUNTO com o código (mesma linha visual, sempre);
  //   · a altura da linha do gutter é a MESMA caixa de linha do código
  //     (`--md-ext-code-line-box`), e não a linha de base da fonte menor do
  //     gutter — se divergirem, os números saem de etiqueta depois da terceira
  //     linha e o clique marca a linha errada.
  // ===========================================================================
  function criarGutter() {
    var wrap = document.querySelector(".editor-wrap");
    if (!wrap || $("editor-gutter")) return;
    var gutter = document.createElement("div");
    gutter.id = "editor-gutter";
    gutter.className = "editor-gutter";
    gutter.setAttribute("role", "group");
    gutter.setAttribute("aria-label", "Breakpoints: clique no número de uma linha para marcar ou desmarcar");
    wrap.insertBefore(gutter, wrap.firstChild);

    var atual = document.createElement("div");
    atual.id = "editor-linha-atual";
    atual.className = "editor-linha-atual";
    atual.hidden = true;
    wrap.insertBefore(atual, gutter.nextSibling);

    gutter.addEventListener("click", function (ev) {
      var alvo = ev.target && ev.target.closest ? ev.target.closest(".editor-gutter-linha") : null;
      if (!alvo) return;
      alternarBreakpoint(Number(alvo.getAttribute("data-linha")));
    });
  }
  // Cada linha do gutter é um `<button>` com `data-linha`: a margem é pequena e
  // um `div` sem foco não seria alcançável pelo teclado. O botão inteiro é o
  // alvo clicável, não só o número.
  function totalDeLinhas(texto) {
    return String(texto).split("\n").length;
  }
  /**
   * Reconstroi o gutter quando a QUANTIDADE de linhas muda, e só marca/desmarca
   * quando ela não muda. Um botão por linha a cada tecla seria centenas de nós
   * recriados por caractere digitado.
   *
   * O `padding-bottom` do gutter é o mesmo do editor DE PROPÓSITO: sem ele, a
   * altura rolável do gutter é menor que a do `textarea`, `scrollTop` satura
   * antes da hora e a coluna de números sai de etiqueta na segunda dobra de
   * rolagem. `rolarGutter` depende disso.
   */
  function sincronizarGutter() {
    var gutter = $("editor-gutter");
    if (!gutter) return;
    var linhas = totalDeLinhas($("editor").value);
    if (linhas !== estado.linhasGutter) {
      estado.linhasGutter = linhas;
      var html = "";
      for (var i = 1; i <= linhas; i++) html += '<button type="button" class="editor-gutter-linha" data-linha="' + i + '" aria-pressed="false" aria-label="Breakpoint na linha ' + i + '">' + i + "</button>";
      gutter.innerHTML = html;
      rolarGutter();
    }
    marcarGutter();
  }
  /**
   * Rola a coluna de números junto com o código.
   *
   * `overflow: hidden` no CSS, e não `auto`: a caixa continua rolável por script
   * (é o truque padrão), e assim o gutter nunca mostra uma barra de rolagem
   * própria para roubar a attention de quem está lendo código.
   */
  function rolarGutter() {
    var gutter = $("editor-gutter");
    if (gutter) gutter.scrollTop = $("editor").scrollTop;
  }
  /** Aplica a sessão de depuração (linhas marcadas + linha atual) no gutter. */
  function marcarGutter() {
    var gutter = $("editor-gutter");
    if (!gutter) return;
    var botoes = gutter.querySelectorAll(".editor-gutter-linha");
    var debug = estado.debug;
    for (var i = 0; i < botoes.length; i++) {
      var b = botoes[i];
      var n = Number(b.getAttribute("data-linha"));
      var marcado = !!(debug && debug.tem(n));
      b.classList.toggle("com-breakpoint", marcado);
      b.setAttribute("aria-pressed", marcado ? "true" : "false");
      b.classList.toggle("atual", n === estado.linhaMarcada);
    }
  }
  /**
   * §41 — a caixa do destaque, na posição da linha corrente DENTRO da área
   * visível. Só o `top` muda; a altura é a caixa de linha do próprio `textarea`.
   */
  function posicionarLinhaAtual() {
    var caixa = $("editor-linha-atual");
    if (!caixa || estado.linhaMarcada === null) return;
    // A conta é feita em JS, e não em `calc()` com `--md-ext-code-line-height`,
    // porque esse token é um multiplicador (1.5) e não um comprimento: em
    // `calc` a multiplicação seria número × número × comprimento, que só
    // resolve enquanto o token continuar sendo adimensional.
    var ed = $("editor");
    var estilo = window.getComputedStyle(ed);
    var alturaLinha = parseFloat(estilo.lineHeight);
    if (!isFinite(alturaLinha) || alturaLinha <= 0) alturaLinha = 21;
    var padTop = parseFloat(estilo.paddingTop) || 0;
    var topo = padTop + (estado.linhaMarcada - 1) * alturaLinha - ed.scrollTop;
    caixa.hidden = false;
    caixa.style.top = Math.round(topo) + "px";
    caixa.style.height = alturaLinha + "px";
  }
  /** §41 — destaca a linha corrente, e rola o editor até ela. */
  function destacarLinha(linha) {
    estado.linhaMarcada = typeof linha === "number" ? linha : null;
    var caixa = $("editor-linha-atual");
    if (!caixa) return;
    if (estado.linhaMarcada === null) {
      caixa.hidden = true;
      marcarGutter();
      return;
    }
    posicionarLinhaAtual();
    marcarGutter();
  }
  /** Rola o editor só quando a linha está fora da vista (§41, "quando fizer sentido"). */
  function centralizarLinha(linha) {
    if (typeof linha !== "number") return;
    var ed = $("editor");
    var estilo = window.getComputedStyle(ed);
    var alturaLinha = parseFloat(estilo.lineHeight) || 21;
    var topo = (parseFloat(estilo.paddingTop) || 0) + (linha - 1) * alturaLinha;
    var visivel = ed.clientHeight - alturaLinha;
    if (topo < ed.scrollTop || topo > ed.scrollTop + visivel) {
      ed.scrollTop = Math.max(0, topo - ed.clientHeight / 2);
      sincronizaScroll();
    }
  }
  function alternarBreakpoint(linha) {
    if (!linha || !isFinite(linha)) return;
    var dbg = sessaoDebug();
    if (!dbg) return;
    dbg.alternar(linha);
    marcarGutter();
    // Marcar um breakpoint já é intenção de depurar: os painéis entram junto.
    if (dbg.linhas().length > 0) {
      mostrarPaineisDebug(true);
      if (painelDebug) painelDebug.atualizar(dbg.estadoDebug());
    }
    atualizarBotoesDebug();
  }
  var TAB_ESPACOS = 4;
  var BLOCO_ESPACOS = "    ";
  var SELETOR_FOCAVEIS =
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";
  var DICA_TAB =
    "Tab insere 4 espaços. Shift+Tab recua a indentação. Esc tira o foco do editor e devolve o Tab à navegação.";
  var DICA_TAB_LIVRE =
    "Tab liberado: Tab agora move o foco entre os controles da página. O editor volta a indentar quando receber o foco de novo.";
  function limiteLinha(txt, pos) {
    var ini = pos <= 0 ? 0 : txt.lastIndexOf("\n", pos - 1) + 1;
    var fim = txt.indexOf("\n", pos);
    if (fim < 0) fim = txt.length;
    return { ini: ini, fim: fim };
  }
  function trocarTexto(valor, ini, fim) {
    var el = $("editor");
    var st = el.scrollTop;
    var sl = el.scrollLeft;
    el.value = valor;
    el.setSelectionRange(ini, fim);
    realcar();
    el.scrollTop = st;
    el.scrollLeft = sl;
    sincronizaScroll();
  }
  function indentar() {
    var el = $("editor");
    var txt = el.value;
    var ini = el.selectionStart;
    var fim = el.selectionEnd;
    if (ini === fim) {
      trocarTexto(
        txt.slice(0, ini) + BLOCO_ESPACOS + txt.slice(fim),
        ini + TAB_ESPACOS,
        ini + TAB_ESPACOS
      );
      return;
    }
    var primeira = limiteLinha(txt, ini);
    var ult = limiteLinha(txt, fim);
    var linhas = txt.slice(primeira.ini, ult.fim).split("\n");
    var desloca = TAB_ESPACOS * linhas.length;
    var corpo = "";
    for (var i = 0; i < linhas.length; i++) {
      corpo += (i ? "\n" : "") + BLOCO_ESPACOS + linhas[i];
    }
    trocarTexto(
      txt.slice(0, primeira.ini) + corpo + txt.slice(ult.fim),
      ini + desloca,
      fim + desloca
    );
  }
  function desindentar() {
    var el = $("editor");
    var txt = el.value;
    var primeira = limiteLinha(txt, el.selectionStart);
    var ult = limiteLinha(txt, el.selectionEnd);
    var linhas = txt.slice(primeira.ini, ult.fim).split("\n");
    var tira = [];
    var corpo = "";
    var total = 0;
    for (var i = 0; i < linhas.length; i++) {
      var q = 0;
      while (q < TAB_ESPACOS && linhas[i].charAt(q) === " ") q++;
      tira.push(q);
      total += q;
      corpo += (i ? "\n" : "") + linhas[i].slice(q);
    }
    if (!total) return;
    function novoPos(pos) {
      var antes = txt.slice(primeira.ini, pos);
      var k = antes.split("\n").length - 1;
      var base = primeira.ini + antes.lastIndexOf("\n") + 1;
      var d = 0;
      for (var n = 0; n < k; n++) d += tira[n];
      return base + Math.max(0, pos - base - tira[k]) - d;
    }
    trocarTexto(
      txt.slice(0, primeira.ini) + corpo + txt.slice(ult.fim),
      novoPos(el.selectionStart),
      novoPos(el.selectionEnd)
    );
  }
  function proximoFocavel(depois) {
    var todos = document.querySelectorAll(SELETOR_FOCAVEIS);
    for (var i = 0; i < todos.length; i++) {
      if (todos[i] !== depois) continue;
      for (var j = i + 1; j < todos.length; j++) {
        if (todos[j].offsetParent !== null) return todos[j];
      }
      return null;
    }
    return null;
  }
  function atualizarIndicadorTab() {
    var livre = estado.tabLivre;
    var dica = $("editor-dica-tab");
    var texto = livre ? DICA_TAB_LIVRE : DICA_TAB;
    if (dica.textContent !== texto) dica.textContent = texto;
    var pilula = $("editor-indicador-tab");
    pilula.hidden = !livre;
    pilula.textContent = livre ? "Tab livre" : "";
  }
  function montarIndicadorTab() {
    var dica = document.createElement("span");
    dica.id = "editor-dica-tab";
    dica.className = "rotulo-visual-oculto";
    dica.setAttribute("role", "status");
    dica.setAttribute("aria-live", "polite");
    var pilula = document.createElement("span");
    pilula.id = "editor-indicador-tab";
    pilula.className = "editor-indicador";
    pilula.setAttribute("aria-hidden", "true");
    pilula.hidden = true;
    var botoes = document.querySelector(".botoes");
    botoes.appendChild(dica);
    botoes.appendChild(pilula);
    $("editor").setAttribute("aria-describedby", dica.id);
    $("editor").setAttribute("aria-keyshortcuts", "Escape");
    atualizarIndicadorTab();
  }
  function liberarTab() {
    estado.tabLivre = true;
    atualizarIndicadorTab();
    var alvo = proximoFocavel($("editor"));
    $("editor").blur();
    if (alvo) alvo.focus();
  }
  $("editor").addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      liberarTab();
      return;
    }
    if (e.key !== "Tab") return;
    if (estado.tabLivre) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (e.shiftKey) desindentar();
    else indentar();
  });
  $("editor").addEventListener("focus", function () {
    estado.tabLivre = false;
    atualizarIndicadorTab();
  });
  $("editor").addEventListener("input", realcar);
  $("editor").addEventListener("scroll", sincronizaScroll);
  $("editor").addEventListener("click", function () {
    // O gutter é uma coluna separada: clicar nele não move o cursor do
    // `textarea`, que é o que se espera de uma margem de depuração.
    if (estado.linhaMarcada !== null) destacarLinha(estado.linhaMarcada);
  });
  $("btn-executar").addEventListener("click", executar);
  $("btn-parar").addEventListener("click", parar);
  $("btn-limpar").addEventListener("click", limparConsole);
  $("btn-restaurar").addEventListener("click", restaurar);
  $("busca").addEventListener("input", renderHome);
  $("console-input").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!estado.pendente) return;
    var valor = $("console-input").value;
    var p = estado.pendente;
    estado.pendente = null;
    var dica = $("console-dica").textContent;
    esconderEntrada();
    consoleAppend(dica + valor + "\n");
    p.resolve(valor);
  });
  window.addEventListener("hashchange", rotear);
  var PLAYGROUND = {
    id: "playground",
    grupo: "playground",
    titulo: "Playground",
    descricao: "Área livre: escreva um algoritmo e clique em Executar.",
    codigo: [
      'Algoritmo "playground"',
      "// Descricao   : Área livre. Edite o código e clique em Executar para rodar.",
      "Var",
      "   x: inteiro",
      "",
      "Inicio",
      '   escreval("Digite um inteiro: ")',
      "   leia(x)",
      "   se (x % 2 = 0) entao",
      '      escreval(x, " e par")',
      "   senao",
      '      escreval(x, " e ímpar")',
      "   fimse",
      "Fimalgoritmo",
      ""
    ].join("\n")
  };
  if (window.EXERCICIOS) window.EXERCICIOS.unshift(PLAYGROUND);

  montarIndicadorTab();
  // §41–§45: o gutter tem de existir ANTES do primeiro `realcar()` (é o
  // `realcar` que sincroniza a contagem de linhas dele), e o painel antes do
  // primeiro `rotear()` (é `abrirExercicio` que o mostra).
  criarGutter();
  montarPaineisDebug();
  criarBotoesDebug();
  atualizarBotoes();
  atualizarBotoesDebug();
  rotear();
  $("lista-grupos").dataset.rendered = "1";
  document.addEventListener("pointerdown", function (ev) {
    var el = ev.target.closest && ev.target.closest(".btn, .botoes button, .card, .playground"); if (!el) return;
    var r = el.getBoundingClientRect(), s = el.style;
    s.setProperty("--rip-x", ev.clientX - r.left + "px"); s.setProperty("--rip-y", ev.clientY - r.top + "px");
    el.classList.remove("rippling"); void el.offsetWidth; el.classList.add("rippling");
    el.addEventListener("animationend", function (e2) { if (e2.target === el) el.classList.remove("rippling"); }, { once: true });
  });
})();
