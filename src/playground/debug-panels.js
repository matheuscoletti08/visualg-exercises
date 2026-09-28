// §43 VARIÁVEIS, §44 CALL STACK, §45 PERFIL — os painéis do debugger.
//
// ---------------------------------------------------------------------------
// A DIVISÃO QUE ESTE ARQUIVO FAZ
// ---------------------------------------------------------------------------
//
// Duas camadas, e a separação é o requisito, não estilo:
//
//   1. `dadosX(estadoDebug)` / `htmlX(estadoDebug)` — PURE. Recebem o
//      `DebugState` que `W.VG.Debugger` devolve e devolvem estrutura (ou a
//      string HTML equivalente). Não conhecem `document`, não guardam estado, não
//      leem nada de fora. É essa camada que o teste de Node exercita.
//   2. `criar(opcoes)` — a LIGAÇÃO. Recebe o `doc` (injetável), monta o DOM a
//      partir das estruturas da camada 1, e chama os callbacks de clique. Não
//      monta nada por conta própria: se ninguém chamar `criar`, nada aparece na
//      página.
//
// Nada é montado no carregamento do módulo. `script.js` é quem decide se a
// página tem painéis de debug e onde eles ficam.
//
// Sem `eval`, sem `new Function`, sem `fetch`, sem `localStorage` e sem
// `innerHTML`: o DOM é montado com `createElement`/`textContent`, o que também
// mata de passagem a classe de bug em que o valor de uma variável vira marcação.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  /** Texto que pode ir para dentro de HTML ou para `textContent`. */
  function escapar(t) {
    return String(t === null || t === undefined ? "" : t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Rótulos de §35, para o painel não ter a tabela de estados espalhada na UI.
   *
   * As chaves são os valores REAIS de `Scheduler.ESTADO`, não nomes em português
   * inventados aqui. A tabela antiga (`parado`, `executando`, `pausado`) era de
   * uma versão do scheduler que nunca existiu nesta forma: o runtime sempre
   * emitiu `running`/`paused`/`stepping`/..., e cada lookup caía no `||` de
   * baixo, jogando o estado cru em inglês na fita. As chaves antigas ficam como
   * aliases, para um retrato legado não virar `undefined`.
   */
  const ROTULO_ESTADO = {
    idle: "Parado",
    running: "Executando",
    stepping: "Executando",
    paused: "Pausado",
    waiting_input: "Aguardando entrada",
    stopped: "Parado",
    finished: "Concluído",
    error: "Erro",
    // aliases legados
    parado: "Parado",
    executando: "Executando",
    pausado: "Pausado",
    aguardando_entrada: "Aguardando entrada",
    concluido: "Concluído",
    erro: "Erro",
  };

  /**
   * Rótulos do MOTIVO da pausa. O motivo vem de `Debugger.MOTIVO`, e é ele — e
   * não o modo de passo — que diz por que o programa parou. `breakpoint` é o
   * caso comum e o que o aluno mais vê, então rotulá-lo importava.
   */
  const ROTULO_PASSO = {
    sobre: "Passo sobre",
    dentro: "Passo dentro",
    fora: "Passo fora",
    inicio: "Passo",
    breakpoint: "Breakpoint",
    condicional: "Breakpoint condicional",
    run_to_cursor: "Até a linha",
    // §22 / §23 — pausa pedida pelo programa, não pela UI.
    source_pause: "Pausa do programa",
    conditional_debug: "Debug do programa",
    pause_requested: "Pausa pedida",
  };

  const LIMITE_PERFIL = 30;

  function totalDe(dados) {
    let n = 0;
    for (const g of dados.grupos) n += g.linhas.length;
    return n;
  }

  // ------------------------------------------------------------------ §43 dados

  /**
   * §43 — o painel de variáveis, como DADOS.
   *
   * Sai em grupos porque o spec pede escopo: o frame corrente em cima, as
   * globais embaixo. Um vetor/matriz vira as linhas indexadas do exemplo
   * (`[1] 8.5`), e o que nunca foi atribuído aparece como tal — o `preenchido`
   * do `values.js` existe para separar "valor zero" de "ainda vazio".
   */
  function dadosVariaveis(retrato, opcoes) {
    const o = opcoes || {};
    const vazio = { escopo: "global", grupos: [], total: 0 };
    if (!retrato || !retrato.variaveis) return vazio;
    // O retrato novo entrega `{globais, quadros, foco}`, com um grupo por FRAME
    // da pilha. A versão anterior do painel lia `variables.locais`, que não
    // existe: o campo nunca apareceu, o painel de variáveis mostrava só o grupo
    // Global, e nada reclamava porque `locais` ausente é simplesmente uma
    // condição falsa.
    const vars = retrato.variaveis;
    const grupos = [];
    const teto = o.teto || 200;

    // O frame focado vem em cima (§43), e os demais na ordem da pilha. A ordem
    // é estável: `selecionado` só promove, não reordena o resto.
    const quadros = (vars.quadros || []).slice();
    const emDestaque = quadros.filter((q) => q.selecionado);
    const restantes = quadros.filter((q) => !q.selecionado);
    for (const q of emDestaque.concat(restantes)) {
      const linhas = (q.variaveis || []).slice(0, teto);
      if (linhas.length === 0) continue;
      grupos.push({
        titulo: "Frame " + q.profundidade + (q.nome ? " · " + q.nome : ""),
        escopo: "frame:" + q.profundidade,
        profundidade: q.profundidade,
        linhas: linhas,
        focado: !!q.selecionado,
      });
    }
    const globais = (vars.globais || []).slice(0, teto);
    if (globais.length > 0) {
      grupos.push({ titulo: "Global", escopo: "global", profundidade: null, linhas: globais, focado: false });
    }
    let total = 0;
    for (const g of grupos) total += g.linhas.length;
    const escopo = grupos.length > 0 ? grupos[0].escopo : "global";
    return { escopo: escopo, grupos: grupos, total: total, truncado: !!(o.teto && total > totalDe(grupos)) };
  }

  // ------------------------------------------------------------------ §44 dados

  /**
   * §44 — a pilha, do mais interno ao mais externo (a ordem que
   * `contexto.callStack()` já entrega), com o rótulo `fat(3)` do exemplo.
   *
   * O rótulo mostra o VALOR dos parâmetros, e não só o nome: uma pilha com
   * quatro `fat` de nome só diz alguma coisa com o número embaixo.
   */
  function dadosPilha(retrato) {
    if (!retrato || !retrato.callStack) return [];
    // O `getCallStack()` do runtime devolve os parâmetros só pelo NOME — o valor
    // mora no ambiente do frame, e o runtime não o duplica na pilha (duplicar
    // seria a segunda estrutura que a §39.3 proíbe). Para o rótulo `fat(3)`,
    // que é o que dá sentido à pilha, o painel cruza a pilha com os quadros de
    // `variaveis`, que são a MESMA pilha vista pelo outro lado. Cruzar não é
    // guardar: nada é guardado, é lido a cada pintura.
    const quadros = (retrato.variaveis && retrato.variaveis.quadros) || [];
    const porProfundidade = new Map();
    for (const q of quadros) porProfundidade.set(q.profundidade, q);
    return retrato.callStack.map((f) => {
      const q = porProfundidade.get(f.profundidade);
      const valorDe = (nome) => {
        if (!q || !q.variaveis) return null;
        const v = q.variaveis.find((x) => x.nome === nome);
        return v ? v.valor : null;
      };
      const argumentos = (f.parametros || []).map((p) => {
        const v = valorDe(p.nome);
        return v === null || v === undefined ? p.nome : v;
      });
      return {
        nome: f.nome,
        rotulo: f.nome + "(" + argumentos.join(", ") + ")",
        linha: f.linha,
        coluna: f.coluna,
        profundidade: f.profundidade,
        parametros: (f.parametros || []).map((p) => ({
          nome: p.nome,
          valor: valorDe(p.nome),
          referencia: !!p.referencia,
        })),
        // `ativo` não vem mais pronto: quem sabe qual frame está em foco é o
        // ambiente, via `selecionado`. Sem isto, nenhum frame ficava destacado
        // e a §33 (frame selection) não tinha efeito visível.
        ativo: !!(q && q.selecionado),
      };
    });
  }

  // ------------------------------------------------------------------ §45 dados

  /**
   * §45 — o perfil por linha mais os totais que o spec pede embaixo: statements,
   * chamadas, iterações e tempo.
   *
   * O tempo é o do RELÓGIO MONOTÔNICO medido em volta das passagens do runtime —
   * não o `performance` da página inteira, que mediria o navegador e não o
   * algoritmo (§45, "não confundir").
   */
  function dadosPerfil(retrato, opcoes) {
    const o = opcoes || {};
    // `perfilPorLinha` e `stats` no retrato novo; `executionStats.porLinha` no
    // antigo. Com o campo errado, `porLinha` vinha `[]` e o perfil mostrava
    // "Sem contagem ainda." para sempre, mesmo com o programa rodando.
    const stats = (retrato && retrato.stats) || {};
    const marcas = (retrato && retrato.breakpoints) || [];
    const porLinha = (retrato && retrato.perfilPorLinha) || [];
    const ponto = retrato && retrato.executionPoint;
    const linhaAtual = ponto && typeof ponto.sourceLine === "number" ? ponto.sourceLine : null;
    const teto = typeof o.teto === "number" ? o.teto : LIMITE_PERFIL;
    const linhas = porLinha.slice(0, teto).map((p) => ({
      linha: p.linha,
      execucoes: p.execucoes,
      marcado: marcas.indexOf(p.linha) >= 0,
      atual: linhaAtual === p.linha,
    }));
    return {
      ordem: o.ordem === "linha" ? "linha" : "execucoes",
      linhas: linhas,
      truncado: porLinha.length > teto,
      total: porLinha.length,
      totais: {
        comandos: stats.comandos || 0,
        chamadas: stats.chamadas || 0,
        iteracoes: stats.iteracoes || 0,
        tempoMs: stats.tempoMs || 0,
        reexecucoes: stats.reexecucoes || 0,
      },
    };
  }

  // ------------------------------------------------------------- estado (§40)

  /** A fita de status: estado, linha atual, modo de passo e erro. */
  function dadosEstado(retrato) {
    if (!retrato) {
      return { status: "parado", rotulo: ROTULO_ESTADO.parado, linha: null, passo: null, breakpoints: [], erro: null };
    }
    // `estado` no lugar de `status`, `executionPoint.sourceLine` no lugar de
    // `currentSourceLocation.linha`, `motivo` no lugar de `stepMode`. Ler os
    // nomes antigos dava `undefined` em tudo, e a fita mostrava "parado" com a
    // sessão em pausa — o sintoma mais visível da tela errada.
    const ponto = retrato.executionPoint;
    const erro = retrato.erro;
    return {
      status: retrato.estado,
      rotulo: ROTULO_ESTADO[retrato.estado] || retrato.estado,
      linha: ponto && typeof ponto.sourceLine === "number" ? ponto.sourceLine : null,
      passo: ROTULO_PASSO[retrato.motivo] || null,
      breakpoints: (retrato.breakpoints || []).slice(),
      erro: erro
        ? {
            mensagem: erro.mensagem,
            linha: typeof erro.sourceLine === "number" ? erro.sourceLine : null,
            codigo: erro.errorCode || null,
          }
        : null,
    };
  }

  // ------------------------------------------------------------------ §43 HTML

  /** Uma variável na linha, com o tipo alinhado e o valor. */
  function htmlVariavelLinha(v, recuo) {
    let h = '<div class="dbg-var" data-nome="' + escapar(v.nome) + '">';
    h += '<span class="dbg-var-nome">' + recuo + escapar(v.nome) + "</span>";
    h += '<span class="dbg-var-tipo">' + escapar(v.tipo) + "</span>";
    h += '<span class="dbg-var-valor">' + escapar(v.texto) + "</span>";
    h += "</div>";
    if (v.elementos && v.elementos.itens && v.elementos.itens.length > 0) {
      h += '<div class="dbg-var-itens">';
      for (const item of v.elementos.itens) {
        h +=
          '<div class="dbg-var-item' + (item.atribuido ? "" : " dbg-vazio") + '">' +
          '<span class="dbg-item-indice">' + escapar(item.indice) + "</span>" +
          '<span class="dbg-item-valor">' + escapar(item.valor) + "</span>" +
          "</div>";
      }
      if (v.elementos.truncado) {
        h += '<div class="dbg-var-item dbg-vazio"><span class="dbg-item-indice">…</span><span class="dbg-item-valor">' + v.elementos.total + " posições</span></div>";
      }
      h += "</div>";
    }
    return h;
  }

  function htmlVariaveis(estadoDebug, opcoes) {
    const d = dadosVariaveis(estadoDebug, opcoes);
    if (d.grupos.length === 0) return '<p class="dbg-vazio">Sem variáveis no escopo.</p>';
    let h = "";
    for (const g of d.grupos) {
      h += '<div class="dbg-grupo" data-escopo="' + escapar(g.escopo) + '">';
      h += '<h4 class="dbg-grupo-titulo">' + escapar(g.titulo) + "</h4>";
      for (const v of g.linhas) h += htmlVariavelLinha(v, "");
      h += "</div>";
    }
    return h;
  }

  // ------------------------------------------------------------------ §44 HTML

  function htmlPilha(estadoDebug) {
    const d = dadosPilha(estadoDebug);
    if (d.length === 0) return '<p class="dbg-vazio">Sem chamadas ativas.</p>';
    let h = '<ol class="dbg-pilha">';
    for (const f of d) {
      h +=
        '<li class="dbg-frame' + (f.ativo ? " dbg-ativo" : "") + '">' +
        '<button type="button" class="dbg-frame-btn" data-profundidade="' + f.profundidade + '">' +
        '<span class="dbg-frame-nome">' + escapar(f.rotulo) + "</span>" +
        '<span class="dbg-frame-linha">' + (f.linha == null ? "—" : "linha " + f.linha) + "</span>" +
        "</button></li>";
    }
    h += "</ol>";
    return h;
  }

  // ------------------------------------------------------------------ §45 HTML

  function htmlPerfil(estadoDebug, opcoes) {
    const d = dadosPerfil(estadoDebug, opcoes);
    let h = '<table class="dbg-perfil"><thead><tr><th scope="col">Linha</th><th scope="col">Execuções</th></tr></thead><tbody>';
    if (d.linhas.length === 0) {
      h += '<tr class="dbg-perfil-vazio"><td colspan="2">Sem contagem ainda.</td></tr>';
    }
    for (const l of d.linhas) {
      h +=
        '<tr class="dbg-perfil-linha' + (l.atual ? " dbg-ativo" : "") + (l.marcado ? " dbg-marcado" : "") + '">' +
        '<td><button type="button" class="dbg-perfil-btn" data-linha="' + l.linha + '">' + l.linha + "</button></td>" +
        "<td>" + l.execucoes + "</td></tr>";
    }
    h += "</tbody></table>";
    if (d.truncado) h += '<p class="dbg-nota">Mostrando as ' + d.linhas.length + " de " + d.total + " linhas executadas.</p>";
    h +=
      '<dl class="dbg-totais">' +
      "<dt>Statements</dt><dd>" + d.totais.comandos + "</dd>" +
      "<dt>Chamadas</dt><dd>" + d.totais.chamadas + "</dd>" +
      "<dt>Iterações</dt><dd>" + d.totais.iteracoes + "</dd>" +
      "<dt>Tempo</dt><dd>" + d.totais.tempoMs + " ms</dd>" +
      "</dl>";
    return h;
  }

  // ------------------------------------------------------------- status HTML

  function htmlEstado(estadoDebug) {
    const d = dadosEstado(estadoDebug);
    let h = '<p class="dbg-status" data-status="' + escapar(d.status) + '">' + escapar(d.rotulo);
    if (d.linha != null) h += " · linha " + d.linha;
    if (d.passo) h += " · " + escapar(d.passo);
    h += "</p>";
    if (d.erro) {
      h += '<p class="dbg-erro">' + (d.erro.linha == null ? "" : "Linha " + d.erro.linha + ": ") + escapar(d.erro.mensagem) + "</p>";
    }
    return h;
  }

  /** Os três painéis + a fita de status, na ordem em que aparecem na tela. */
  function html(estadoDebug, opcoes) {
    const o = opcoes || {};
    return (
      '<div class="dbg-fita">' +
      htmlEstado(estadoDebug) +
      '<p class="dbg-bps">Breakpoints: ' + ((estadoDebug && estadoDebug.breakpoints) || []).map(escapar).join(", ") + "</p>" +
      "</div>" +
      '<section class="dbg-painel" data-painel="variaveis"><h3>Variáveis</h3>' +
      htmlVariaveis(estadoDebug, o) +
      "</section>" +
      '<section class="dbg-painel" data-painel="pilha"><h3>Call Stack</h3>' +
      htmlPilha(estadoDebug) +
      "</section>" +
      '<section class="dbg-painel" data-painel="perfil"><h3>Perfil</h3>' +
      htmlPerfil(estadoDebug, o) +
      "</section>"
    );
  }

  // ------------------------------------------------------------------- DOM

  /** `document` do chamador, ou o global. `null` onde não existe (Node). */
  function docDe(opcoes) {
    const o = opcoes || {};
    if (o.doc) return o.doc;
    return typeof document !== "undefined" ? document : null;
  }

  function el(doc, tag, classe, texto) {
    const n = doc.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined && texto !== null) n.textContent = String(texto);
    return n;
  }

  /**
   * Monta os painéis e devolve um controlador. É a única função deste arquivo que
   * toca no DOM, e ela só roda quando alguém chama.
   *
   * `opcoes`:
   *   doc                 — objeto com `createElement`; injetável para teste
   *   aoEscolherFrame(p)  — clique num frame da §44
   *   aoEscolherLinha(n)  — clique numa linha do perfil da §45
   *   aoOrdenar(ordem)    — troca a ordenação do perfil
   *   teto                — teto de linhas por painel
   *
   * Devolve `{ raiz, atualizar(estadoDebug), visivel(booleano) }`.
   */
  function criar(opcoes) {
    const o = opcoes || {};
    const doc = docDe(o);
    if (!doc) throw new Error("DebugPanels.criar precisa de um documento");

    const raiz = el(doc, "div", "dbg-raiz");
    const fita = el(doc, "div", "dbg-fita");
    const pStatus = el(doc, "p", "dbg-status");
    const pBps = el(doc, "p", "dbg-bps");
    const pErro = el(doc, "p", "dbg-erro");
    pErro.hidden = true;
    fita.appendChild(pStatus);
    fita.appendChild(pBps);
    fita.appendChild(pErro);
    raiz.appendChild(fita);

    const paineis = {};
    for (const nome of ["variaveis", "pilha", "perfil"]) {
      const sec = el(doc, "section", "dbg-painel dbg-painel--" + nome);
      sec.setAttribute("data-painel", nome);
      const h3 = el(doc, "h3", null, nome === "variaveis" ? "Variáveis" : nome === "pilha" ? "Call Stack" : "Perfil");
      const corpo = el(doc, "div", "dbg-painel-corpo");
      sec.appendChild(h3);
      sec.appendChild(corpo);
      raiz.appendChild(sec);
      paineis[nome] = corpo;
    }

    // Um único listener na raiz, com delegação: três painéis que mudam de tamanho
    // a cada passo não podem multiplicar listener a cada render.
    raiz.addEventListener("click", function (ev) {
      const alvo = ev.target && ev.target.closest ? ev.target.closest("[data-profundidade], [data-linha]") : null;
      if (!alvo || !raiz.contains(alvo)) return;
      if (alvo.hasAttribute("data-profundidade")) {
        if (typeof o.aoEscolherFrame === "function") o.aoEscolherFrame(Number(alvo.getAttribute("data-profundidade")));
        return;
      }
      if (typeof o.aoEscolherLinha === "function") o.aoEscolherLinha(Number(alvo.getAttribute("data-linha")));
    });

    /**
     * Os painéis são montados a partir das ESTRUTURAS da camada pura, nó por nó,
     * e nunca a partir do HTML dela. É o que impede o valor de uma variável de
     * virar marcação, mesmo que o `escapar` da camada pura fosse esquecido — e é
     * também o que dispensa `innerHTML` deste arquivo inteiro.
     */
    /** Último `DebugState` pintado. Serve para quem quiser comparar com o próximo. */
    let estado = null;

    function vazio(alvo, texto) {
      alvo.textContent = "";
      alvo.appendChild(el(doc, "p", "dbg-vazio", texto));
    }

    function linha(alvo, classe, partes) {
      const linha = el(doc, "div", classe);
      for (const p of partes) {
        const n = el(doc, "span", p.classe, p.texto);
        if (p.atributo) n.setAttribute(p.atributo, p.valor);
        linha.appendChild(n);
      }
      alvo.appendChild(linha);
      return linha;
    }

    function pintarVariaveis(alvo, e) {
      const d = dadosVariaveis(e, o);
      if (d.grupos.length === 0) return vazio(alvo, "Sem variáveis no escopo.");
      alvo.textContent = "";
      for (const g of d.grupos) {
        const grupo = el(doc, "div", "dbg-grupo");
        grupo.setAttribute("data-escopo", g.escopo);
        grupo.appendChild(el(doc, "h4", "dbg-grupo-titulo", g.titulo));
        for (const v of g.linhas) {
          linha(grupo, "dbg-var", [
            { classe: "dbg-var-nome", texto: v.nome, atributo: "data-nome", valor: v.nome },
            { classe: "dbg-var-tipo", texto: v.tipo },
            { classe: "dbg-var-valor", texto: v.texto },
          ]);
          if (v.elementos && v.elementos.itens && v.elementos.itens.length > 0) {
            const itens = el(doc, "div", "dbg-var-itens");
            for (const item of v.elementos.itens) {
              linha(itens, "dbg-var-item" + (item.atribuido ? "" : " dbg-vazio"), [
                { classe: "dbg-item-indice", texto: item.indice },
                { classe: "dbg-item-valor", texto: item.valor },
              ]);
            }
            if (v.elementos.truncado) {
              linha(itens, "dbg-var-item dbg-vazio", [
                { classe: "dbg-item-indice", texto: "…" },
                { classe: "dbg-item-valor", texto: v.elementos.total + " posições" },
              ]);
            }
            grupo.appendChild(itens);
          }
        }
        alvo.appendChild(grupo);
      }
    }

    function pintarPilha(alvo, e) {
      const d = dadosPilha(e);
      if (d.length === 0) return vazio(alvo, "Sem chamadas ativas.");
      alvo.textContent = "";
      const lista = el(doc, "ol", "dbg-pilha");
      for (const f of d) {
        const item = el(doc, "li", "dbg-frame" + (f.ativo ? " dbg-ativo" : ""));
        const botao = el(doc, "button", "dbg-frame-btn");
        botao.setAttribute("type", "button");
        botao.setAttribute("data-profundidade", String(f.profundidade));
        botao.appendChild(el(doc, "span", "dbg-frame-nome", f.rotulo));
        botao.appendChild(el(doc, "span", "dbg-frame-linha", f.linha == null ? "—" : "linha " + f.linha));
        item.appendChild(botao);
        lista.appendChild(item);
      }
      alvo.appendChild(lista);
    }

    function pintarPerfil(alvo, e) {
      const d = dadosPerfil(e, o);
      alvo.textContent = "";
      const tabela = el(doc, "table", "dbg-perfil");
      const thead = el(doc, "thead");
      const linhaCab = el(doc, "tr");
      for (const titulo of ["Linha", "Execuções"]) {
        const th = el(doc, "th", null, titulo);
        th.setAttribute("scope", "col");
        linhaCab.appendChild(th);
      }
      thead.appendChild(linhaCab);
      tabela.appendChild(thead);
      const tbody = el(doc, "tbody");
      if (d.linhas.length === 0) {
        const tr = el(doc, "tr", "dbg-perfil-vazio");
        const td = el(doc, "td", null, "Sem contagem ainda.");
        td.setAttribute("colspan", "2");
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      for (const l of d.linhas) {
        const tr = el(doc, "tr", "dbg-perfil-linha" + (l.atual ? " dbg-ativo" : "") + (l.marcado ? " dbg-marcado" : ""));
        const celula = el(doc, "td");
        const botao = el(doc, "button", "dbg-perfil-btn", String(l.linha));
        botao.setAttribute("type", "button");
        botao.setAttribute("data-linha", String(l.linha));
        celula.appendChild(botao);
        tr.appendChild(celula);
        tr.appendChild(el(doc, "td", null, String(l.execucoes)));
        tbody.appendChild(tr);
      }
      tabela.appendChild(tbody);
      alvo.appendChild(tabela);
      if (d.truncado) {
        alvo.appendChild(el(doc, "p", "dbg-nota", "Mostrando as " + d.linhas.length + " de " + d.total + " linhas executadas."));
      }
      const totais = el(doc, "dl", "dbg-totais");
      const pares = [
        ["Statements", String(d.totais.comandos)],
        ["Chamadas", String(d.totais.chamadas)],
        ["Iterações", String(d.totais.iteracoes)],
        ["Tempo", d.totais.tempoMs + " ms"],
      ];
      for (const par of pares) {
        totais.appendChild(el(doc, "dt", null, par[0]));
        totais.appendChild(el(doc, "dd", null, par[1]));
      }
      alvo.appendChild(totais);
    }

    function pintar(e) {
      estado = e;
      const d = dadosEstado(e);
      pStatus.textContent = d.rotulo + (d.linha == null ? "" : " · linha " + d.linha) + (d.passo ? " · " + d.passo : "");
      pStatus.setAttribute("data-status", d.status);
      pBps.textContent = "Breakpoints: " + (d.breakpoints.length ? d.breakpoints.join(", ") : "nenhum");
      if (d.erro) {
        pErro.hidden = false;
        pErro.textContent = (d.erro.linha == null ? "" : "Linha " + d.erro.linha + ": ") + d.erro.mensagem;
      } else {
        pErro.hidden = true;
        pErro.textContent = "";
      }
      pintarVariaveis(paineis.variaveis, e);
      pintarPilha(paineis.pilha, e);
      pintarPerfil(paineis.perfil, e);
    }

    /** Redesenha a partir do último `DebugState` recebido. */
    const controlador = {
      raiz: raiz,
      ultimo: function () {
        return estado;
      },
      atualizar: function (e) {
        pintar(e);
        return controlador;
      },
      visivel: function (v) {
        raiz.hidden = !v;
        return controlador;
      },
    };
    if (o.inicial) pintar(o.inicial);
    return controlador;
  }

  GP.DebugPanels = {
    ROTULO_ESTADO: ROTULO_ESTADO,
    ROTULO_PASSO: ROTULO_PASSO,
    LIMITE_PERFIL: LIMITE_PERFIL,
    escapar: escapar,
    // camada pura
    dadosEstado: dadosEstado,
    dadosVariaveis: dadosVariaveis,
    dadosPilha: dadosPilha,
    dadosPerfil: dadosPerfil,
    htmlEstado: htmlEstado,
    htmlVariaveis: htmlVariaveis,
    htmlPilha: htmlPilha,
    htmlPerfil: htmlPerfil,
    html: html,
    // camada de ligação
    criar: criar,
  };
})(W.VGPlay);
