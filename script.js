(function () {
  "use strict";
  var PREFIXO_ROTA = "#/ex/";
  var estado = {
    exercicio: null,
    rodando: false,
    parar: false,
    pendente: null
  };
  function $(id) {
    return document.getElementById(id);
  }
  var CHAVES = {};
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
    estado.exercicio = ex;
    $("tela-home").hidden = true;
    $("tela-exercicio").hidden = false;
    $("ex-titulo").textContent = ex.titulo || ex.id;
    $("ex-descricao").textContent = ex.descricao || "";
    $("ex-badge").textContent = badgeDoExercicio(ex);
    $("editor").value = typeof ex.codigo === "string" ? ex.codigo : "";
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
    if (!estado.rodando) return;
    estado.parar = true;
    if (estado.pendente) {
      var p = estado.pendente;
      estado.pendente = null;
      esconderEntrada();
      p.reject(new Error("interrompido"));
    }
  }
  function pararSeRodando() {
    if (estado.rodando) parar();
  }
  function restaurar() {
    if (!estado.exercicio) return;
    $("editor").value =
      typeof estado.exercicio.codigo === "string" ? estado.exercicio.codigo : "";
    realcar();
    $("editor").scrollTop = 0;
    $("editor").scrollLeft = 0;
    sincronizaScroll();
  }
  function sincronizaScroll() {
    var pre = $("editor-pre");
    pre.scrollTop = $("editor").scrollTop;
    pre.scrollLeft = $("editor").scrollLeft;
  }
  $("editor").addEventListener("input", realcar);
  $("editor").addEventListener("scroll", sincronizaScroll);
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

  atualizarBotoes();
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
