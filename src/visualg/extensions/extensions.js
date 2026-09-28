// §31–§39 — extensões do VisuAlg: `aleatorio`, arquivos virtuais, `limpatela`,
// `mudacor`, `pausa`, `debug`, `eco` e `cronometro`.
//
// ---------------------------------------------------------------------------
// POR QUE ESTE MÓDULO NÃO TOCA O DOM
// ---------------------------------------------------------------------------
//
// O núcleo do engine é DOM-free por decisão de projeto (o auditor confirmou) e
// isso não muda aqui. `limpatela`, `mudacor`, `eco`, `debug` e `pausa` precisam
// falar com a camada de apresentação, mas o caminho passa por UM CALLBACK:
//
//     VG.Extensoes.aoEvento = function (tipo, dados) {}
//
// A UI sobrescreve essa função e reage; o runtime só emite. Se ninguém
// sobrescrever, `emitir()` é no-op silencioso — de propósito, porque o motor
// precisa funcionar no Node (nos testes) sem DOM. Um `document` aqui quebraria
// o `node tools/testar.mjs` inteiro.
//
// Tabela de eventos (a UI implementa o que quiser; o núcleo só emite):
//
//   limpatela  {}                                  §33
//   cor        { cor, fundo }                      §34
//   eco        { ligado }                          §38
//   debug      { linha, expressao, valor }         §37
//   pausa      { ms, linha, continuar, passo, parar }  §36/§40
//   cronometro { ms, ligado }                      §39
//   aleatorio  { ligado, min, max, semente }       §31
//   arquivo    { acao, nome }                      §32
//
// Para a `pausa`, a UI devolve `true` do callback para ASSUMIR a pausa (o
// módulo espera `continuar()`, `passo()` ou `parar()`); devolvendo `undefined` o
// módulo não espera ninguém e segue sozinho. Sem essa distinção, `pausa` num
// programa headless travaria o processo.
//
// ---------------------------------------------------------------------------
// POR QUE O VFS NÃO VAI A DISCO
// ---------------------------------------------------------------------------
//
// A §32 proíbe explicitamente acessar o filesystem real, e o projeto abre
// `index.html` por `file://`, onde não existe permissão de leitura de arquivo
// nenhum. Tudo aqui é `Map` em memória. Nenhuma referência a `fs`, `fetch`,
// `XMLHttpRequest`, `localStorage` ou `document` aparece no arquivo — e há um
// teste que varre o fonte atrás disso, porque a tentação de "resolver rápido
// com fetch" é exatamente o que o §32 proíbe.
//
// ---------------------------------------------------------------------------
// ONDE ENTRA NA ORDEM DE CARGA
// ---------------------------------------------------------------------------
//
// `src/visualg/carga.mjs`, entre `runtime.js` e `api.js`:
//
//     { src: "src/visualg/extensions/extensions.js",
//       motivo: "W.VG.Extensoes — comandos §31–§39", noNode: false },
//
// DEPOIS de `runtime.js` e do `parser.js` porque o módulo é carregado por
// `<script>` clássicos e tanto o parser quanto o runtime o consultam em tempo de
// uso (`VG.Extensoes.comandos[...]`), nunca no instante em que são avaliados.
// O `index.js` já publica `Extensoes: VG.Extensoes` e já mescla `registro`, o
// que confirma a posição e o formato.
//
// ---------------------------------------------------------------------------
// UM CASE QUE FALTA EM `semantic.js` (arquivo de outra onda)
// ---------------------------------------------------------------------------
//
// O nó novo é `{ tipo: "extensao", comando, argumentos, grafia }`, e
// `Semantica.comando()` tem um `default:` que acusa qualquer tipo fora da sua
// lista. Então `Vg.analisar(codigo, { analisarSemantica: true })` reprova um
// programa que use `limpatela`, com "Comando desconhecido para a análise:
// 'extensao'". `semantic.js` não é desta onda, e o padrão do projeto NÃO roda
// análise semântica por padrão (`api.js:51` só liga com a opção), então nada do
// que existe quebra — mas a correção é de três linhas, para quem for dono do
// arquivo, em `Semantica.comando()`:
//
//     case "extensao":
//       // §31–§39 — os argumentos são expressões comuns; a forma e a aridade
//       // são decididas pelo módulo, em `ajuda`.
//       for (const a of cmd.argumentos || []) this.faixaDe(a);
//       return;
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;
  // `Values` é opcional (o módulo precisa existir mesmo antes de `values.js`).
  const V = VG.Values;
  const S = VG.Scheduler;

  // ------------------------------------------------------------------ helpers

  function erro(codigo, mensagem, pos) {
    return Diagnostics.criar(codigo, mensagem, pos || null);
  }

  function paraTexto(v) {
    if (V && typeof V.paraTexto === "function") return V.paraTexto(v);
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
    return String(v);
  }

  function ehNumero(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  /** Chave de arquivo: minúsculas, sem acento, só o nome do arquivo. */
  function chaveDeArquivo(nome) {
    const bruto = String(nome === null || nome === undefined ? "" : nome).trim();
    const sem = bruto.split("\\").pop().split("/").pop();
    return chaveDe(sem);
  }

  /** Mesma normalização de `Tokens.chaveDe`, replicada para o módulo não
   *  depender da ordem de carga de `tokens.js`. */
  const SEM_ACENTO = {
    á: "a", à: "a", â: "a", ã: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o",
    õ: "o", ú: "u", ü: "u", ç: "c",
  };
  function chaveDe(palavra) {
    let s = String(palavra).toLowerCase();
    let saida = "";
    for (const c of s) saida += SEM_ACENTO[c] !== undefined ? SEM_ACENTO[c] : c;
    return saida;
  }

  // ------------------------------------------------------------------ eventos

  /**
   * Emite um evento para a camada de apresentação.
   *
   * Lê `VG.Extensoes.aoEvento` a CADA chamada, e não uma referência capturada
   * no fechamento: a UI sobrescreve a propriedade depois que este arquivo foi
   * avaliado, e uma cópia local continuaria apontando para o no-op.
   */
  function emitir(tipo, dados) {
    const X = VG.Extensoes;
    if (!X || typeof X.aoEvento !== "function") return undefined;
    try {
      return X.aoEvento(tipo, dados);
    } catch (e) {
      // Um painel de terminal quebrado não pode derrubar o programa do aluno.
      return undefined;
    }
  }

  // ------------------------------------------------------------------- §31
  // ALEATORIO — recurso de ENTRADA, não biblioteca.
  //
  // Não confundir com `Rand`/`RandI` (§29): aqueles são funções que devolvem
  // número e usam `Math.random`; este muda a FONTE dos dados que `leia` recebe.
  // Por isso o estado do gerador mora aqui, e não em `stdlib/math.js`.

  const SEMENTE_PADRAO = 20240101;

  /**
   * PRNG determinístico (mulberry32).
   *
   * `Math.random` não serve: um programa de teste com `aleatorio on` precisa
   * devolver os MESMOS valores a cada execução, senão ninguém consegue afirmar
   * nada sobre a saída. E precisa ser monotônico e sem estado global escondido.
   */
  function criarSorteio(semente) {
    let a = (semente >>> 0) || 1;
    return function proximo() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let sorteio = criarSorteio(SEMENTE_PADRAO);

  const ESTADO = {
    aleatorio: {
      ligado: false,
      min: 1,
      max: 100,
      semente: SEMENTE_PADRAO,
      gerados: 0,
    },
    eco: { ligado: false },
    cronometro: { ligado: false, inicio: 0, ms: 0 },
    cor: { cor: null, fundo: "FUNDO" },
    // §32 — pilha de arquivos declarados por `arquivo`; o topo é o corrente,
    // que é onde `ESCREVER` e `LERA` escreem/leem.
    pilha: [],
    // Valores entregues por `LERA`, consumidos pelo próximo `leia`.
    pendentes: [],
    // §37 — paradas do `debug`, para o painel do debugger.
    depuracao: { ligada: false, expressoes: 0, paradas: [] },
    // §36 — controle da pausa em curso.
    pausa: { ativa: false, ms: 0, linha: null },
  };

  /** Reinicia o gerador com semente explícita: é o botão de "reproduzir". */
  function semear(semente) {
    const n = Number(semente);
    if (!Number.isFinite(n)) {
      throw erro("RUNTIME_ENTRADA_INVALIDA", "A semente de 'aleatorio' precisa ser um número", null);
    }
    ESTADO.aleatorio.semente = Math.trunc(n);
    ESTADO.aleatorio.gerados = 0;
    sorteio = criarSorteio(ESTADO.aleatorio.semente);
    return ESTADO.aleatorio.semente;
  }

  /** Inteiro em [min, max], INCLUSIVO nos dois extremos, como o `RandI` do §29. */
  function inteiroAleatorio() {
    const { min, max } = ESTADO.aleatorio;
    const n = min + Math.floor(sorteio() * (max - min + 1));
    ESTADO.aleatorio.gerados++;
    return n;
  }

  // ------------------------------------------------------------------- §32
  // ARQUIVO — filesystem virtual, só em memória.
  //
  // A interface pedida pelo spec é `readFile/writeFile/exists/listFiles`; os
  // nomes em português (`ler`/`escrever`/`existe`/`listar`) são os mesmos quatro
  // com a grafia do resto do arquivo, e há `metodos` com o nome em inglês para
  // quem integrar de fora.

  const CABECALHO_PADRAO = 1;

  const VFS = {
    /** `Map` nome → `{ nome, linhas, cabecalho, cursor }`. */
    arquivos: new Map(),

    // --- as quatro operações da interface do spec -----------------------------

    /** Cria (ou reusa) o arquivo e devolve o registro. Não trunca o existente. */
    criar(nome, cabecalho) {
      const chave = chaveDeArquivo(nome);
      if (!chave) {
        throw erro("RUNTIME_ARQUIVO", "Nome de arquivo vazio", null);
      }
      let reg = this.arquivos.get(chave);
      if (!reg) {
        reg = { nome: chave, linhas: [], cabecalho: cabecalho || CABECALHO_PADRAO, cursor: 0 };
        this.arquivos.set(chave, reg);
      } else if (typeof cabecalho === "number" && cabecalho >= 0) {
        reg.cabecalho = Math.trunc(cabecalho);
      }
      return reg;
    },

    exists(nome) {
      return this.arquivos.has(chaveDeArquivo(nome));
    },

    /** Substitui o conteúdo inteiro. `texto` vira array de linhas. */
    writeFile(nome, texto) {
      const reg = this.criar(nome);
      reg.linhas = dividirLinhas(texto);
      reg.cursor = 0;
      return reg;
    },

    /** Texto com quebras `\n` entre as linhas; "" para arquivo inexistente. */
    readFile(nome) {
      const reg = this.arquivos.get(chaveDeArquivo(nome));
      return reg ? reg.linhas.join("\n") : "";
    },

    /** Nomes em ordem de criação, que é a ordem estável que `NOME` espera. */
    listFiles() {
      return Array.from(this.arquivos.values()).map((r) => r.nome);
    },

    // --- o resto da interface, em português -----------------------------------

    existe: (nome) => VFS.exists(nome),
    escrever: (nome, texto) => VFS.writeFile(nome, texto),
    ler: (nome) => VFS.readFile(nome),
    listar: () => VFS.listFiles(),

    /** `true` se apagou; `false` se o arquivo não existia. */
    apagar(nome) {
      return this.arquivos.delete(chaveDeArquivo(nome));
    },

    renomeie(de, para) {
      const origem = chaveDeArquivo(de);
      const destino = chaveDeArquivo(para);
      const reg = this.arquivos.get(origem);
      if (!reg) return false;
      this.arquivos.delete(origem);
      reg.nome = destino;
      reg.cursor = 0;
      this.arquivos.set(destino, reg);
      return true;
    },

    /**
     * Caracteres do conteúdo, `\n` contando 1.
     *
     * Aceita o NOME ou o REGISTRO, porque `TAMANHO` já valida a existência com
     * `registroDe()` e chega aqui com o registro. `nomeDo` desambigua os dois: um
     * registro tem `linhas`, um nome não.
     */
    tamanho(nomeOuRegistro) {
      const reg = this.nomeDo(nomeOuRegistro);
      return reg ? reg.linhas.join("\n").length : 0;
    },

    /**
     * Linhas `de` a `ate`, 1-based e INCLUSIVAS, como o `CONTEUDO` do VisuAlg.
     * Ausentes, vale do início ao fim. Devolve "" se o arquivo não existir.
     */
    conteudo(nome, de, ate) {
      const reg = this.arquivos.get(chaveDeArquivo(nome));
      if (!reg) return "";
      const ini = de === null || de === undefined ? 1 : Math.trunc(Number(de));
      const fim = ate === null || ate === undefined ? reg.linhas.length : Math.trunc(Number(ate));
      if (!Number.isFinite(ini) || !Number.isFinite(fim) || ini < 1 || fim < ini) return "";
      return reg.linhas.slice(ini - 1, fim).join("\n");
    },

    /**
     * A §32 separa CONTEUDO de CABEÇALHO: o cabeçalho é o bloco inicial do
     * arquivo, dimensionado no `arquivo "f", n` e com 1 linha por padrão.
     */
    cabecalho(nome, de, ate) {
      const reg = this.arquivos.get(chaveDeArquivo(nome));
      if (!reg) return "";
      const ini = de === null || de === undefined ? 1 : Math.trunc(Number(de));
      const fim = ate === null || ate === undefined ? reg.cabecalho : Math.trunc(Number(ate));
      return this.conteudo(nome, ini, fim);
    },

    /** `true` quando o cursor de leitura já passou da última linha. */
    fim(nome) {
      const reg = this.nomeDo(nome);
      if (!reg) return true;
      return reg.cursor >= reg.linhas.length;
    },

    /** Nome do n-ésimo arquivo (1-based) do diretório virtual; "" se não houver. */
    nome(indice) {
      const lista = this.listFiles();
      const n = Math.trunc(Number(indice));
      if (!Number.isFinite(n) || n < 1 || n > lista.length) return "";
      return lista[n - 1];
    },

    // --- cursor de leitura, para `LERA` ---------------------------------------

    /** Próxima linha a partir do cursor e avança; `null` no fim do arquivo. */
    proximaLinha(nome) {
      const reg = this.nomeDo(nome);
      if (!reg || reg.cursor >= reg.linhas.length) return null;
      const linha = reg.linhas[reg.cursor];
      reg.cursor++;
      return linha;
    },

    /** Recoloca o cursor no início. */
    rebobinar(nome) {
      const reg = this.nomeDo(nome);
      if (reg) reg.cursor = 0;
      return reg;
    },

    /** Registro do arquivo pedido, ou do corrente quando `nome` é vazio. */
    nomeDo(nome) {
      // Aceita registro: `TAMANHO` já resolveu o arquivo e repassa o registro.
      if (nome && typeof nome === "object" && Array.isArray(nome.linhas)) return nome;
      if (nome !== null && nome !== undefined && String(nome).trim() !== "") {
        return this.arquivos.get(chaveDeArquivo(nome)) || null;
      }
      const topo = ESTADO.pilha.length > 0 ? ESTADO.pilha[ESTADO.pilha.length - 1] : null;
      return topo ? this.arquivos.get(topo) || null : null;
    },

    /** Empilha um arquivo e o torna corrente (§32: `arquivo "entrada.txt"`). */
    abrir(nome, cabecalho) {
      const reg = this.criar(nome, cabecalho);
      if (ESTADO.pilha[ESTADO.pilha.length - 1] !== reg.nome) ESTADO.pilha.push(reg.nome);
      reg.cursor = 0;
      return reg;
    },

    /** Arquivo corrente, para os comandos que não recebem nome. */
    corrente() {
      return this.nomeDo(null);
    },

    /** Esvazia o VFS inteiro: entre uma execução e outra, a UI chama isto. */
    reiniciar() {
      this.arquivos.clear();
      ESTADO.pilha.length = 0;
      ESTADO.pendentes.length = 0;
      return this;
    },

    /** Alias em inglês da interface `readFile/writeFile/exists/listFiles` do spec. */
    metodos: {
      readFile: (nome) => VFS.readFile(nome),
      writeFile: (nome, texto) => VFS.writeFile(nome, texto),
      exists: (nome) => VFS.exists(nome),
      listFiles: () => VFS.listFiles(),
    },
  };

  function dividirLinhas(texto) {
    if (texto === null || texto === undefined) return [];
    return String(texto).replace(/\r\n/g, "\n").split("\n");
  }

  // ------------------------------------------------------------ §36 / §40
  // PAUSA — a parada do §36 usa o MESMO mecanismo de pausa do debugger (§40):
  // o `scheduler`, e não um `setTimeout` espalhado. O `setTimeout` que aparece
  // abaixo é o sono de `pausa(n)`, e é o mesmo relógio de parede que qualquer
  // código usaria para esperar — não é o scheduler deciding o passo.

  function dormir(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms | 0)));
  }

  /**
   * Para a execução e oferece Continuar / Passo / Parar.
   *
   * Sem UI (Node, testes) ninguém devolve `true` do callback, então a pausa não
   * espera ninguém: ela só dorme `ms`. É o que impede `pausa` de travar o
   * `node tools/testar.mjs`.
   */
  async function pausar(runtime, ms, pos) {
    const linha = pos ? pos.linha : null;
    let liberar = null;
    const espera = new Promise((resolve) => {
      liberar = resolve;
    });
    const controles = {
      continuar: () => { liberar("continuar"); },
      passo: () => { liberar("passo"); },
      parar: () => { liberar("parar"); },
    };
    ESTADO.pausa = { ativa: true, ms: ms, linha: linha, controles: controles };
    if (runtime && runtime.scheduler && S && S.ESTADO) {
      runtime.scheduler.mudarPara(S.ESTADO.PAUSADO);
    }
    const aceito = emitir("pausa", {
      ms: ms,
      linha: linha,
      continuar: controles.continuar,
      passo: controles.passo,
      parar: controles.parar,
    });
    let resultado = "sem-ui";
    if (aceito === true) resultado = await espera;
    else if (ms > 0) await dormir(ms);
    else await dormir(0); // cede o event loop: `pausa` sem UI não pode travar
    if (resultado === "parar") {
      const S2 = VG.Scheduler;
      throw new S2.SinalParada("parado pelo comando 'pausa'");
    }
    ESTADO.pausa.ativa = false;
    if (runtime && runtime.scheduler && S && S.ESTADO) {
      runtime.scheduler.mudarPara(S.ESTADO.EXECUTANDO);
    }
    return resultado;
  }

  // ------------------------------------------------------------------ §34
  // MUDACOR — conjunto FECHADO de cores.
  //
  // A §34 proíbe expressamente que o código do aluno produza CSS ou
  // JavaScript arbitrário. Aqui não existe concatenação de string de estilo
  // em lugar nenhum: o comando só escolhe uma chave deste mapa e guarda o nome.
  // Quem converte em pixel é a UI, e só pode escolher entre `CORES`.
  const CORES = {
    PRETO: "#000000",
    AZUL: "#0000aa",
    VERDE: "#00aa00",
    CIANO: "#00aaaa",
    VERMELHO: "#aa0000",
    MAGENTA: "#aa00aa",
    AMARELO: "#aaaa00",
    BRANCO: "#aaaaaa",
    // `NORMAL` devolve o terminal ao estado inicial, como o botão do menu.
    NORMAL: null,
  };

  const FUNDOS = { FRENTE: "FRENTE", FUNDO: "FUNDO" };

  // ------------------------------------------------------------------ §39
  // CRONOMETRO — relógio monotônico, e NÃO o timer didático do §35.
  function agora() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  // ------------------------------------------------------------------ §32
  // Comandos de arquivo, como FORMA (§39) e como FUNÇÃO (o VisuAlg 3.x aceita
  // `escreva(EXISTE("a.txt"))`). As duas rotas chamam a mesma implementação, e
  // o valor de retorno é impresso pelo runtime quando o comando aparece sozinho.

  function exigirAridade(nome, args, min, max, pos) {
    if (args.length >= min && args.length <= max) return;
    const esperado = min === max ? String(min) : min + " a " + max;
    throw erro(
      "TIPO_ARGUMENTOS",
      "'" + nome + "' espera " + esperado + " argumento(s), veio " + args.length,
      pos
    );
  }

  /** Primeiro argumento tem de ser nome de arquivo. */
  function nomeDe(args, comando, pos) {
    const n = paraTexto(args[0]);
    if (!n.trim()) {
      throw erro("RUNTIME_ARQUIVO", "'" + comando + "' precisa do nome do arquivo", pos);
    }
    return n;
  }

  /** Registro do arquivo, com erro nomeado se ele não existir. */
  function registroDe(nome, comando, pos) {
    const reg = VFS.nomeDo(nome);
    if (!reg) {
      throw erro("RUNTIME_ARQUIVO", "Arquivo '" + chaveDeArquivo(nome) + "' não existe", pos);
    }
    return reg;
  }

  const ARQUIVO = {
    existe: (args, runtime, pos) => {
      exigirAridade("EXISTE", args, 1, 1, pos);
      return VFS.exists(nomeDe(args, "EXISTE", pos));
    },
    tamanho: (args, runtime, pos) => {
      exigirAridade("TAMANHO", args, 1, 1, pos);
      return VFS.tamanho(registroDe(nomeDe(args, "TAMANHO", pos), "TAMANHO", pos));
    },
    conteudo: (args, runtime, pos) => {
      exigirAridade("CONTEUDO", args, 1, 3, pos);
      return VFS.conteudo(nomeDe(args, "CONTEUDO", pos), args[1], args[2]);
    },
    cabecalho: (args, runtime, pos) => {
      exigirAridade("CABEÇALHO", args, 1, 3, pos);
      return VFS.cabecalho(nomeDe(args, "CABEÇALHO", pos), args[1], args[2]);
    },
    fim: (args, runtime, pos) => {
      exigirAridade("FIM", args, 0, 1, pos);
      return VFS.fim(args.length === 0 ? null : nomeDe(args, "FIM", pos));
    },
    nome: (args, runtime, pos) => {
      exigirAridade("NOME", args, 1, 1, pos);
      if (!ehNumero(args[0])) {
        throw erro("TIPO_ARGUMENTOS", "'NOME' espera um número de índice, veio " + paraTexto(args[0]), pos);
      }
      return VFS.nome(args[0]);
    },
    /** Tabela da §32, uma linha por arquivo, na forma `"o" "?" " <nome>`. */
    lista: (args, runtime, pos) => {
      exigirAridade("LISTA", args, 0, 0, pos);
      const linhas = VFS.listFiles().map((n) => '"o" "?" " ' + n + '"');
      return linhas.join("\n");
    },
    apagar: (args, runtime, pos) => {
      exigirAridade("APAGUE", args, 1, 1, pos);
      const nome = nomeDe(args, "APAGUE", pos);
      const apagado = VFS.apagar(nome);
      if (apagado) {
        const i = ESTADO.pilha.indexOf(chaveDeArquivo(nome));
        if (i >= 0) ESTADO.pilha.splice(i, 1);
        emitir("arquivo", { acao: "apagado", nome: chaveDeArquivo(nome) });
      }
      return apagado;
    },
    renomeie: (args, runtime, pos) => {
      exigirAridade("RENOMEIE", args, 2, 2, pos);
      const de = nomeDe(args, "RENOMEIE", pos);
      const para = nomeDe(args.slice(1), "RENOMEIE", pos);
      const ok = VFS.renomeie(de, para);
      if (ok) {
        const i = ESTADO.pilha.indexOf(chaveDeArquivo(de));
        if (i >= 0) ESTADO.pilha[i] = chaveDeArquivo(para);
        emitir("arquivo", { acao: "renomeado", nome: chaveDeArquivo(para) });
      }
      return ok;
    },
    /** Acrescenta uma linha ao arquivo corrente (ou ao nome informado). */
    escrever: (args, runtime, pos) => {
      exigirAridade("ESCREVER", args, 0, 1, pos);
      const nome = args.length > 1 ? nomeDe(args, "ESCREVER", pos) : null;
      const reg = VFS.nomeDo(nome);
      if (!reg) {
        throw erro("RUNTIME_ARQUIVO", "'ESCREVER' precisa de um arquivo corrente: use 'arquivo \"nome.txt\"'", pos);
      }
      reg.linhas.push(paraTexto(args.length === 0 ? "" : args[0]));
      emitir("arquivo", { acao: "escrito", nome: reg.nome });
      return null;
    },
    /**
     * Deixa a próxima linha do arquivo corrente na fila do `leia`.
     *
     * Devolver o valor por `pendentes` (e não por retorno) é o que faz o
     * `LERA` / `leia(x)`-ness do VisuAlg funcionar: `LERA` é comando, e quem
     * consome o valor é a leitura seguinte.
     */
    lera: (args, runtime, pos) => {
      exigirAridade("LERA", args, 0, 0, pos);
      const linha = VFS.proximaLinha(null);
      if (linha === null) {
        throw erro("RUNTIME_ARQUIVO", "'LERA' chegou ao fim do arquivo corrente", pos);
      }
      ESTADO.pendentes.push(linha);
      return null;
    },
  };

  // ------------------------------------------------------------------ §31
  /** Comando `aleatorio`. Sem argumento liga/desliga; com `de,ate` fixa a faixa. */
  function comandoAleatorio(args, runtime, pos) {
    exigirAridade("aleatorio", args, 0, 2, pos);
    const a = ESTADO.aleatorio;
    if (args.length === 0) {
      a.ligado = !a.ligado;
      emitir("aleatorio", { ligado: a.ligado, min: a.min, max: a.max, semente: a.semente });
      return null;
    }
    if (args.length === 1) {
      if (typeof args[0] === "boolean") {
        a.ligado = args[0];
        emitir("aleatorio", { ligado: a.ligado, min: a.min, max: a.max, semente: a.semente });
        return null;
      }
      throw erro(
        "RUNTIME_ENTRADA_INVALIDA",
        "'aleatorio' sem faixa usa 'on'/'off'; com faixa usa 'aleatorio de,ate'",
        pos
      );
    }
    if (!ehNumero(args[0]) || !ehNumero(args[1])) {
      throw erro(
        "RUNTIME_ENTRADA_INVALIDA",
        "'aleatorio de,ate' espera dois números, veio " + paraTexto(args[0]) + " e " + paraTexto(args[1]),
        pos
      );
    }
    const min = Math.trunc(args[0]);
    const max = Math.trunc(args[1]);
    if (max < min) {
      throw erro(
        "RUNTIME_ENTRADA_INVALIDA",
        "'aleatorio' espera 'ate' maior ou igual a 'de', veio " + min + "," + max,
        pos
      );
    }
    a.min = min;
    a.max = max;
    a.ligado = true;
    emitir("aleatorio", { ligado: a.ligado, min: min, max: max, semente: a.semente });
    return null;
  }

  // ------------------------------------------------------------------ §33
  function comandoLimpatela(args, runtime, pos) {
    emitir("limpatela", { linha: pos ? pos.linha : null });
    return null;
  }

  // ------------------------------------------------------------------ §34
  function comandoMudacor(args, runtime, pos) {
    exigirAridade("mudacor", args, 0, 2, pos);
    // `chaveDe` devolve minúsculas e o VisuAlg escreve a cor em MAIÚSCULAS, então
    // a comparação é em maiúsculas. Sem isso, `mudacor("VERDE")` — a forma que o
    // aluno copia do menu — seria rejeitada.
    const nome = args.length === 0 ? "NORMAL" : chaveDe(paraTexto(args[0])).toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(CORES, nome)) {
      throw erro(
        "TIPO_ARGUMENTOS",
        "'mudacor' não conhece a cor '" + paraTexto(args[0]) + "'; use uma de: " +
          Object.keys(CORES).join(", "),
        pos
      );
    }
    let fundo = "FUNDO";
    if (args.length > 1) {
      const f = chaveDe(paraTexto(args[1])).toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(FUNDOS, f)) {
        throw erro(
          "TIPO_ARGUMENTOS",
          "'mudacor' espera 'FRENTE' ou 'FUNDO' como segundo argumento, veio '" + paraTexto(args[1]) + "'",
          pos
        );
      }
      fundo = FUNDOS[f];
    }
    ESTADO.cor = { cor: nome, fundo: fundo };
    emitir("cor", { cor: nome, fundo: fundo });
    return null;
  }

  // ------------------------------------------------------------------ §32
  /** `arquivo "entrada.txt"` declara o arquivo e o torna corrente. */
  function comandoArquivo(args, runtime, pos) {
    exigirAridade("arquivo", args, 1, 2, pos);
    const nome = nomeDe(args, "arquivo", pos);
    let cabecalho = null;
    if (args.length > 1) {
      if (!ehNumero(args[1])) {
        throw erro(
          "TIPO_ARGUMENTOS",
          "'arquivo' espera o tamanho do cabeçalho em linhas, veio " + paraTexto(args[1]),
          pos
        );
      }
      cabecalho = Math.max(0, Math.trunc(args[1]));
    }
    const reg = VFS.abrir(nome, cabecalho);
    emitir("arquivo", { acao: "aberto", nome: reg.nome, cabecalho: reg.cabecalho });
    return null;
  }

  // ------------------------------------------------------------------ §36
  async function comandoPausa(args, runtime, pos) {
    exigirAridade("pausa", args, 0, 1, pos);
    // O argumento, quando presente, tem de ser número. `pausa("dez")` é erro de
    // tipo nomeado, e não um no-op silencioso.
    if (args.length > 0 && !ehNumero(args[0])) {
      throw erro("TIPO_ARGUMENTOS", "'pausa' espera milissegundos, veio " + paraTexto(args[0]), pos);
    }
    // §22 — interrupção INCONDICIONAL do pseudocódigo.
    //
    // O evento é emitido SEMPRE, mesmo sem debugger: quem observar (o painel,
    // um log de teste) precisa ver que o `pausa` foi alcançado. A PAUSA de
    // verdade só acontece com debugger ativo, porque pausar sem ninguém para
    // inspecionar seria um no-op que apenas trava o programa. E a pausa que
    // acontece é a do runtime, com ExecutionPoint, variáveis e pilha — os
    // controles Continuar/Passo/Parar são os do debugger, não os deste evento.
    //
    // O argumento em milissegundos é aceito por compatibilidade de forma, mas
    // não é o que implementa a pausa: esperar N ms e seguir deixaria o
    // usuário sem tempo de inspecionar nada, que é o propósito do comando.
    const linha = pos ? pos.linha : null;
    emitir("pausa", { linha: linha, ms: args.length > 0 ? args[0] : 0 });
    if (runtime && typeof runtime.pausarDeFonte === "function") {
      await runtime.pausarDeFonte("source_pause", pos);
    }
    return null;
  }

  // ------------------------------------------------------------------ §37
  async function comandoDebug(args, runtime, pos) {
    ESTADO.depuracao.ligada = true;
    ESTADO.depuracao.expressoes++;
    if (args.length !== 1) {
      throw erro(
        "TIPO_ARGUMENTOS",
        "'debug' espera uma expressão lógica, veio " + args.length + " argumento(s)",
        pos
      );
    }
    // §23 — breakpoint condicional PROGRAMÁTICO: a condição foi avaliada
    // pelo evaluator da engine (o `avaliar` do runtime, nunca `eval`), e só
    // expressão VERDADEIRA para. Valor não lógico é erro de tipo, não uma
    // parada silenciosa.
    if (args[0] === false) return null;
    if (args[0] !== true) {
      throw erro(
        "TIPO_INCOMPATIVEL",
        "'debug' espera uma condição lógica, veio " + paraTexto(args[0]),
        pos
      );
    }
    ESTADO.depuracao.paradas.push({ linha: pos ? pos.linha : null });
    emitir("debug", { linha: pos ? pos.linha : null, expressao: true, valor: true });
    await runtime.pausarDeFonte("conditional_debug", pos);
    return null;
  }

  // ------------------------------------------------------------------ §38
  function comandoEco(args, runtime, pos) {
    exigirAridade("eco", args, 0, 1, pos);
    if (args.length === 0) ESTADO.eco.ligado = !ESTADO.eco.ligado;
    else ESTADO.eco.ligado = args[0] === true;
    emitir("eco", { ligado: ESTADO.eco.ligado });
    return null;
  }

  // ------------------------------------------------------------------ §39
  function comandoCronometro(args, runtime, pos) {
    exigirAridade("cronometro", args, 0, 1, pos);
    if (args.length === 0) ESTADO.cronometro.ligado = !ESTADO.cronometro.ligado;
    else ESTADO.cronometro.ligado = args[0] === true;
    if (ESTADO.cronometro.ligado) {
      ESTADO.cronometro.inicio = agora();
    } else if (ESTADO.cronometro.inicio > 0) {
      ESTADO.cronometro.ms += agora() - ESTADO.cronometro.inicio;
      ESTADO.cronometro.inicio = 0;
    }
    emitir("cronometro", { ms: ESTADO.cronometro.ms, ligado: ESTADO.cronometro.ligado });
    return null;
  }

  // ------------------------------------------------------------------ §32
  // Tabela de comandos.
  //
  // `forma` é o que o parser (`parser.js`) consulta para decidir quantos
  // argumentos pode ler, e é a RAZÃO de o módulo declarar isso em vez de o
  // parser adivinhar: `aleatorio 1,10` (soltos), `mudacor("A","FRENTE")`
  // (entre parênteses) e `LERA` (nenhum) não podem usar a mesma regra.
  //
  //   "nenhuma"     — `limpatela`, `LERA`
  //   "liga"        — `eco`, `cronometro`: só `on`/`off` (ou nada, que alterna)
  //   "intervalo"   — `aleatorio`: `de,ate` soltos
  //   "expressao"   — `debug`: exatamente uma expressão
  //   "opcional"    — `pausa`: zero ou um número
  //   "argumentos"  — os demais: lista de expressões
  //
  // `executar(args, runtime, pos)` devolve o valor do comando. O runtime
  // imprime o retorno com quebra de linha quando o comando aparece sozinho, e
  // `imprime: false` marca os de efeito puro.
  const COMANDOS = {
    aleatorio: {
      nome: "aleatorio",
      forma: "intervalo",
      ajuda: "'aleatorio', 'aleatorio on', 'aleatorio off' ou 'aleatorio de,ate'",
      executar: comandoAleatorio,
    },
    arquivo: {
      nome: "arquivo",
      forma: "argumentos",
      ajuda: "'arquivo \"nome.txt\"'",
      executar: comandoArquivo,
    },
    limpatela: {
      nome: "limpatela",
      forma: "nenhuma",
      ajuda: "'limpatela' sem argumento",
      executar: comandoLimpatela,
    },
    mudacor: {
      nome: "mudacor",
      forma: "argumentos",
      ajuda: "'mudacor(\"AMARELO\", \"FRENTE\")'",
      executar: comandoMudacor,
    },
    pausa: {
      nome: "pausa",
      forma: "opcional",
      ajuda: "'pausa' ou 'pausa(milissegundos)'",
      executar: comandoPausa,
    },
    debug: {
      nome: "debug",
      forma: "expressao",
      ajuda: "'debug expressao'",
      executar: comandoDebug,
    },
    eco: {
      nome: "eco",
      forma: "liga",
      ajuda: "'eco on', 'eco off' ou 'eco' (alterna)",
      executar: comandoEco,
    },
    cronometro: {
      nome: "cronometro",
      forma: "liga",
      ajuda: "'cronometro on', 'cronometro off' ou 'cronometro' (alterna)",
      executar: comandoCronometro,
    },
    // --- arquivos (§32/§39), em GRAFIÇA DE COMANDO como no VisuAlg 3.x -------
    escrever: {
      nome: "ESCREVER",
      forma: "argumentos",
      imprime: false,
      ajuda: "'ESCREVER(\"linha\")'",
      executar: ARQUIVO.escrever,
    },
    lera: {
      nome: "LERA",
      forma: "nenhuma",
      imprime: false,
      ajuda: "'LERA' sem argumento",
      executar: ARQUIVO.lera,
    },
    existe: {
      nome: "EXISTE",
      forma: "argumentos",
      ajuda: "'EXISTE(\"nome.txt\")'",
      executar: ARQUIVO.existe,
    },
    apague: {
      nome: "APAGUE",
      forma: "argumentos",
      imprime: false,
      ajuda: "'APAGUE(\"nome.txt\")'",
      executar: ARQUIVO.apagar,
    },
    renomeie: {
      nome: "RENOMEIE",
      forma: "argumentos",
      imprime: false,
      ajuda: "'RENOMEIE(\"velho.txt\", \"novo.txt\")'",
      executar: ARQUIVO.renomeie,
    },
    lista: {
      nome: "LISTA",
      forma: "argumentos",
      imprime: false,
      ajuda: "'LISTA' sem argumento",
      // Forma de comando: escreve a tabela no terminal, uma linha por arquivo.
      // A forma de função (`escreva(LISTA())`) devolve o texto inteiro, e é o
      // que o `registro.lista` faz.
      executar: (args, runtime, pos) => {
        const tabela = ARQUIVO.lista(args, runtime, pos);
        if (tabela && runtime && typeof runtime.saida === "function") {
          for (const linha of tabela.split("\n")) runtime.saida(linha + "\n");
        }
        return null;
      },
    },
    tamanho: {
      nome: "TAMANHO",
      forma: "argumentos",
      ajuda: "'TAMANHO(\"nome.txt\")'",
      executar: ARQUIVO.tamanho,
    },
    conteudo: {
      nome: "CONTEUDO",
      forma: "argumentos",
      ajuda: "'CONTEUDO(\"nome.txt\", de, ate)'",
      executar: ARQUIVO.conteudo,
    },
    cabecalho: {
      nome: "CABECALHO",
      forma: "argumentos",
      ajuda: "'CABECALHO(\"nome.txt\", de, ate)'",
      executar: ARQUIVO.cabecalho,
    },
    fim: {
      nome: "FIM",
      forma: "argumentos",
      ajuda: "'FIM(\"nome.txt\")'",
      executar: ARQUIVO.fim,
    },
    nome: {
      nome: "NOME",
      forma: "argumentos",
      ajuda: "'NOME(indice)'",
      executar: ARQUIVO.nome,
    },
  };

  // ------------------------------------------------------------------ §32
  // Builtins chamáveis em EXPRESSÃO.
  //
  // As chaves são minúsculas porque `Runtime.chamar` faz
  // `registros[nome.toLowerCase()]`. `CABEÇALHO` e `CABECALHO` caem na mesma
  // chave pela normalização de acento do `Tokens`, então as duas grafias do
  // VisuAlg funcionam sem duas entradas.
  const REGISTRO = {
    existe: ARQUIVO.existe,
    tamanho: ARQUIVO.tamanho,
    conteudo: ARQUIVO.conteudo,
    cabecalho: ARQUIVO.cabecalho,
    lista: ARQUIVO.lista,
    apague: ARQUIVO.apagar,
    renomeie: ARQUIVO.renomeie,
    // `ESCREVER` e `LERA` em expressão não têm efeito colateral de terminal:
    // `LERA` consome a linha e devolve, `ESCREVER` devolve o que escreveu.
    escrever: ARQUIVO.escrever,
    lera: (args, runtime, pos) => {
      const linha = VFS.proximaLinha(null);
      if (linha === null) {
        throw erro("RUNTIME_ARQUIVO", "'LERA' chegou ao fim do arquivo corrente", pos);
      }
      return linha;
    },
    // §32 — a listagem como função, para `escreva(ARQUIVOS())`.
    arquivos: (args, runtime, pos) => {
      exigirAridade("ARQUIVOS", args, 0, 0, pos);
      return VFS.listFiles().join("\n");
    },
  };

  // `FIM` e `NOME` NÃO entram em `REGISTRO` de propósito, apesar de existirem
  // como método no VFS. O corpus dos 95 exercícios declara variáveis chamadas
  // `fim` (`faccat/ex21.alg`) e `nome` (`faccat/ex23.alg`), e §29.4 proíbe o
  // usuário de declarar o que é builtin: registrar `fim` faria a análise
  // semântica reprovar um exercício que hoje é válido. Continuam acessíveis
  // como método do VFS, que é a forma que a §32 de fato pede.

  // `nomes` e `registro` são bijeção de propósito: um nome aqui sem entrada
  // ali é um builtin que o autocomplete oferece e o runtime não encontra.
  // `FIM` e `NOME` ficam de fora pelos motivos explicados em `REGISTRO`.
  const NOMES = [
    "EXISTE", "TAMANHO", "CONTEUDO", "CABECALHO",
    "LISTA", "APAGUE", "RENOMEIE", "ESCREVER", "LERA", "ARQUIVOS",
  ];

  // ------------------------------------------------- pontos de encaixe no runtime

  /**
   * `Runtime.comandoLer` chama isto ANTES de `entrada(prompt)`.
   *
   * Devolve `null` quando não há nada a injectar — e aí o comportamento é o de
   * sempre, prompt e tudo. A ordem importa: o que o §32 enfileirou (`LERA`) tem
   * precedência sobre o gerador do §31, porque é o mais específico.
   */
  function antesDeEntrada(runtime, prompt) {
    if (ESTADO.pendentes.length > 0) return ESTADO.pendentes.shift();
    if (ESTADO.aleatorio.ligado) return String(inteiroAleatorio());
    return null;
  }

  /**
   * `Runtime.comandoLer` pergunta se deve ecoar o valor lido (§38).
   *
   * O DEFAULT É `false`, e é uma decisão de compatibilidade, não de spec: os
   * testes de `tools/testar.mjs` afirmam as listas exatas de saída de programas
   * com `leia`, e ecoar por padrão mudaria todas elas. `eco on` liga.
   */
  function deveEco() {
    return ESTADO.eco.ligado === true;
  }

  VG.Extensoes = {
    registro: REGISTRO,
    nomes: NOMES,
    comandos: COMANDOS,
    vfs: VFS,
    estado: ESTADO,

    // Contrato de efeitos (§33, §34, §36–§39). No-op enquanto a UI não
    // sobrescrever. Ver a tabela no topo do arquivo.
    aoEvento: function (tipo, dados) {},

    // Pontos de encaixe chamados pelo `runtime.js`.
    antesDeEntrada: antesDeEntrada,
    deveEco: deveEco,

    // Ferramentas para a UI e para os testes.
    semear: semear,
    pausar: pausar,
    reiniciar: function () {
      VFS.reiniciar();
      ESTADO.pendentes.length = 0;
      ESTADO.pilha.length = 0;
      ESTADO.eco.ligado = false;
      ESTADO.aleatorio.ligado = false;
      ESTADO.aleatorio.min = 1;
      ESTADO.aleatorio.max = 100;
      ESTADO.depuracao = { ligada: false, expressoes: 0, paradas: [] };
      return VG.Extensoes;
    },
    CORES: CORES,
    FUNDOS: FUNDOS,
    CHAVE_DE: chaveDe,
  };
})(W.VG);
