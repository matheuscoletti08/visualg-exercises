// §62 — COMPARTILHAMENTO POR URL (`?code=...`).
//
// A ideia é curta: o código do aluno vira um parâmetro de query, o link vai no
// clipboard, e quem abre o link recebe o mesmo código. O que NÃO é curto — e é
// toda a razão deste arquivo existir — é o detalhe que quase todo mundo erra:
//
//   `btoa` não codifica texto; codifica BYTES Latin-1. Passar a string direto
//   dá errado em DOIS níveis, e o segundo é o que engana:
//
//   1. Caractere acima de U+00FF ("€", emoji) — `btoa` LANÇA
//      `InvalidCharacterError`, e o onclick morre com exceção crua.
//   2. Caractere entre U+0080 e U+00FF — `ã`, `é`, `ç` — `btoa` NÃO lança.
//      Ele joga `ã` (U+00E3) como se fosse o byte 0xE3, que em UTF-8 é o
//      INÍCIO de uma sequência de dois bytes (0xC3 0xA3). O link sai mais
//      curto, o decode come metade da sequência, e o aluno recebe um programa
//      diferente do que enviou.
//
// E o pior: o caso 2 é exatamente o texto em português. Um teste com `"a+b<c"`
// passa limpo, o `btoa` cru passa no CI, e o primeiro aluno que cola `não` na
// busca perde o trabalho. Por isso aqui a conversão é manual e explícita:
// string -> bytes UTF-8 -> base64, e o inverso no decode. Não há atalho,
// porque o atalho é o bug.
//
// ESCOLHA DO ALFABETO: base64URL (`-` e `_` no lugar de `+` e `/`). Não é
// estética. Numa query string, `+` é decodificado como ESPAÇO pelo
// `URLSearchParams`/formulário, então um link gerado com `+` chega adulterado do
// outro lado. `-` e `_` são "unreserved" no RFC 3986 e atravessam qualquer
// decoder semAltitude. Na entrada, aceitamos os dois alfabetos e devolvemos o
// caractere à base64 padrão: link colado à mão não é erro, é usuário.
//
// ENVELOPE: o parâmetro é `<versão>.<payload>`, hoje `1.<base64url>`. A versão
// é o que permite, daqui a um ano, trocar a codificação (deflate, chunking)
// sem que um link antigo seja interpretado com as regras novas — o mesmo motivo
// pelo qual a §61 versiona o que grava no storage. E, já que o envelope existe,
// o load VALIDA: versão desconhecida, base64 quebrado ou UTF-8 inválido devolvem
// `{ ok: false, motivo }` com frase legível. Uma tela branca por causa de um
// link colado pela metade é a pior falha possível aqui.
//
// TAMANHO: a §62 pede limite explícito, e é limite de DUAS pontas. Um `.alg` do
// corpus cabe de sobra; um arquivo colado de 200 KB estoura o limite de URL do
// Chrome (~32 KB em HTTP, e a memória da barra de endereço antes disso). Acima
// de `LIMITE_CODIGO` a resposta é erro com o número exato, não um link
// truncado que volta com programa diferente do que foi enviado.
//
// O que NÃO é responsabilidade deste arquivo: executar, salvar, montar DOM,
// ler `location`. Todas as funções recebem a URL (ou a query) como argumento e
// devolvem dados; `extrairParam` não toca em `location` justamente para poder
// ser testada em Node. Nenhum `fetch`, nenhum `eval`, nenhum módulo ES: o
// projeto abre `index.html` por `file://`.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  /** Versão do envelope de `?code=`. Sobe quando a codificação do payload mudar. */
  const VERSAO_FORMATO = 1;

  /** Separador entre versão e payload. `.` é unreserved no RFC 3986. */
  const SEPARADOR = ".";

  /** Nome do parâmetro de query. */
  const PARAMETRO = "code";

  /**
   * Limite do CÓDIGO, em caracteres, medido na origem. 32 KB é folgado de menos
   * para o pior caso do Chrome e generoso para qualquer exercício do corpus (o
   * maior `.alg` do `faccat/`/`manzano/` tem bem menos que isso).
   */
  const LIMITE_CODIGO = 32000;

  /**
   * Limite do PAYLOAD em base64, em caracteres. O baseurl cresce 4/3 sobre os
   * bytes, mais o envelope. Verificado separado do limite do código porque é o
   * que a barra de endereço vê.
   */
  const LIMITE_PAYLOAD = 44000;

  const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // ------------------------------------------------------------------ UTF-8

  /**
   * String -> BYTES UTF-8, um número por byte (0..255).
   *
   * Feito à mão, sem `TextEncoder`, por dois motivos: o resultado precisa ser um
   * array simples para o `btoa` binário, e `TextEncoder` não existe em todo
   * browser antigo que ainda abre este projeto. Surrogates solitários viram
   * U+FFFD (é o que o `TextEncoder` faz) em vez de virar lixo: um `.js` com
   * emoji partido não é erro de codificação, é erro de outra onda.
   */
  function paraBytes(texto) {
    const bytes = [];
    for (let i = 0; i < texto.length; i++) {
      let cp = texto.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff) {
        const prox = i + 1 < texto.length ? texto.charCodeAt(i + 1) : 0;
        if (prox >= 0xdc00 && prox <= 0xdfff) {
          cp = 0x10000 + ((cp - 0xd800) << 10) + (prox - 0xdc00);
          i++;
        } else {
          cp = 0xfffd; // surrogate alto sem par
        }
      } else if (cp >= 0xdc00 && cp <= 0xdfff) {
        cp = 0xfffd; // surrogate baixo sem par
      }
      if (cp < 0x80) {
        bytes.push(cp);
      } else if (cp < 0x800) {
        bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      } else if (cp < 0x10000) {
        bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      }
    }
    return bytes;
  }

  /**
   * BYTES UTF-8 -> string, com VALIDAÇÃO.
   *
   * Devolve `{ ok, texto }` ou `{ ok: false, motivo }`. A validação é estrita de
   * propósito: byte de continuação fora do lugar, sequência truncada, sequência
   * "overlong" (que é a forma canônica de contrabandear `/` numa URL) e surrogate
   * codificado como UTF-8 são todos rejeitados com frase legível. Um decoder
   * permissivo devolveria texto com U+FFFD e o aluno veria um programa com lixo
   * no meio, sem nenhuma mensagem.
   */
  function bytesParaTexto(bytes) {
    let texto = "";
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i];
      let cp;
      let tam;
      if (b0 < 0x80) {
        cp = b0;
        tam = 1;
      } else if (b0 >= 0xc2 && b0 <= 0xdf) {
        cp = b0 & 0x1f;
        tam = 2;
      } else if (b0 >= 0xe0 && b0 <= 0xef) {
        cp = b0 & 0x0f;
        tam = 3;
      } else if (b0 >= 0xf0 && b0 <= 0xf4) {
        cp = b0 & 0x07;
        tam = 4;
      } else {
        return { ok: false, texto: null, motivo: "byte 0x" + hex(b0) + " não começa uma sequência UTF-8 válida" };
      }
      if (i + tam > bytes.length) {
        return {
          ok: false,
          texto: null,
          motivo: "sequência UTF-8 truncada no fim do parâmetro (esperava " + tam + " bytes, restaram " + (bytes.length - i) + ")",
        };
      }
      for (let k = 1; k < tam; k++) {
        const bk = bytes[i + k];
        if ((bk & 0xc0) !== 0x80) {
          return { ok: false, texto: null, motivo: "byte de continuação inválido (0x" + hex(bk) + ") na posição " + (i + k) };
        }
        cp = (cp << 6) | (bk & 0x3f);
      }
      // "overlong": 2 bytes codificando < 0x80, 3 bytes codificando < 0x800, 4
      // bytes codificando < 0x10000. É a forma de passar '/' ou NUL por um
      // filtro que olha só o primeiro byte.
      if ((tam === 2 && cp < 0x80) || (tam === 3 && cp < 0x800) || (tam === 4 && cp < 0x10000)) {
        return { ok: false, texto: null, motivo: "sequência UTF-8 sobrelonga (código U+" + hex(cp) + " em " + tam + " bytes)" };
      }
      if (cp > 0x10ffff) {
        return { ok: false, texto: null, motivo: "código de caractere fora do rango: U+" + hex(cp) };
      }
      if (cp >= 0xd800 && cp <= 0xdfff) {
        return { ok: false, texto: null, motivo: "surrogate codificado como UTF-8 (U+" + hex(cp) + ") não é texto válido" };
      }
      if (cp > 0xffff) {
        const c = cp - 0x10000;
        texto += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
      } else {
        texto += String.fromCharCode(cp);
      }
      i += tam;
    }
    return { ok: true, texto: texto, motivo: null };
  }

  /** Dois dígitos minúsculos, para as mensagens de erro citarem o byte exato. */
  function hex(n) {
    const s = Number(n).toString(16);
    return s.length < 2 ? "0" + s : s;
  }

  // ------------------------------------------------------------------ base64

  /**
   * Bytes -> base64 padrão (`+`, `/`, com `=`), usando o `btoa` do runtime.
   *
   * O passo intermediário é a string BINÁRIA (um caractere por byte, cada um
   * 0..255) e não a string original. É exatamente essa a linha que o `btoa` cru
   * erra: passar a string UTF-8 direto joga `ã` como 0xE3 e quebra a sequência.
   */
  function paraBase64(bytes) {
    const b64 = typeof W.btoa === "function" ? W.btoa : null;
    if (b64) {
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
      }
      return b64(bin);
    }
    return base64Propria(bytes);
  }

  /** Base64 padrão -> bytes, validando o alfabeto ANTES de chamar o `atob`. */
  function deBase64(texto) {
    const limpo = texto.replace(/-/g, "+").replace(/_/g, "/");
    const corpo = limpo.replace(/=+$/, "");
    const forasteiro = /[^A-Za-z0-9+/]/;
    const achado = forasteiro.exec(corpo);
    if (achado) {
      return {
        ok: false,
        bytes: null,
        motivo: "o parâmetro não é base64 válido: caractere '" + achado[0] + "' na posição " + achado.index,
      };
    }
    if (corpo.length % 4 === 1) {
      return { ok: false, bytes: null, motivo: "o parâmetro não é base64 válido: tamanho impossível (" + corpo.length + " caracteres)" };
    }
    const atob = typeof W.atob === "function" ? W.atob : null;
    if (atob) {
      const preenchido = corpo + "=".repeat((4 - (corpo.length % 4)) % 4);
      let bin;
      try {
        bin = atob(preenchido);
      } catch (e) {
        return { ok: false, bytes: null, motivo: "o navegador recusou decodificar o base64 (" + (e && e.name ? e.name : "erro") + ")" };
      }
      const bytes = new Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true, bytes: bytes, motivo: null };
    }
    return base64PropriaDecodificar(corpo);
  }

  /**
   * Base64 próprio, para runtime sem `btoa`/`atob`. Não é o caminho normal: no
   * browser e no Node os dois existem. Existe para o módulo não depender de
   * globais que alguém pode ter substituído (o `§54` proíbe o código do aluno
   * de mexer em storage/rede, e um polyfill de `btoa` monkey-patched entra no
   * mesmo cheiro).
   */
  function base64Propria(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const trio = (b0 << 16) | (b1 << 8) | b2;
      s += BASE64[(trio >> 18) & 0x3f] + BASE64[(trio >> 12) & 0x3f];
      s += i + 1 < bytes.length ? BASE64[(trio >> 6) & 0x3f] : "=";
      s += i + 2 < bytes.length ? BASE64[trio & 0x3f] : "=";
    }
    return s;
  }

  /** Inverso de `base64Propria`; `corpo` já vem sem `=`. */
  function base64PropriaDecodificar(corpo) {
    const bytes = [];
    let i = 0;
    while (i < corpo.length) {
      const c0 = BASE64.indexOf(corpo[i]);
      const c1 = i + 1 < corpo.length ? BASE64.indexOf(corpo[i + 1]) : -1;
      if (c0 < 0 || c1 < 0) {
        return { ok: false, bytes: null, motivo: "base64 inválido perto da posição " + i };
      }
      bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff);
      if (i + 2 < corpo.length) {
        const c2 = BASE64.indexOf(corpo[i + 2]);
        if (c2 < 0) return { ok: false, bytes: null, motivo: "base64 inválido perto da posição " + (i + 2) };
        bytes.push(((c1 << 4) | (c2 >> 2)) & 0xff);
      }
      if (i + 3 < corpo.length) {
        const c3 = BASE64.indexOf(corpo[i + 3]);
        if (c3 < 0) return { ok: false, bytes: null, motivo: "base64 inválido perto da posição " + (i + 3) };
        bytes.push(((c2 << 6) | c3) & 0xff);
      }
      i += 4;
    }
    return { ok: true, bytes: bytes, motivo: null };
  }

  /** Base64 padrão -> base64url: `+` vira `-`, `/` vira `_`, `=` some. */
  function paraBase64Url(padrao) {
    return padrao.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // -------------------------------------------------------------- código ↔ param

  /**
   * Código -> parâmetro de `?code=`.
   *
   * Devolve SEMPRE `{ ok, param, motivo }` e nunca lança: entrada que não é
   * string é erro reportado, não exceção, porque quem chama é um listener de
   * botão e uma exceção ali some da tela sem dizer nada.
   */
  function codigoParaParam(codigo) {
    if (typeof codigo !== "string") {
      return { ok: false, param: null, motivo: "o código precisa ser texto; veio " + tipo(codigo) };
    }
    if (codigo.length > LIMITE_CODIGO) {
      return {
        ok: false,
        param: null,
        motivo:
          "o código tem " + codigo.length + " caracteres e o limite para caber na URL é " +
          LIMITE_CODIGO + ". Compartilhe um trecho menor, ou salve o arquivo.",
      };
    }
    const payload = paraBase64Url(paraBase64(paraBytes(codigo)));
    if (payload.length > LIMITE_PAYLOAD) {
      return { ok: false, param: null, motivo: "o parâmetro ficou com " + payload.length + " caracteres; limite " + LIMITE_PAYLOAD };
    }
    return { ok: true, param: VERSAO_FORMATO + SEPARADOR + payload, motivo: null };
  }

  /**
   * Parâmetro de `?code=` -> código, validando cada etapa.
   *
   * Ordem das checagens: envelope, tamanho, alfabeto base64, bytes UTF-8. Cada
   * falha tem frase própria, e todas mentions o que fazer — porque o usuário que
   * colou o link pela metade precisa de "link incompleto", não de "InvalidCharacterError".
   */
  function paramParaCodigo(param) {
    if (typeof param !== "string") {
      return { ok: false, codigo: null, motivo: "o parâmetro ?" + PARAMETRO + " deveria ser texto; veio " + tipo(param) };
    }
    const bruto = param.trim();
    if (bruto.length === 0) {
      return { ok: false, codigo: null, motivo: "o parâmetro ?" + PARAMETRO + " veio vazio" };
    }
    const corte = bruto.indexOf(SEPARADOR);
    if (corte < 0) {
      return {
        ok: false,
        codigo: null,
        motivo: "o parâmetro ?" + PARAMETRO + " não tem a versão do formato (esperava " + VERSAO_FORMATO + SEPARADOR + "<base64>)",
      };
    }
    const versao = bruto.slice(0, corte);
    if (versao !== String(VERSAO_FORMATO)) {
      return {
        ok: false,
        codigo: null,
        motivo:
          "o link foi feito para a versão " + (versao || "(vazia)") + " do formato e este playground lê a versão " +
          VERSAO_FORMATO + ". Nada foi descartado: o código está no link, mas esta versão não sabe lê-lo.",
      };
    }
    let payload = bruto.slice(corte + 1);
    // Link colado de outra ferramenta (ou de um `URLSearchParams` mal configurado)
    // traz `+` no lugar de espaço. Numa query isso é a decodificação de
    // formulário, e devolver o caractere ao base64 padrão recupera o link.
    payload = payload.replace(/ /g, "+");
    if (payload.length === 0) {
      return { ok: false, codigo: null, motivo: "o link tem a versão do formato mas nenhum código" };
    }
    if (payload.length > LIMITE_PAYLOAD) {
      return {
        ok: false,
        codigo: null,
        motivo: "o parâmetro ?" + PARAMETRO + " tem " + payload.length + " caracteres; o limite é " + LIMITE_PAYLOAD + " (link truncado?)",
      };
    }
    const dec = deBase64(payload);
    if (!dec.ok) return { ok: false, codigo: null, motivo: dec.motivo };
    const txt = bytesParaTexto(dec.bytes);
    if (!txt.ok) return { ok: false, codigo: null, motivo: dec.motivo ? dec.motivo : txt.motivo };
    if (txt.texto.length > LIMITE_CODIGO) {
      return { ok: false, codigo: null, motivo: "o código decodificado tem " + txt.texto.length + " caracteres; o limite é " + LIMITE_CODIGO };
    }
    return { ok: true, codigo: txt.texto, motivo: null };
  }

  // ---------------------------------------------------------------------- URL

  /**
   * Pega o valor de `?code=` de uma query, de uma URL, ou de um `location`.
   *
   * Aceita as três formas porque a origem muda conforme o chamador: a UI passa
   * `location.search`, um teste passa uma string, e um clique em "compartilhar"
   * pode querer reler o próprio link. Nenhuma delas exige `document`, e nenhuma
   * usa `URL`/`URLSearchParams` — a decodificação é feita à mão para que um
   * `%` quebrado no link vire erro do base64 (legível) e não exceção.
   */
  function extrairParam(busca) {
    if (busca == null) return null;
    const s = String(busca);
    const interrog = s.indexOf("?");
    // Sem `?` e sem `=`, a string JÁ É o valor: quem chama pode ter copiado só
    // o payload (do clipboard, de um teste, de outra onda) e não a query. É o
    // caso de uso que faz `extrairParam` continuar pura.
    if (interrog < 0 && s.indexOf("=") < 0) return s.length > 0 ? s : null;
    let trecho = interrog < 0 ? s : s.slice(interrog + 1);
    const hash = trecho.indexOf("#");
    if (hash >= 0) trecho = trecho.slice(0, hash);
    for (const par of trecho.split("&")) {
      if (par === "") continue;
      const igual = par.indexOf("=");
      const nome = igual < 0 ? par : par.slice(0, igual);
      if (nome !== PARAMETRO) continue;
      const valor = igual < 0 ? "" : par.slice(igual + 1);
      try {
        return decodeURIComponent(valor);
      } catch (e) {
        // `%` quebrado: devolve o bruto para a validação do base64 reclamar com
        // a posição exata, que é mais útil que "URI malformed".
        return valor;
      }
    }
    return null;
  }

  /**
   * Monta o link de compartilhamento.
   *
   * `base` é o que chamar já tinha (ex.: `location.href` sem query, ou
   * `index.html`); a função tira a query existente e a âncora, porque anexar
   * `?code=` a uma URL que já tem `?code=` geraria dois códigos e o segundo
   * venceria na leitura. Nenhuma URL absoluta é montada aqui: sob `file://` não
   * existe origin, e é a UI quem decide se compartilha `file:///...` (inútil
   * fora da máquina) ou o caminho servido.
   */
  function linkDeCompartilhamento(codigo, base) {
    const r = codigoParaParam(codigo);
    if (!r.ok) return r;
    const bruto = typeof base === "string" && base.length > 0 ? base : "index.html";
    let limpo = bruto;
    const q = limpo.indexOf("?");
    if (q >= 0) limpo = limpo.slice(0, q);
    const h = limpo.indexOf("#");
    if (h >= 0) limpo = limpo.slice(0, h);
    return { ok: true, param: r.param, link: limpo + "?" + PARAMETRO + "=" + encodeURIComponent(r.param), motivo: null };
  }

  /**
   * Lê o código de uma URL/query pronta. Atalho de `extrairParam` + `paramParaCodigo`,
   * com a diferença de que "não tem ?code=" é erro aqui (o chamador pediu
   * compartimento) e não erro lá (o chamador só queria ver se tinha).
   */
  function lerDeUrl(busca) {
    const param = extrairParam(busca);
    if (param === null) {
      return { ok: false, codigo: null, motivo: "o link não tem ?" + PARAMETRO + "= — ele foi compartilhado sem código?" };
    }
    return paramParaCodigo(param);
  }

  /** Nome de tipo legível, para as mensagens de erro não virarem "[object Object]". */
  function tipo(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  GP.Share = {
    VERSAO_FORMATO: VERSAO_FORMATO,
    PARAMETRO: PARAMETRO,
    LIMITE_CODIGO: LIMITE_CODIGO,
    LIMITE_PAYLOAD: LIMITE_PAYLOAD,
    paraBytes: paraBytes,
    bytesParaTexto: bytesParaTexto,
    codigoParaParam: codigoParaParam,
    paramParaCodigo: paramParaCodigo,
    extrairParam: extrairParam,
    linkDeCompartilhamento: linkDeCompartilhamento,
    lerDeUrl: lerDeUrl,
  };
})(W.VGPlay);
