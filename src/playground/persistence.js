// §61 — PERSISTÊNCIA DO ESTADO DO PLAYGROUND.
//
// O que se guarda: o código do editor, o exercício selecionado, as preferências
// (tema, tamanho da fonte, e o resto que a lista branca abaixo define) e os
// últimos arquivos virtuais (§36). O que NÃO se guarda: execução, variáveis de
// programa, histórico. Não é esquecimento: o estado salvo é WHITELIST, e
// `sanear()` descarta tudo que não estiver na lista antes de serializar. Assim o
// que acabar no disco é exatamente o que este arquivo decidiu que pode — não o
// que o chamador passou.
//
// O problema que domina o desenho: `localStorage` é uma API que LANÇA.
//
//   * Firefox em navegação privada expõe `window.localStorage`, e a PRIMEIRA
//     operação (get/set) lança.
//   * Chrome e Safari lançam `QuotaExceededError` quando a cota estoura — o que
//     acontece com um aluno que colou um programa enorme.
//   * `file://` com cookies de site bloqueados lança em `getItem`.
//
// E a consequência que importa: essa exceção acontece DENTRO de um listener de
// digitação, num `setTimeout` de autosave, enquanto o aluno está colando código.
// Um `try`/`catch` faltando aqui não é um bug detratado, é o Playground inteiro
// quebrado por causa de uma API de navegador. Por isso TODO acesso a storage
// neste arquivo está dentro de `try`/`catch` — não os essenciais, os que ninguém
// lembra de proteger.
//
// E a degradação é OBSERVÁVEL, que é a parte que costuma faltar: quando o
// storage não serve, o playground continua funcionando em memória, mas quem
// integrate precisa poder avisar o aluno de que o trabalho dele não vai
// sobreviver ao F5. Daí o getter `persistindo`. Um fallback silencioso seria
// pior que a falha: o aluno fecharia a aba e perderia o que escreveu, sem ter
// visto aviso nenhum.
//
// VERSIONAMENTO: o dado salvo carrega `versao`. Ler um formato desconhecido
// falha LIMPO (`{ ok: false, motivo }`) em vez de ser interpretado com as regras
// de hoje — o pior desfecho possível num arquivo de estado seria um código
// adulterado em silêncio. Dado de versão diferente não é migrado às cegas: a
// decisão de migrar ou descartar é do integrador, com o motivo na mão.
//
// NENHUM DOM AQUI. `storage` é INJETÁVEL (`criar({ storage })`), e é o que
// permite testar o Firefox-privado-lança e a cota-estourada sem browser nenhum.
// Nada de `fetch`, nada de módulo ES: o projeto abre `index.html` por `file://`.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  /**
   * Versão do formato salvo. Muda quando a forma do dado muda; o `motivo` de
   * rejeição em `deserializar` cita este número, então ele faz parte da
   * interface de quem integra.
   */
  const VERSAO = 1;

  /** Chave padrão no `localStorage`. Versionada no NOME também, por dois motivos. */
  const CHAVE = "vgplay.estado.v1";

  /** Chave da sonda de disponibilidade. Sai apagada; existe só para o teste de escrita. */
  const CHAVE_SONDA = "vgplay.sonda";

  /**
   * Preferências: a lista branca e o valor padrão de cada uma. O tipo declarado
   * é a CONTRATO — `sanear` converte ou descarta o que não bate, então um
   * `localStorage` adulterado à mão (ou de uma versão antiga com outro formato)
   * não injeta `tema: "drop table"` no meio do playground.
   */
  const PREFERENCIAS = {
    tema: { tipo: "texto", valores: ["claro", "escuro"], padrao: "escuro" },
    tamanhoFonte: { tipo: "numero", min: 8, max: 48, padrao: 14 },
    numerosLinha: { tipo: "booleano", padrao: true },
    quebraLinha: { tipo: "booleano", padrao: false },
    ultimosExercicios: { tipo: "lista", limite: 10, padrao: [] },
  };

  /**
   * Teto dos arquivos virtuais guardados (§36). Um `.alg` de 200 KB em
   * `localStorage` é a rota mais curta para `QuotaExceededError`, e arquivo
   * virtual de exercício é pequeno por definição.
   */
  const LIMITE_ARQUIVO = 20000;
  const LIMITE_ARQUIVOS = 20;

  const CODIGO_PADRAO = "";

  // ------------------------------------------------------------- lista branca

  /**
   * Escreve uma chave sem passar por `[[Set]]`.
   *
   * Existe por causa do `__proto__`. Um `localStorage` adulterado à mão (ou o
   * `JSON.parse` de um registro adulterado) produz um objeto COM a chave
   * `__proto__`; `saida[k] = v` nesse caso executa o setter de `Object.prototype`
   * e muda o prototype do objeto inteiro. `defineProperty` grava a chave como
   * dado, que é o que se quer.
   */
  function porChave(alvo, chave, valor) {
    Object.defineProperty(alvo, chave, { value: valor, enumerable: true, writable: true, configurable: true });
  }

  /** Objeto de dados comum, para o que não precisa de proteção de prototype. */
  function vazio() {
    return {};
  }

  /**
   * Normaliza um estado qualquer para o formato exato de gravação.
   *
   * PURE: mesma entrada, mesma saída, sem storage e sem DOM. É o que garante
   * que uma chamada `salvar()` com um objeto meio preenchido não guarde
   * `undefined` no JSON (que vira chave sumindo no `JSON.parse`) nem chave
   * estranha que a próxima versão não vai entender.
   */
  function sanear(bruto) {
    const o = bruto && typeof bruto === "object" ? bruto : {};
    const estado = vazio();
    estado.codigo = typeof o.codigo === "string" ? o.codigo : CODIGO_PADRAO;
    estado.exercicio = o.exercicio == null ? null : String(o.exercicio);
    estado.arquivos = sanearArquivos(o.arquivos);
    estado.preferencias = sanearPreferencias(o.preferencias);
    return estado;
  }

  /** Só as preferências da lista branca, cada uma no tipo declarado. */
  function sanearPreferencias(bruto) {
    const o = bruto && typeof bruto === "object" ? bruto : {};
    const saida = vazio();
    for (const nome of Object.keys(PREFERENCIAS)) {
      const regra = PREFERENCIAS[nome];
      porChave(saida, nome, coerzir(o[nome], regra, regra.padrao));
    }
    return saida;
  }

  /**
   * Arquivos virtuais: mapa `nome -> texto`, com teto de quantidade e de tamanho,
   * e nome normalizado. Nome de arquivo é caminho, então `/` e `\` viram `_`: um
   * nome com `..` gravado no playground seria, no melhor caso, surpresa; no
   * pior, é a estrutura que a §54 (SEGURANÇA) pede para não deixar passar.
   */
  function sanearArquivos(bruto) {
    const o = bruto && typeof bruto === "object" ? bruto : {};
    const saida = vazio();
    const nomes = Object.keys(o).sort();
    for (const nome of nomes) {
      if (Object.keys(saida).length >= LIMITE_ARQUIVOS) break;
      const conteudo = o[nome];
      if (typeof conteudo !== "string") continue;
      porChave(saida, nomeChave(nome), conteudo.length > LIMITE_ARQUIVO ? conteudo.slice(0, LIMITE_ARQUIVO) : conteudo);
    }
    return saida;
  }

  /** Chave de arquivo segura: sem separador de caminho, sem `.`/`..`. */
  function nomeChave(nome) {
    const limpo = String(nome)
      .replace(/[\\/]+/g, "_")
      .replace(/^\.+/, "")
      .trim();
    return limpo.length > 0 ? limpo.slice(0, 120) : "arquivo";
  }

  /** Converte para o tipo declarado, com o padrão quando não dá. */
  function coerzir(valor, regra, padrao) {
    if (regra.tipo === "texto") {
      if (typeof valor !== "string") return padrao;
      if (regra.valores && regra.valores.indexOf(valor) < 0) return padrao;
      return valor;
    }
    if (regra.tipo === "numero") {
      const n = typeof valor === "number" ? valor : parseInt(String(valor), 10);
      if (!isFinite(n)) return padrao;
      return Math.min(regra.max, Math.max(regra.min, Math.round(n)));
    }
    if (regra.tipo === "booleano") {
      if (typeof valor === "boolean") return valor;
      if (valor === "true") return true;
      if (valor === "false") return false;
      return padrao;
    }
    if (regra.tipo === "lista") {
      if (!Array.isArray(valor)) return padrao.slice();
      return valor
        .filter((v) => typeof v === "string" && v.length > 0)
        .slice(0, regra.limite);
    }
    return padrao;
  }

  // -------------------------------------------------------- serializar/ler JSON

  /**
   * Estado -> TEXTO JSON versionado. PURE.
   *
   * `versao` fica no Nível de fora do `estado` porque é metadado do registro, e
   * não uma preferência do playground: `sanear` não deve poder removê-la, e o
   * `estado` interno é o que a UI manipula.
   */
  function serializar(estado, opcoes) {
    const o = opcoes || {};
    const registro = {
      versao: VERSAO,
      origem: typeof o.origem === "string" ? o.origem : "playground",
      estado: sanear(estado),
    };
    return JSON.stringify(registro);
  }

  /**
   * TEXTO JSON -> estado, com falha limpa em cada caso ruim.
   *
   * Devolve SEMPRE `{ ok, estado, motivo }` e nunca lança. Os motivos são
   * distintos de propósito: "não havia nada salvo" (primeira visita) não é erro
   * e não deve ser pintado como erro; "formato de uma versão diferente" é
   * decisão do integrador e precisa dizer qual versão gravou.
   */
  function deserializar(texto) {
    if (typeof texto !== "string" || texto.length === 0) {
      return { ok: false, estado: null, motivo: "não havia nada salvo", versao: null };
    }
    let registro;
    try {
      registro = JSON.parse(texto);
    } catch (e) {
      return { ok: false, estado: null, motivo: "o que está salvo não é JSON válido (salvou-se algo pela metade?)", versao: null };
    }
    if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
      return { ok: false, estado: null, motivo: "o registro salvo não é um objeto", versao: null };
    }
    if (registro.versao === undefined || registro.versao === null) {
      return {
        ok: false,
        estado: null,
        motivo: "o registro salvo não tem número de versão; o formato não pode ser adivinhado",
        versao: null,
      };
    }
    const versao = Number(registro.versao);
    if (!isFinite(versao) || versao !== VERSAO) {
      return {
        ok: false,
        estado: null,
        motivo:
          "o que está salvo é do formato v" + registro.versao + " e este playground lê o v" + VERSAO +
          ". Nada foi sobrescrito: o estado guardado está intacto para outra versão ler.",
        versao: versao,
      };
    }
    if (!registro.estado || typeof registro.estado !== "object") {
      return { ok: false, estado: null, motivo: "o registro v" + VERSAO + " não tem o campo 'estado'", versao: versao };
    }
    return { ok: true, estado: sanear(registro.estado), motivo: null, versao: versao };
  }

  /**
   * Aplica um estado lido em um objeto já existente (o `textarea`, o seletor de
   * exercício, o objeto de preferências da UI).
   *
   * Devolve a lista dos campos realmente aplicados. Quem integra precisa saber
   * o que foi restaurado para não apagar o campo que o usuário está digitando:
   * `restaurar` só escreve o que existe no registro, nunca inventa valor.
   */
  function restaurar(estado, alvo) {
    if (!estado || typeof estado !== "object") return { ok: false, aplicados: [], motivo: "estado vazio" };
    const a = alvo && typeof alvo === "object" ? alvo : {};
    const aplicados = [];
    if (typeof estado.codigo === "string") {
      a.codigo = estado.codigo;
      aplicados.push("codigo");
    }
    if (estado.exercicio !== undefined) {
      a.exercicio = estado.exercicio;
      aplicados.push("exercicio");
    }
    if (estado.arquivos && typeof estado.arquivos === "object") {
      a.arquivos = estado.arquivos;
      aplicados.push("arquivos");
    }
    if (estado.preferencias && typeof estado.preferencias === "object") {
      a.preferencias = estado.preferencias;
      aplicados.push("preferencias");
    }
    return { ok: true, aplicados: aplicados, motivo: null };
  }

  // ------------------------------------------------------------------- storage

  /**
   * O `localStorage` do runtime, ou `null` se nem der para OLHAR.
   *
   * O `try` cobre o acesso à propriedade, não só a operação: no Firefox privado
   * é `window.localStorage` que lança ao ser lido, e um
   * `var s = window.localStorage` fora do `try` já derruba o módulo inteiro.
   */
  function storagePadrao() {
    try {
      return W.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Testa se o storage serve para escrita.
   *
   * Sonda real (escreve e apaga uma chave minuscula), não só checagem de
   * interface: o Firefox privado passa num `typeof getItem === "function"` e
   * lança no `getItem`. A sonda é o que separa "existe" de "funciona".
   */
  function sondar(storage) {
    if (!storage) return { ok: false, motivo: "não há armazenamento local neste ambiente" };
    if (typeof storage.setItem !== "function" || typeof storage.getItem !== "function" || typeof storage.removeItem !== "function") {
      return { ok: false, motivo: "o armazenamento local não implementa a interface mínima (get/set/remove)" };
    }
    try {
      storage.setItem(CHAVE_SONDA, "1");
      storage.removeItem(CHAVE_SONDA);
      return { ok: true, motivo: "" };
    } catch (e) {
      return { ok: false, motivo: descricaoDeErro(e) };
    }
  }

  /** Traduz exceção de storage para frase que o aluno entende. */
  function descricaoDeErro(e) {
    const nome = e && e.name ? e.name : "";
    const codigo = e && e.code !== undefined ? e.code : "";
    if (nome === "QuotaExceededError" || codigo === 22 || codigo === 1014 || /quota/i.test(nome)) {
      return "o armazenamento local está cheio (cota estourada)";
    }
    if (nome === "SecurityError" || /denied|notallowed/i.test(String(nome))) {
      return "o navegador bloqueou o armazenamento local";
    }
    if (nome) return "o armazenamento local falhou: " + nome;
    return "o armazenamento local falhou ao gravar";
  }

  /**
   * Cria a loja.
   *
   * `opcoes`:
   *   storage  — objeto com getItem/setItem/removeItem. Injetável de propósito:
   *              é assim que o modo privado e a cota estourada são testados sem
   *              browser. `null` força memória. Omitido usa `window.localStorage`.
   *   chave    — chave de gravação; padrão `CHAVE`.
   *   memoria  — objeto inicial do fallback em memória.
   *   sonda    — `false` pula a escrita de teste (para storage que só de leitura
   *              viria de outra aba).
   *
   * Devolve um objeto com `salvar`, `ler`, `limpar`, `reintegrar`, `tenhoDados`,
   * e os getters `persistindo`, `modo`, `motivo` e `ultimoErro`.
   */
  function criar(opcoes) {
    const o = opcoes || {};
    const chave = typeof o.chave === "string" && o.chave ? o.chave : CHAVE;
    const original = Object.prototype.hasOwnProperty.call(o, "storage") ? o.storage : storagePadrao();

    /** Estado atual do fallback em memória. Sobrevive à loja, não ao F5. */
    const memoria = Object.assign(vazio(), (o.memoria && typeof o.memoria === "object" ? o.memoria : {}));

    let storage = original || null;
    let modo = "memoria";
    let motivo = "";
    let ultimoErro = null;
    let haveDados = false;

    if (storage) {
      const s = o.sonda === false ? { ok: true, motivo: "" } : sondar(storage);
      if (s.ok) {
        modo = "localStorage";
      } else {
        storage = null;
        motivo = s.motivo;
        ultimoErro = s.motivo;
      }
    } else {
      motivo = "não há armazenamento local neste ambiente";
      ultimoErro = motivo;
    }

    /**
     * Reavalia o storage ORIGINAL e, se voltou a servir, promove a memória para
     * ele. A cota pode ter sido liberada e o Firefox privado pode ter virado
     * janela normal; o playground não deve ficar preso à degradação para sempre.
     */
    function reintegrar() {
      if (!original) return { ok: false, motivo: motivo };
      const s = sondar(original);
      if (!s.ok) {
        modo = "memoria";
        motivo = s.motivo;
        ultimoErro = s.motivo;
        return { ok: false, motivo: s.motivo };
      }
      storage = original;
      modo = "localStorage";
      motivo = "";
      ultimoErro = null;
      // Se havia estado só em memória, ele é promovido para o disco agora: é a
      // chance de o aluno não perder o trabalho que digitou durante a degradação.
      if (memoria.__texto) {
        try {
          storage.setItem(chave, memoria.__texto);
        } catch (e) {
          storage = null;
          modo = "memoria";
          motivo = descricaoDeErro(e);
          ultimoErro = motivo;
          return { ok: false, motivo: motivo };
        }
      }
      return { ok: true, motivo: "" };
    }

    /**
     * Grava o estado. NUNCA lança e NUNCA devolve `{ ok: true }` mentindo: se a
     * gravação no disco falhou, a resposta é `ok: false` com o motivo, mesmo que
     * os dados tenham ficado em memória. A UI usa isso para o aviso.
     */
    function salvar(estado, opcoesSalvar) {
      const texto = serializar(estado, opcoesSalvar);
      memoria.__texto = texto;
      haveDados = true;
      if (modo !== "localStorage" || !storage) {
        return { ok: false, motivo: motivo || "sem armazenamento local; o estado ficou só nesta aba" };
      }
      try {
        storage.setItem(chave, texto);
        return { ok: true, motivo: null };
      } catch (e) {
        // Cota estourada, storage bloqueado, aba em modo privado: degrada para
        // memória e FICA degradada. Re-tentar a cada tecla é o que transforma um
        // erro de cota em travamento do editor.
        motivo = descricaoDeErro(e);
        ultimoErro = e;
        storage = null;
        modo = "memoria";
        return { ok: false, motivo: motivo, erro: e };
      }
    }

    /**
     * Lê o estado salvo. Lê do storage quando há storage; senão, da memória.
     * Dado de versão incompatível chega intacto daqui e é rejeitado no
     * `deserializar` — ou seja, o arquivo NÃO é apagado por um erro de leitura.
     */
    function ler() {
      let texto = null;
      let origem = modo;
      if (modo === "localStorage" && storage) {
        try {
          texto = storage.getItem(chave);
        } catch (e) {
          motivo = descricaoDeErro(e);
          ultimoErro = e;
          storage = null;
          modo = "memoria";
          origem = "memoria";
          texto = memoria.__texto || null;
        }
      } else {
        texto = memoria.__texto || null;
      }
      if (texto === null || texto === undefined) {
        haveDados = false;
        return { ok: false, estado: null, motivo: "não havia nada salvo", versao: null, origem: origem };
      }
      const r = deserializar(texto);
      if (r.ok) haveDados = true;
      return {
        ok: r.ok,
        estado: r.estado,
        motivo: r.motivo,
        versao: r.versao,
        origem: origem,
        bruto: texto,
      };
    }

    /** Apaga o registro. some do disco quando há disco; da memória sempre. */
    function limpar() {
      memoria.__texto = null;
      haveDados = false;
      if (modo !== "localStorage" || !storage) return { ok: modo !== "localStorage", motivo: motivo };
      try {
        storage.removeItem(chave);
        return { ok: true, motivo: null };
      } catch (e) {
        motivo = descricaoDeErro(e);
        ultimoErro = e;
        storage = null;
        modo = "memoria";
        return { ok: false, motivo: motivo };
      }
    }

    const loja = {
      salvar: salvar,
      ler: ler,
      limpar: limpar,
      reintegrar: reintegrar,
      tenhoDados: function () {
        return haveDados;
      },
      /**
       * `persistindo` é a pergunta que a UI precisa responder ANTES de mentir
       * para o aluno que o trabalho dele está salvo. `false` = está em memória,
       * um F5 perde o que está no editor.
       */
      get persistindo() {
        return modo === "localStorage";
      },
      get modo() {
        return modo;
      },
      get motivo() {
        return modo === "localStorage" ? "" : motivo;
      },
      get ultimoErro() {
        return ultimoErro;
      },
      get chave() {
        return chave;
      },
      /** `true` se o storage injetado passou na sonda. Diagnóstico, não UI. */
      get temStorage() {
        return modo === "localStorage";
      },
    };
    return loja;
  }

  GP.Persistence = {
    VERSAO: VERSAO,
    CHAVE: CHAVE,
    PREFERENCIAS: PREFERENCIAS,
    LIMITE_ARQUIVO: LIMITE_ARQUIVO,
    LIMITE_ARQUIVOS: LIMITE_ARQUIVOS,
    criar: criar,
    sanear: sanear,
    serializar: serializar,
    deserializar: deserializar,
    restaurar: restaurar,
    sondar: sondar,
  };
})(W.VGPlay);
