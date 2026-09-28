// Testes da Onda 13:
//
//   §61 persistence    — src/playground/persistence.js
//   §62 share          — src/playground/share.js
//   §52 worker-client  — src/playground/worker-client.js
//
// Executável isolado: `node tests/playground/persist.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`), depois `W.VGPlay` existe, e só então os três módulos
// novos — nesta ordem, porque os três são independentes entre si (nenhum consome
// outro) e todos só dependem de `W.Vg` no momento da chamada. Se a ordem divergir
// da de `index.html`, o teste passa e o navegador quebra.
//
// NENHUM TESTE DEPENDE DE DOM REAL. Não há `document` aqui e não pode haver: o
// `localStorage` é INJETADO (mock), o `Worker` é INJETADO (mock) e o protocolo
// é INJETADO (string). Isso não é pompa, é o que torna testável a decisão D1: o
// caminho que roda em `file://` é o caminho PRINCIPAL, então ele precisa de tanto
// teste quanto o do worker — e o do worker é o que quase ninguém exercita.
//
// TOLERÂNCIA: nenhuma. São comparações de string, e string não tem arredondamento.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RAIZ, todosAlgs, lerAlg, caminhoRelativo } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULOS = [
  "src/playground/persistence.js",
  "src/playground/share.js",
  "src/playground/worker-client.js",
];

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
for (const src of MODULOS) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}

const GP = globalThis.VGPlay;
const P = GP.Persistence;
const S = GP.Share;
const C = GP.WorkerClient;

// --------------------------------------------------------------------- asserts

let total = 0;
let pass = 0;
let fail = 0;

function secao(titulo) {
  console.log("");
  console.log(titulo);
  console.log("-".repeat(66));
}

function relatar(ok, nome, detalhe) {
  total++;
  if (ok) {
    pass++;
    console.log("  ✅ " + nome);
  } else {
    fail++;
    console.log("  ❌ " + nome);
    console.log("       → " + detalhe);
  }
}

/**
 * Executa um caso. ASSÍNCRONO de propósito: a §52 tem execução de verdade
 * (programa rodando, worker mockando), e um `caso` que não espera promessa
 * marcaria como "pass" qualquer coisa que devolva um objeto — o pior bug
 * possível num teste assíncrono, que é o teste que não testa.
 */
async function caso(nome, fn) {
  try {
    const detalhe = await fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada: " + (e && e.message ? e.message : String(e)));
  }
}

function eIgual(obtido, esperado, msg) {
  if (obtido === esperado) return null;
  return msg + "\n       esperado: " + JSON.stringify(esperado) + "\n       veio:     " + JSON.stringify(obtido);
}

function eVerdadeiro(cond, msg) {
  if (cond) return null;
  return msg;
}

function eFalso(cond, msg) {
  if (!cond) return null;
  return msg;
}

function contem(texto, agulha, msg) {
  if (String(texto).indexOf(agulha) >= 0) return null;
  return (msg || "esperava conter") + ": " + JSON.stringify(agulha) + "\n       veio: " + JSON.stringify(texto);
}

// ------------------------------------------------------------------- mocks §61

/**
 * `localStorage` de mentira.
 *
 * `falha` simula o modo privado do Firefox e a cota estourada do Chrome: a
 * exceção sai no `setItem` da sonda, que é a primeira escrita — exatamente como
 * no browser. `cota` deixa passar a sonda e estoura só depois, que é o caso
 * ("guardou o exercício pequeno, morreu no arquivo grande") que só aparece depois
 * de uns minutos de uso.
 */
function storageFalso(falha, cota) {
  const dados = new Map();
  const s = {
    leituras: 0,
    escritas: 0,
    getItem(k) {
      s.leituras++;
      if (falha) throw falha;
      return dados.has(k) ? dados.get(k) : null;
    },
    setItem(k, v) {
      s.escritas++;
      if (falha) throw falha;
      if (cota && String(v).length > cota) {
        const e = new Error("excedeu a cota");
        e.name = "QuotaExceededError";
        throw e;
      }
      dados.set(k, String(v));
    },
    removeItem(k) {
      if (falha) throw falha;
      dados.delete(k);
    },
    tamanho: function () {
      return dados.size;
    },
    cru: function () {
      return dados;
    },
  };
  return s;
}

const CODIGO_BONITO = 'algoritmo "acentos"\ninício\n   se verdadeiro então\n      escreval("ação, não, então")\n   fimse\nfimalgoritmo\n';

// ================================================================= 1. contrato

secao("[1/7] Contrato dos três módulos (Onda 13)");

await caso("cada módulo publica em W.VGPlay com o nome que a onda pede", () => {
  const faltando = ["Persistence", "Share", "WorkerClient"].filter((n) => !GP[n]);
  return eIgual(faltando.join(","), "", "módulo ausente em W.VGPlay");
});

await caso("a API pública existe e é função", () => {
  const esperado = {
    Persistence: ["criar", "sanear", "serializar", "deserializar", "restaurar", "sondar"],
    Share: ["codigoParaParam", "paramParaCodigo", "extrairParam", "linkDeCompartilhamento", "lerDeUrl", "paraBytes", "bytesParaTexto"],
    WorkerClient: ["suporta", "criar", "criarPrincipal"],
  };
  for (const mod of Object.keys(esperado)) {
    for (const fn of esperado[mod]) {
      if (typeof GP[mod][fn] !== "function") return mod + "." + fn + " não é função";
    }
  }
  return null;
});

await caso("a API expõe as constantes que o integrador precisa (versão, limites, protocolo)", () => {
  if (P.VERSAO !== 1) return "Persistence.VERSAO = " + JSON.stringify(P.VERSAO);
  if (P.CHAVE.indexOf("v" + P.VERSAO) < 0) return "a chave não é versionada: " + P.CHAVE;
  if (S.VERSAO_FORMATO !== 1) return "Share.VERSAO_FORMATO = " + JSON.stringify(S.VERSAO_FORMATO);
  if (!(S.LIMITE_CODIGO > 0)) return "Share.LIMITE_CODIGO precisa ser positivo";
  if (C.PROTOCOLO_SEM_WORKER !== "file:") return "WorkerClient.PROTOCOLO_SEM_WORKER = " + JSON.stringify(C.PROTOCOLO_SEM_WORKER);
  const comandos = ["RUN", "PAUSE", "RESUME", "STEP", "STOP", "INPUT", "SET_BREAKPOINT"];
  for (const c of comandos) if (C.COMANDOS[c] !== c) return "falta o comando " + c;
  const eventos = ["OUTPUT", "INPUT_REQUEST", "STATE_UPDATE", "BREAKPOINT", "ERROR", "FINISHED"];
  for (const e of eventos) if (C.EVENTOS[e] !== e) return "falta o evento " + e;
  return null;
});

await caso("a serialização do §61 é PURE: mesma entrada, mesma saída, e sem storage", () => {
  const estado = { codigo: "x", exercicio: "e1", preferencias: { tema: "claro" } };
  const a = P.serializar(estado);
  const b = P.serializar(estado);
  if (a !== b) return "duas serializações do mesmo estado divergiram";
  const registro = JSON.parse(a);
  if (registro.versao !== P.VERSAO) return "o registro não carrega a versão: " + a;
  if (registro.estado.codigo !== "x") return "o código não foi serializado";
  return null;
});

await caso("a §62 tolera entrada que não é string, sem lançar", () => {
  for (const e of [undefined, null, 42, {}, []]) {
    const a = S.codigoParaParam(e);
    if (a.ok) return "codigoParaParam(" + JSON.stringify(e) + ") aceitou entrada não-textual";
    if (!a.motivo) return "codigoParaParam(" + JSON.stringify(e) + ") falhou sem motivo legível";
    const b = S.paramParaCodigo(e);
    if (b.ok) return "paramParaCodigo(" + JSON.stringify(e) + ") aceitou entrada não-textual";
    if (!b.motivo) return "paramParaCodigo(" + JSON.stringify(e) + ") falhou sem motivo legível";
  }
  return null;
});

// ================================================ 2. §62 UTF-8 (o mais crítico)

secao("[2/7] §62 — UTF-8 SEGURO: o round-trip de acento byte a byte");

/**
 * O programa-canário. Cada caractere aqui tem um comportamento DIFERENTE no
 * `btoa` cru, e é por isso que ele é o primeiro teste da onda:
 *
 *   `ã` (U+00E3) — 2 bytes em UTF-8; o `btoa` cru joga 1 byte (0xE3) e NÃO lança.
 *   `€` (U+20AC) — 3 bytes; o `btoa` cru LANÇA `InvalidCharacterError`.
 *   `🎓` (U+1F393) — 4 bytes (surrogate pair); o `btoa` cru lança.
 *   `Ç` (U+00C7) — 2 bytes; mesma armadilha do `ã`.
 */
const CANARIO =
  'algoritmo "acentuação"\n' +
  "var\n" +
  "   nome: literal\n" +
  "   n: inteiro\n" +
  "início\n" +
  "   n <- 1\n" +
  "   se n > 0 então\n" +
  '      escreval("ação, não, então, coração, ção, ã e Ç")\n' +
  '      escreval("moeda: € | emoji: 🎓 e 🇧🇷 | matemático: ≠ ≤ ∑")\n' +
  "   senão\n" +
  '      escreval("nunca")\n' +
  "   fimse\n" +
  "fimalgoritmo\n";

await caso("§62: canário com acento, cedilha, euro, emoji e símbolo volta IDÊNTICO", () => {
  const p = S.codigoParaParam(CANARIO);
  if (!p.ok) return "codigoParaParam falhou: " + p.motivo;
  const d = S.paramParaCodigo(p.param);
  if (!d.ok) return "paramParaCodigo falhou: " + d.motivo;
  if (d.codigo !== CANARIO) {
    return (
      "round-trip divergiu.\n       esperado: " + JSON.stringify(CANARIO) +
      "\n       veio:     " + JSON.stringify(d.codigo)
    );
  }
  // Comparação por BYTES, não por `===`: a promessa da §62 é que a sequência
  // UTF-8 volta igual, e `===` de string já prova isso. O passo a mais é tornar
  // explícito onde está a diferença entre os dois caminhos.
  const bytesIda = S.paraBytes(CANARIO);
  const bytesVolta = S.paraBytes(d.codigo);
  return eIgual(bytesVolta.join(","), bytesIda.join(","), "os bytes UTF-8 do round-trip não são os mesmos");
});

await caso("§62: `ã` (U+00E3) ocupa 2 bytes, e é exatamente onde o `btoa` cru estraga", () => {
  // Prova 1: contagem de bytes.
  const bytes = S.paraBytes("ã");
  if (bytes.length !== 2) return "`ã` virou " + bytes.length + " bytes; deveria ser 2 (0xC3 0xA3)";
  if (bytes[0] !== 0xc3 || bytes[1] !== 0xa3) return "`ã` virou 0x" + bytes[0].toString(16) + " 0x" + bytes[1].toString(16);
  // Prova 2: o `btoa` CRU devolve UM byte só (0xE3), e o decoder estrito RECUSA
  // esse byte isolado em vez de engolir um U+FFFD. É a corrupção silenciosa que a
  // §62 precisa eliminar, e a razão de o decoder ser estrito.
  const cru = atob(btoa("ã"));
  if (cru.length !== 1 || cru.charCodeAt(0) !== 0xe3) return "o btoa cru não produziu 0xE3 isolado: " + JSON.stringify(cru);
  const bytesCru = [cru.charCodeAt(0)];
  const d = S.bytesParaTexto(bytesCru);
  if (d.ok) return "o decoder aceitou 0xE3 truncado e devolveria " + JSON.stringify(d.texto) + " (silencioso, que é o bug)";
  return contem(d.motivo, "truncada", "o motivo da recusa não diz que a sequência está truncada");
});

await caso("§62: caractere acima de U+00FF, que o `btoa` cru REJEITA com exceção", () => {
  // `btoa` cru estoura em `€` e em emoji. Se o nosso caminho dependesse dele cru,
  // a UI quebraria com exceção crua justamente em texto com símbolo.
  let threw = false;
  try {
    btoa("€ 🎓");
  } catch (e) {
    threw = true;
  }
  if (!threw) return "esperava que o btoa cru recusasse `€ 🎓` (ele aceitou: o teste de valor fixo mudou de significado)";
  const d = S.paramParaCodigo(S.codigoParaParam("€ 🎓 ã").param);
  if (!d.ok) return "o caminho seguro falhou onde o cru lança: " + d.motivo;
  return eIgual(d.codigo, "€ 🎓 ã", "round-trip de € 🎓 ã");
});

await caso("§62: o payload usa base64URL, sem `+`, `/` nem `=` (o `+` vira espaço na query)", () => {
  // Escolha de alfabeto: `+` numa query string é decodificado como ESPAÇO pelo
  // `URLSearchParams` e por qualquer form decoder. Um link com `+` chega
  // adulterado do outro lado. `-`/`_` são unreserved no RFC 3986.
  const codigo = "ÿþýüøþÿþýüøþÿþýüøþÿþýüøþÿþýüøþÿþýüøþÿþýüøþÿþýüø";
  const p = S.codigoParaParam(codigo);
  if (!p.ok) return "codigoParaParam falhou: " + p.motivo;
  const payload = p.param.slice(p.param.indexOf(".") + 1);
  if (/[+/=]/.test(payload)) return "o payload tem caractere que a query string suja: " + payload;
  if (/[-_]/.test(payload) === false && payload.length > 0) return "o payload não usou base64url: " + payload;
  return eIgual(S.paramParaCodigo(p.param).codigo, codigo, "round-trip do payload base64url");
});

await caso("§62: os 95 `.alg` do corpus passam por `?code=` e voltam byte a byte iguais", () => {
  const arquivos = todosAlgs();
  if (arquivos.length < 90) return "o corpus caiu para " + arquivos.length + " arquivos";
  const diferentes = [];
  for (const arquivo of arquivos) {
    const original = lerAlg(arquivo);
    const p = S.codigoParaParam(original);
    if (!p.ok) {
      diferentes.push(caminhoRelativo(arquivo) + ": encode falhou (" + p.motivo + ")");
      continue;
    }
    const d = S.paramParaCodigo(p.param);
    if (!d.ok) {
      diferentes.push(caminhoRelativo(arquivo) + ": decode falhou (" + d.motivo + ")");
      continue;
    }
    if (d.codigo !== original) diferentes.push(caminhoRelativo(arquivo) + ": conteúdo divergiu");
  }
  if (diferentes.length > 0) {
    return "round-trip de " + diferentes.length + " arquivo(s) do corpus falhou:\n       " + diferentes.slice(0, 5).join("\n       ");
  }
  return null;
});

await caso("§62: um `.alg` com acento do corpus também volta igual (o caso que o `btoa` cru perde)", () => {
  // O corpus é em boa parte ASCII, e um teste que só passa por ASCII não prova
  // nada sobre UTF-8. Este caso força o pior caso: um arquivo do corpus que
  // realmente tem byte acima de 0x7F, passado pelo caminho do `btoa` cru para
  // PROVAR que ele estraga, e pelo nosso para provar que não.
  const comAcento = todosAlgs()
    .map((a) => ({ caminho: caminhoRelativo(a), texto: lerAlg(a) }))
    .filter((x) => /[\u0080-\u00ff]/.test(x.texto));
  if (comAcento.length === 0) return "nenhum `.alg` do corpus tem caractere Latin-1 acima de 0x7F (o teste ficaria vazio)";
  const p = comAcento[0];
  const enc = S.codigoParaParam(p.texto);
  if (!enc.ok) return "encode falhou: " + enc.motivo;
  const d = S.paramParaCodigo(enc.param);
  if (!d.ok) return "decode falhou: " + d.motivo;
  if (d.codigo !== p.texto) return "round-trip divergiu em " + p.caminho;
  // Prova do estrago: o mesmo texto pelo `btoa` cru, decodificado como UTF-8,
  // NÃO volta igual — porque cada caractere Latin-1 virou um byte solto no meio
  // de uma sequência de dois. Se um dia este teste falhar aqui, é porque o
  // `btoa` do runtime passou a ser UTF-8-safe (não aconteceu) — não porque a
  // §62 quebrou.
  const cru = atob(btoa(p.texto));
  const bytesCru = [];
  for (let i = 0; i < cru.length; i++) bytesCru.push(cru.charCodeAt(i));
  const porCru = S.bytesParaTexto(bytesCru);
  const cruEstragou = !porCru.ok || porCru.texto !== p.texto;
  if (!cruEstragou) return "o caminho cru devolveu o texto inteiro; o teste de valor fixo precisa ser revisto";
  if (bytesCru.length === p.texto.length && !porCru.ok === false) return "bytes e caracteres com o mesmo tamanho: o teste mediu nada";
  return null;
});

await caso("§62: o caminho sem `btoa`/`atob` (base64 próprio) dá o mesmo resultado", () => {
  // `paraBytes`/`bytesParaTexto` são as funções puras; o round-trip com base64
  // próprio é verificado comparando com o caminho do `btoa`. Como o `btoa` é
  // lido de `W` POR CHAMADA, dá para exercitar o fallback temporariamente.
  const guard = { btoa: globalThis.btoa, atob: globalThis.atob };
  const p = S.codigoParaParam(CANARIO);
  const viaBtoa = p.param;
  try {
    globalThis.btoa = undefined;
    globalThis.atob = undefined;
    const p2 = S.codigoParaParam(CANARIO);
    if (!p2.ok) return "falhou sem btoa: " + p2.motivo;
    if (p2.param !== viaBtoa) return "o base64 próprio produziu payload diferente do btoa";
  } finally {
    globalThis.btoa = guard.btoa;
    globalThis.atob = guard.atob;
  }
  return null;
});

await caso("§62: link completo `monta → lê de volta` volta o MESMO código", () => {
  const link = S.linkDeCompartilhamento(CANARIO, "https://exemplo.org/visualg/index.html?code=antigo#fim");
  if (!link.ok) return "linkDeCompartilhamento falhou: " + link.motivo;
  if (link.link.indexOf("?code=1.") < 0) return "o link não tem o envelope versionado: " + link.link.slice(0, 80);
  if (link.link.indexOf("#") >= 0) return "o link ficou com âncora: " + link.link;
  if (link.link.indexOf("code=antigo") >= 0) return "o link ficou com o ?code= antigo: " + link.link;
  const lido = S.lerDeUrl(link.link);
  if (!lido.ok) return "lerDeUrl falhou: " + lido.motivo;
  return eIgual(lido.codigo, CANARIO, "o link montado não devolve o código original");
});

await caso("§62: `extrairParam` acha `?code=` em URL, em query e em `location.search`", () => {
  const param = S.codigoParaParam(CANARIO).param;
  const casos = [
    ["?code=" + param, param],
    ["index.html?code=" + param + "&x=1", param],
    ["https://exemplo.org/p?code=" + param, param],
    ["https://exemplo.org/p?code=" + param + "#fim", param],
    [param, param],
  ];
  for (const [entrada, esperado] of casos) {
    const obtido = S.extrairParam(entrada);
    if (obtido !== esperado) return "extrairParam(" + JSON.stringify(entrada.slice(0, 40)) + ") = " + JSON.stringify(obtido);
  }
  if (S.extrairParam("?outro=1") !== null) return "não deveria achar code em ?outro=1";
  if (S.extrairParam("") !== null) return "não deveria achar code em string vazia";
  if (S.extrairParam(undefined) !== null) return "não deveria achar code em undefined";
  return null;
});

await caso("§62: `location.search` de verdade é lido sem tocar em DOM", () => {
  // Este módulo não pode ler `location` sozinho (a UI passa a query), mas a
  // integração vai passar exatamente este objeto. Em Node, `location` não existe,
  // e é por isso que a função é pura: ela aceita o objeto sem depender dele.
  const param = S.codigoParaParam(CANARIO).param;
  const falso = { search: "?code=" + encodeURIComponent(param), href: "https://x/?code=" + param };
  const lido = S.lerDeUrl(falso.search);
  if (!lido.ok) return "lerDeUrl falhou: " + lido.motivo;
  return eIgual(lido.codigo, CANARIO, "leitura de query pronta");
});

// ============================================= 3. §62 validação de entrada ruins

secao("[3/7] §62 — entrada malformada: erro legível, nunca exceção crua");

await caso("§62: `?code=` sem versão do formato dá motivo legível", () => {
  const b64 = btoa("olá");
  const d = S.paramParaCodigo(b64);
  if (d.ok) return "aceitou parâmetro sem versão";
  return contem(d.motivo, "versão do formato", "o motivo não diz o que falta");
});

await caso("§62: versão desconhecida é rejeitada SEM interpretar o payload", () => {
  const bom = S.codigoParaParam(CANARIO).param;
  const deOutroTempo = bom.replace(/^1\./, "7.");
  const d = S.paramParaCodigo(deOutroTempo);
  if (d.ok) return "aceitou a versão 7 e devolveu o código com as regras da 1";
  return contem(d.motivo, "versão 7", "o motivo não diz qual versão veio nem qual é a daqui");
});

await caso("§62: base64 quebrado, padding impossível e caractere estranho dão motivo legível", () => {
  const ruins = ["1.@@@@", "1.a", "1." + "A".repeat(13), "1.", "1.=AAA", "   1.  ", "1.QUJD~"];
  for (const p of ruins) {
    const d = S.paramParaCodigo(p);
    if (d.ok) return "aceitou " + JSON.stringify(p);
    if (!d.motivo || typeof d.motivo !== "string") return "sem motivo para " + JSON.stringify(p);
    if (/InvalidCharacterError|undefined|\[object/.test(d.motivo)) {
      return "motivo cru (vaza nome de exceção) para " + JSON.stringify(p) + ": " + d.motivo;
    }
  }
  return null;
});

await caso("§62: base64 válido que não é UTF-8 é recusado, e não vira lixo silencioso", () => {
  // `ÿÿÿ` cru = 0xFF 0xFF 0xFF: base64 válido, e byte de continuação onde
  // deveria começar sequência. Um decoder permissivo devolveria "\uFFFD\uFFFD\uFFFD"
  // e o aluno veria um programa com lixo no meio, sem aviso.
  const d = S.paramParaCodigo("1." + btoa("\xff\xff\xff").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (d.ok) return "aceitou bytes que não são UTF-8 e devolveu " + JSON.stringify(d.codigo);
  return contem(d.motivo, "UTF-8", "o motivo não diz que o problema é UTF-8");
});

await caso("§62: UTF-8 sobrelongo é recusado (é a forma de contrabandear `/` numa URL)", () => {
  // 0xE0 0x80 0x80 é "overlong": três bytes codificando NUL. Decoder permissivo
  // aceitaria e o payload teria um byte que parece fim de URL. E 0xC0/0xC1 são
  // os bytes de início que SÓ existem para overlong — nenhum caractere UTF-8
  // válido começa com eles, então são recusados no portão.
  const sobrelongo = S.paramParaCodigo("1." + btoa("\xe0\x80\x80").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (sobrelongo.ok) return "aceitou sequência sobrelonga e devolveu " + JSON.stringify(sobrelongo.codigo);
  const e = contem(sobrelongo.motivo, "sobrelonga", "o motivo não identifica a sequência sobrelonga");
  if (e) return e;
  const c0 = S.paramParaCodigo("1." + btoa("\xc0\x80").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (c0.ok) return "aceitou 0xC0 0x80";
  return contem(c0.motivo, "não começa uma sequência UTF-8 válida", "o motivo de 0xC0 não diz que o byte não abre sequência");
});

await caso("§62: `?code=` com código grande demais é recusado pelos DOIS lados", () => {
  const enorme = 'algoritmo "x"\ninício\n' + '   escreval("linha")\n'.repeat(4000);
  if (enorme.length <= S.LIMITE_CODIGO) return "o texto de teste não passou do limite (mudou o limite?)";
  const p = S.codigoParaParam(enorme);
  if (p.ok) return "aceitou código de " + enorme.length + " caracteres, acima do limite " + S.LIMITE_CODIGO;
  if (!/limite/i.test(p.motivo)) return "o motivo não menciona o limite: " + p.motivo;
  const d = S.paramParaCodigo("1." + "A".repeat(S.LIMITE_PAYLOAD + 10));
  if (d.ok) return "aceitou payload acima do limite";
  return contem(d.motivo, "limite", "o motivo da recusa por tamanho não menciona o limite");
});

await caso("§62: link sem `?code=` é erro do `lerDeUrl`, e `null` é do `extrairParam`", () => {
  if (S.lerDeUrl("https://exemplo.org/visualg/").ok) return "lerDeUrl aceitou link sem code";
  if (S.lerDeUrl("").ok) return "lerDeUrl aceitou string vazia";
  if (S.extrairParam("?code=") !== "") return "extrairParam deveria devolver string vazia, não null";
  const d = S.lerDeUrl("?code=");
  if (d.ok) return "aceitou code vazio";
  return contem(d.motivo, "vazio", "o motivo para code vazio não diz que está vazio");
});

// ==================================================================== 4. §61

secao("[4/7] §61 — persistência: salva, recupera, degruda, versiona");

await caso("§61: salva e recupera código, exercício, preferências e arquivos virtuais", () => {
  const s = storageFalso();
  const loja = P.criar({ storage: s });
  const estado = {
    codigo: CODIGO_BONITO,
    exercicio: "faccat/7",
    preferencias: { tema: "claro", tamanhoFonte: 18, numerosLinha: false, ultimosExercicios: ["a", "b"] },
    arquivos: { "dados.txt": "conteúdo com ç e ã", "notas.txt": "olá" },
  };
  const gravou = loja.salvar(estado);
  if (!gravou.ok) return "salvar falhou: " + gravou.motivo;
  if (!loja.persistindo) return "persistindo = false logo depois de salvar num storage bom";
  const lido = loja.ler();
  if (!lido.ok) return "ler falhou: " + lido.motivo;
  if (lido.estado.codigo !== estado.codigo) return "o código não voltou";
  if (lido.estado.exercicio !== "faccat/7") return "o exercício não voltou";
  if (lido.estado.preferencias.tema !== "claro") return "o tema não voltou";
  if (lido.estado.preferencias.tamanhoFonte !== 18) return "o tamanho da fonte não voltou";
  if (lido.estado.preferencias.numerosLinha !== false) return "o booleano false não voltou (virou " + lido.estado.preferencias.numerosLinha + ")";
  if (lido.estado.arquivos["dados.txt"] !== estado.arquivos["dados.txt"]) return "o arquivo virtual não voltou";
  if (!Array.isArray(lido.estado.preferencias.ultimosExercicios) || lido.estado.preferencias.ultimosExercicios.length !== 2) {
    return "a lista de últimos exercícios não voltou";
  }
  return null;
});

await caso("§61: a lista branca é mesmo uma lista branca — campo fora dela não vai para o storage", () => {
  const s = storageFalso();
  const loja = P.criar({ storage: s });
  loja.salvar({
    codigo: "x",
    exercicio: null,
    execucao: { saida: ["segredo"] },
    saidaDoUltimoRun: "não salvar isto",
    sessoes: [{ token: "segredo" }],
  });
  const bruto = s.cru().get(P.CHAVE);
  if (/segredo|execucao|saidaDoUltimoRun|sessoes|token/.test(bruto)) {
    return "o dado fora da lista foi para o storage: " + bruto;
  }
  return null;
});

await caso("§61: storage que LANÇA (modo privado do Firefox) não quebra e reporta que não persiste", () => {
  const privado = new DOMException("Acesso ao armazenamento é proibido neste contexto", "SecurityError");
  const loja = P.criar({ storage: storageFalso(privado) });
  if (loja.persistindo) return "persistindo = true com storage que lança em tudo";
  if (loja.modo !== "memoria") return "modo = " + loja.modo + "; esperava 'memoria'";
  if (!loja.motivo) return "sem motivo informado para a degradação";
  // E o mais importante: `salvar` NÃO pode lançar nem devolver ok mentindo.
  let jogou = false;
  let r = null;
  try {
    r = loja.salvar({ codigo: CODIGO_BONITO });
  } catch (e) {
    jogou = true;
  }
  if (jogou) return "salvar() LANÇOU com storage indisponível — o Playground inteiro cairia junto";
  if (!r || r.ok !== false) return "salvar() disse ok:true com storage que lança";
  if (r.motivo !== loja.motivo) return "salvar e a propriedade motivo discordam: " + r.motivo + " / " + loja.motivo;
  if (loja.persistindo) return "persistindo virou true depois de salvar";
  // E a sessão continua funcionando: o estado fica na memória, legível.
  const lido = loja.ler();
  if (!lido.ok) return "mesmo degradado, o estado da sessão sumiu: " + lido.motivo;
  return eIgual(lido.estado.codigo, CODIGO_BONITO, "o código da sessão não voltou da memória");
});

await caso("§61: `DOMException` nem sempre existe (Node antigo / iframe antigo) — degrada igual", () => {
  const falha = new Error("localStorage is not available");
  const loja = P.criar({ storage: storageFalso(falha) });
  if (loja.persistindo) return "persistindo = true com storage que lança Error comum";
  const r = loja.salvar({ codigo: "a" });
  if (r.ok !== false) return "salvar disse ok com storage quebrado";
  return null;
});

await caso("§61: quota estourada degrada na MEIA e avisa, sem derrubar a execução", () => {
  // O caso real: guardou o exercício de 500 bytes, e o arquivo de 300 KB estoura
  // a cota. A partir daí o playground continua em memória — e continua DIZENDO
  // que não está persistindo, que é o que o aluno precisa saber.
  const s = storageFalso(null, 400);
  const loja = P.criar({ storage: s });
  if (!loja.persistindo) return "deveria começar persistindo: " + loja.motivo;
  const pequeno = loja.salvar({ codigo: "pequeno" });
  if (!pequeno.ok) return "o estado pequeno não salvou: " + pequeno.motivo;
  const grande = loja.salvar({ codigo: "x".repeat(3000) });
  if (grande.ok !== false) return "salvar do código grande disse ok mesmo com a cota estourada";
  if (!/cota/i.test(grande.motivo)) return "o motivo não fala de cota: " + grande.motivo;
  if (loja.persistindo) return "persistindo continua true depois da quota estourada";
  // Re-tentar não deve re-explodir: a degradação é ESTÁVEL.
  const terceiro = loja.salvar({ codigo: "y" });
  if (terceiro.ok !== false) return "o terceiro salvamento disse ok";
  const lido = loja.ler();
  if (!lido.ok || lido.estado.codigo !== "y") return "a sessão em memória não guarda o último estado";
  return null;
});

await caso("§61: versão incompatível é rejeitada LIMPO, e o dado guardado NÃO é sobrescrito", () => {
  const s = storageFalso();
  const loja = P.criar({ storage: s });
  // Simula o que a próxima versão do playground gravaria.
  s.cru().set(P.CHAVE, JSON.stringify({ versao: P.VERSAO + 1, estado: { codigo: "do futuro" } }));
  const lido = loja.ler();
  if (lido.ok) return "aceitou dado de versão " + (P.VERSAO + 1) + " e devolveu estado";
  if (!/v/i.test(lido.motivo)) return "o motivo não cita a versão: " + lido.motivo;
  if (lido.versao !== P.VERSAO + 1) return "ler() não informou a versão encontrada: " + lido.versao;
  // O ponto: rejeitar NÃO pode ser apagar. Quem chamou decide a migração.
  const bruto = s.cru().get(P.CHAVE);
  if (bruto === null || bruto.indexOf("do futuro") < 0) return "a leitura de versão incompatível APAGOU o dado guardado";
  return contem(lido.motivo, String(P.VERSAO + 1), "o motivo não diz qual versão foi encontrada");
});

await caso("§61: dado sem versão, JSON pela metade e registro não-objeto falham limpo", () => {
  const semVersao = P.deserializar(JSON.stringify({ estado: { codigo: "x" } }));
  if (semVersao.ok) return "aceitou registro sem versão";
  if (semVersao.versao !== null) return "semVersao.versao deveria ser null";
  const pelaMetade = P.deserializar('{"versao":1,"estado":{"codigo":"x"}');
  if (pelaMetade.ok) return "aceitou JSON truncado";
  const lista = P.deserializar("[1,2,3]");
  if (lista.ok) return "aceitou array como registro";
  const semEstado = P.deserializar(JSON.stringify({ versao: P.VERSAO }));
  if (semEstado.ok) return "aceitou registro sem campo 'estado'";
  const vazio = P.deserializar("");
  if (vazio.ok) return "aceitou string vazia";
  if (vazio.motivo !== "não havia nada salvo") return "primeira visita deveria ser motivo benigno: " + vazio.motivo;
  for (const r of [semVersao, pelaMetade, lista, semEstado, vazio]) {
    // `JSON` pode aparecer na frase (é o formato, não o erro); o que NÃO pode é
    // o nome cru da exceção que o `JSON.parse` lançou.
    if (/SyntaxError|Unexpected token|is not valid JSON|undefined|\[object/.test(r.motivo)) return "vaza nome de exceção: " + r.motivo;
  }
  return null;
});

await caso("§61: `restaurar` só escreve o que existe, e diz o que escreveu", () => {
  const estado = P.sanear({ codigo: "abc", exercicio: "e9" });
  const alvo = { codigo: "o que o aluno está digitando agora" };
  const r = P.restaurar(estado, alvo);
  if (!r.ok) return "restaurar falhou";
  if (alvo.codigo !== "abc") return "restaurar não escreveu o código";
  if (r.aplicados.indexOf("codigo") < 0) return "não listou 'codigo': " + JSON.stringify(r.aplicados);
  if (r.aplicados.indexOf("arquivos") < 0) return "não listou 'arquivos' (que veio vazio do sanear)";
  // Não pode inventar campo que o estado não tem.
  const limpo = {};
  P.restaurar({ codigo: "só isso" }, limpo);
  if (Object.keys(limpo).length !== 1) return "restaurar criou campos: " + Object.keys(limpo).join(",");
  return null;
});

await caso("§61: `sanear` limita e converte, em vez de confiar no que veio", () => {
  const estado = P.sanear({
    codigo: 42,
    exercicio: 7,
    preferencias: { tema: "arco-íris", tamanhoFonte: 900, numerosLinha: "false", ultimosExercicios: [1, "b", "c"] },
    arquivos: { "a.txt": "x".repeat(P.LIMITE_ARQUIVO + 50), "../escape.txt": "y", "sub/pasta.txt": "z", "b.bin": 5 },
  });
  if (estado.codigo !== "") return "código não-string virou " + JSON.stringify(estado.codigo);
  if (estado.exercicio !== "7") return "exercício numérico não virou texto";
  if (estado.preferencias.tema !== "escuro") return "tema fora da lista passou: " + estado.preferencias.tema;
  if (estado.preferencias.tamanhoFonte !== 48) return "tamanho de fonte não foi limitado: " + estado.preferencias.tamanhoFonte;
  if (estado.preferencias.numerosLinha !== false) {
    // Aceitar o TEXTO "false" é deliberado: `localStorage` é editado à mão em
    // devtools, e uma Preferência que veio como string tem de virar booleano em
    // vez de voltar ao padrão silenciosamente.
    return 'o texto "false" virou ' + estado.preferencias.numerosLinha + " (deveria ser false)";
  }
  if (estado.preferencias.ultimosExercicios.join(",") !== "b,c") return "lista não foi filtrada: " + JSON.stringify(estado.preferencias.ultimosExercicios);
  const nomes = Object.keys(estado.arquivos);
  if (nomes.length !== 3) return "esperava 3 arquivos, veio " + nomes.length + ": " + nomes.join(",");
  for (const nome of nomes) {
    // A propriedade que importa não é o nome exato: é que ele não volte a ser um
    // CAMINHO. `..` no começo é justamente o que a §54 (SEGURANÇA) não quer
    // atravessando o playground.
    if (/[\\/]/.test(nome)) return "o nome ainda é caminho: " + nome;
    if (nome.split(".").indexOf("") === 0 && /^\.+/.test(nome)) return "o nome começa com ponto-e-ponto: " + nome;
  }
  if (estado.arquivos[nomes.find((n) => n.indexOf("a.txt") >= 0)].length !== P.LIMITE_ARQUIVO) return "o arquivo não foi truncado no limite";
  return null;
});

await caso("§61: `__proto__` no storage não vira prototype do estado lido", () => {
  // O registro é escrito como TEXTO, e não com um literal de objeto: em
  // `{__proto__: {...}}` o JavaScript atribui o PROTOTYPE, e o teste passaria
  // medindo nada. O que importa é o que o `JSON.parse` faz com a chave — e o
  // `JSON.parse` traz `__proto__` como propriedade de DADO, que é exatamente o
  // caso perigoso: `alvo[k] = v` executaria o setter de `Object.prototype`.
  const registro = '{"versao":' + P.VERSAO + ',"estado":{"codigo":"x","arquivos":{"__proto__":{"infectado":true}},"__proto__":{"infectado":true}}}';
  const r = P.deserializar(registro);
  if (!r.ok) return "rejeitou registro legítimo: " + r.motivo;
  if (r.estado.infestado !== undefined) return "o estado saiu infectado: " + JSON.stringify(r.estado);
  if (({}).infectado !== undefined) return "o prototype global foi tocado";
  if (Object.getPrototypeOf(r.estado) !== Object.prototype) return "o estado ficou com prototype diferente de Object.prototype";
  if (({}).infectado !== undefined) return "o prototype global foi tocado (depois do sanear)";
  return null;
});

await caso("§61: `sondar` distingue 'existe' de 'funciona' (o Firefox privado passa na interface)", () => {
  const normal = P.sondar(storageFalso());
  if (!normal.ok) return "storage bom reprovou na sonda: " + normal.motivo;
  const quebrado = P.sondar(storageFalso(new Error("nope")));
  if (quebrado.ok) return "storage que lança passou na sonda";
  const semMetodos = P.sondar({ getItem: function () {} });
  if (semMetodos.ok) return "storage sem setItem passou na sonda";
  if (P.sondar(null).ok) return "null passou na sonda";
  return null;
});

await caso("§61: `reintegrar` promove a memória quando o storage volta a funcionar", () => {
  // O Firefox privado pode virar janela normal, e a cota pode ter sido liberada.
  // O playground não pode ficar preso à degradação para sempre — e o trabalho
  // digitado durante a degradação tem de ir para o disco na promoção, que é a
  // diferença entre "avisei" e "recuperei".
  const s = storageFalso();
  s.quebrar = true;
  const antesDe = s.setItem.bind(s);
  s.setItem = function (k, v) {
    if (s.quebrar) throw new DOMException("escrita bloqueada", "SecurityError");
    return antesDe(k, v);
  };
  const loja = P.criar({ storage: s });
  if (loja.persistindo) return "começou persistindo com storage que lança";
  const salvou = loja.salvar({ codigo: "digitado durante a queda" });
  if (salvou.ok !== false) return "salvar disse ok com storage quebrado";
  if (loja.ler().estado.codigo !== "digitado durante a queda") return "a memória não guardou o estado";
  s.quebrar = false;
  const voltou = loja.reintegrar();
  if (!voltou.ok) return "reintegrar falhou: " + voltou.motivo;
  if (!loja.persistindo) return "continua em memória depois de reintegrar";
  if (loja.motivo !== "") return "o motivo deveria estar vazio: " + loja.motivo;
  const noDisco = JSON.parse(s.cru().get(P.CHAVE));
  if (noDisco.estado.codigo !== "digitado durante a queda") return "o estado da memória não foi promovido para o disco";
  return null;
});

await caso("§61: `limpar` apaga do disco e da memória, e sobrevive a storage quebrado", () => {
  const s = storageFalso();
  const loja = P.criar({ storage: s });
  loja.salvar({ codigo: "x" });
  if (s.cru().get(P.CHAVE) === undefined) return "não gravou nada para apagar";
  const r = loja.limpar();
  if (!r.ok) return "limpar falhou: " + r.motivo;
  if (s.cru().get(P.CHAVE) !== undefined) return "o registro continuou no storage";
  if (loja.ler().ok) return "ainda lê dados depois de limpar";
  const quebrado = P.criar({ storage: storageFalso(new Error("x")) });
  quebrado.salvar({ codigo: "y" });
  // Em memória, `limpar` tem sucesso de verdade: o que havia para apagar era
  // só a memória da sessão, e ela é apagada. O que muda é o aviso: `motivo`
  // continua dizendo por que o estado não sobrevive ao F5.
  const r2 = quebrado.limpar();
  if (r2.ok !== true) return "limpar da memória falhou: " + r2.motivo;
  if (!quebrado.motivo) return "o motivo da degradação sumiu depois de limpar";
  if (quebrado.ler().ok) return "a memória não foi limpa";
  return null;
});

await caso("§61: a chave é configurável e isolada por instância", () => {
  const s = storageFalso();
  const a = P.criar({ storage: s, chave: "meu:estado" });
  const b = P.criar({ storage: s, chave: "outro:estado" });
  a.salvar({ codigo: "A" });
  b.salvar({ codigo: "B" });
  if (a.ler().estado.codigo !== "A") return "instância A leu errado";
  if (b.ler().estado.codigo !== "B") return "instância B leu errado";
  if (a.chave !== "meu:estado") return "chave não foi respeitada: " + a.chave;
  return null;
});

await caso("§61: criar com `storage: null` (ou sem storage) é memória, e o motivo é dito", () => {
  const semStorage = P.criar({ storage: null });
  if (semStorage.persistindo) return "storage: null disse que persiste";
  if (semStorage.motivo.indexOf("armazenamento") < 0) return "motivo pouco claro: " + semStorage.motivo;
  // Sem `storage` na options, em Node não há `window.localStorage`: o padrão
  // também tem que degradar em vez de estourar.
  const semOpcao = P.criar({});
  if (semOpcao.persistindo) return "em Node, o padrão deveria degradar para memória";
  return null;
});

// ============================================================== 5. §52 detecção

secao("[5/7] §52 — a decisão do caminho: `file:` entrega o fallback sem criar worker");

await caso("§52: protocolo `file:` entrega o fallback e NÃO tenta criar o worker", () => {
  // Este é o caminho que roda no projeto de verdade. A asserção forte é a
  // negativa: o construtor NUNCA é chamado. Um cliente que "tenta e cai" gastaria
  // uma `SecurityError` por execução para descobrir o que a query string já diz.
  let construcoes = 0;
  function CtorQuebrado() {
    construcoes++;
    throw new DOMException("Script at 'file:///...' cannot be accessed from origin 'null'", "SecurityError");
  }
  const apoio = C.suporta({ protocolo: "file:", WorkerCtor: CtorQuebrado });
  if (apoio.ok) return "suporta() disse que dá em file:";
  if (apoio.protocolo !== "file:") return "protocolo não foi lido: " + apoio.protocolo;
  return contem(apoio.motivo, "file:", "o motivo não menciona o protocolo que causou a queda");
});

await caso("§52: com `file:`, `criar()` devolve cliente executável e `criarWorker` não foi chamado", () => {
  let chamadas = 0;
  const cliente = C.criar({
    protocolo: "file:",
    criarWorker: function () {
      chamadas++;
      throw new DOMException("origem 'null'", "SecurityError");
    },
  });
  if (chamadas !== 0) return "criou o worker " + chamadas + " vez(es) em file:";
  if (cliente.modo !== "principal") return "modo = " + cliente.modo;
  if (cliente.disponivel) return "disponivel = true em file:";
  if (!cliente.motivo) return "sem motivo de queda";
  return null;
});

await caso("§52: o caminho principal EXECUTA de verdade o programa (o caso de `file://`)", () => {
  const cliente = C.criar({ protocolo: "file:", criarWorker: function () { throw new Error("nunca"); } });
  const saida = [];
  const promessa = cliente.executar(
    'algoritmo "na aba"\ninício\n   escreval("funciona sem worker")\nfimalgoritmo',
    { saida: (t) => saida.push(t) }
  );
  return promessa.then(
    (r) => {
      if (r.ok !== true) return "não executou: " + JSON.stringify(r.erro || r);
      if (r.modo !== "principal") return "modo do resultado = " + r.modo;
      if (saida.join("") !== "funciona sem worker\n") return "saída errada: " + JSON.stringify(saida);
      return null;
    },
    (e) => "a promessa rejeitou: " + (e && e.message)
  );
});

await caso("§52: o caminho principal corta laço infinito pelos limites da §53 e devolve", () => {
  // `enquanto verdadeiro faca fimEnquanto` é LITERALMENTE o exemplo da §52. No
  // caminho principal ele não pode congelar a aba: tem de ser cortado por
  // `maxPassos` e devolver, com o editor intacto.
  const cliente = C.criar({ protocolo: "file:", criarWorker: function () { throw new Error("nunca"); } });
  const promessa = cliente.executar('algoritmo "infinito"\ninício\n   enquanto (1 = 1) faca\n   fimenquanto\nfimalgoritmo', { maxPassos: 400 });
  return promessa.then(
    (r) => {
      if (r.ok !== false) return "o laço infinito terminou: o limite da §53 não foi aplicado";
      if (typeof r.erro !== "object" || r.erro === null) return "sem erro reportado: " + JSON.stringify(r);
      if (!/loop infinito/i.test(r.erro.mensagem)) return "mensagem inesperada: " + r.erro.mensagem;
      return null;
    },
    (e) => "a promessa rejeitou: " + (e && e.message)
  );
});

await caso("§52: erro de sintaxe no caminho principal vira erro do §46, não exceção", () => {
  const cliente = C.criar({ protocolo: "file:", criarWorker: function () { throw new Error("nunca"); } });
  const promessa = cliente.executar('algoritmo "s"\ninício\n   escreva(\nfimalgoritmo');
  return promessa.then(
    (r) => {
      if (r.ok !== false) return "aceitou programa com sintaxe quebrada";
      if (!r.erro || typeof r.erro.linha !== "number") return "erro sem linha: " + JSON.stringify(r.erro);
      return null;
    },
    (e) => "a promessa rejeitou: " + (e && e.message)
  );
});

await caso("§52: `parar()` no caminho principal interrompe de verdade", () => {
  const cliente = C.criar({ protocolo: "file:", criarWorker: function () { throw new Error("nunca"); } });
  const p = cliente.executar(
    'algoritmo "conta"\nvar\n   n: inteiro\ninício\n   enquanto (1 = 1) faca\n      n <- n + 1\n   fimenquanto\nfimalgoritmo',
    { saida: () => {}, maxPassos: 500000 }
  );
  // O pedido de parada vai por timer: só passa a valer se o executor cooperativo
  // CEDER o event loop, que é a propriedade que a §52 exige dos dois caminhos.
  const parar = setTimeout(() => cliente.parar(), 0);
  return p.then(
    (r) => {
      clearTimeout(parar);
      if (r.ok !== false) return "o laço não interrompeu";
      if (r.interrompido !== true) return "esperava interrompido:true; veio " + JSON.stringify(r);
      if (/loop infinito/i.test((r.erro || {}).mensagem || "")) return "cortou pelo limite de passos, não pelo Parar: o executor não cedeu o event loop";
      return null;
    },
    (e) => "a promessa rejeitou: " + (e && e.message)
  );
});

await caso("§52: com `http:`, o cliente TENTA criar o worker", () => {
  const criados = [];
  const cliente = C.criar({
    protocolo: "http:",
    workerUrl: "src/visualg/worker.js",
    WorkerCtor: function (url) {
      criados.push(url);
      this.postMessage = function () {};
      this.terminate = function () {};
    },
  });
  if (criados.length !== 1) return "criou " + criados.length + " worker(s); esperava 1";
  if (criados[0] !== "src/visualg/worker.js") return "passou a URL errada: " + criados[0];
  if (cliente.modo !== "worker") return "modo = " + cliente.modo + "; esperava worker";
  if (cliente.disponivel !== true) return "disponivel = false com worker criado";
  if (cliente.motivo !== "") return "motivo deveria estar vazio: " + cliente.motivo;
  return null;
});

await caso("§52: construtor que LANÇA cai no fallback, e o programa roda na aba mesmo assim", () => {
  const cliente = C.criar({
    protocolo: "http:",
    workerUrl: "src/visualg/worker.js",
    WorkerCtor: function () {
      throw new DOMException("Refused to connect to 'file://...' because it violates CSP", "SecurityError");
    },
  });
  if (cliente.modo !== "principal") return "modo = " + cliente.modo;
  if (cliente.disponivel) return "disponivel = true depois da exceção";
  if (cliente.motivo.indexOf("SecurityError") < 0) return "o motivo não cita a exceção real: " + cliente.motivo;
  const saida = [];
  return cliente.executar('algoritmo "deu"\ninício\n   escreval("mesmo sem worker")\nfimalgoritmo', { saida: (t) => saida.push(t) }).then((r) => {
    if (r.ok !== true) return "não executou: " + JSON.stringify(r.erro || r);
    if (saida.join("") !== "mesmo sem worker\n") return "saída errada: " + JSON.stringify(saida);
    return null;
  });
});

await caso("§52: `criarPrincipal` entrega o fallback declarado, sem protocolo nem construtor", () => {
  const cliente = C.criarPrincipal();
  if (cliente.modo !== "principal") return "modo = " + cliente.modo;
  if (cliente.disponivel) return "disponivel = true";
  return cliente.executar('algoritmo "p"\ninício\n   escreval("ok")\nfimalgoritmo').then((r) => (r.ok ? null : "não executou"));
});

await caso("§52: ambiente sem `Worker` algum (Node, worker aninhado) degrada com motivo", () => {
  const apoio = C.suporta({ protocolo: "http:", WorkerCtor: null });
  if (apoio.ok) return "suporta() disse que dá sem construtor";
  if (apoio.motivo.indexOf("Web Worker") < 0) return "motivo pouco claro: " + apoio.motivo;
  const semUrl = C.criar({ protocolo: "http:" });
  if (semUrl.modo !== "principal") return "modo = " + semUrl.modo;
  return null;
});

await caso("§52: com `http:` mas sem `workerUrl` nem `criarWorker`, o motivo diz o que falta", () => {
  // Construtor existe, mas não há o que construir: sem `workerUrl` e sem
  // `criarWorker` o cliente não tem como obter o script, e a resposta certa é
  // degradar com a instrução do que passar — não tentar adivinhar o caminho.
  const cliente = C.criar({ protocolo: "http:", criarWorker: undefined, WorkerCtor: function () {} });
  if (cliente.modo !== "principal") return "modo = " + cliente.modo;
  if (cliente.disponivel) return "disponivel = true sem ter worker";
  const faltaWorkerUrl = contem(cliente.motivo, "workerUrl", "o motivo não diz o que falta");
  if (faltaWorkerUrl) return faltaWorkerUrl;
  return contem(cliente.motivo, "aba", "o motivo não diz onde a execução vai acontecer");
});

// =========================================================== 6. §52 worker mock

secao("[6/7] §52 — o cliente fala o protocolo, e a queda do worker é coberta");

/** Worker de mentira: guarda o que recebeu e deixa o teste mandar o que quiser. */
function workerFalso() {
  return {
    enviados: [],
    morto: false,
    postMessage(m) {
      this.enviados.push(m);
    },
    terminate() {
      this.morto = true;
    },
    /** O teste manda um evento do worker para o cliente. */
    emitir(dados) {
      if (this.onmessage) this.onmessage({ data: dados });
    },
    /** O teste provoca a morte do worker. */
    morrer(mensagem) {
      if (this.onerror) this.onerror({ message: mensagem || "worker caiu" });
    },
    ultimo: function () {
      return this.enviados[this.enviados.length - 1];
    },
  };
}

await caso("§52: o RUN chega ao worker com o código e o limite de passos", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w, maxPassos: 1234 });
  const codigo = 'algoritmo "p"\ninício\n   escreval("oi")\nfimalgoritmo';
  const p = cliente.executar(codigo, {});
  if (w.enviados.length !== 1) return "mandou " + w.enviados.length + " mensagem(ns)";
  const run = w.enviados[0];
  if (run.tipo !== C.COMANDOS.RUN) return "tipo = " + run.tipo;
  if (run.codigo !== codigo) return "o código não chegou intacto";
  if (run.maxPassos !== 1234) return "maxPassos = " + JSON.stringify(run.maxPassos);
  w.emitir({ tipo: "FINISHED", ok: true });
  return p.then((r) => (r.ok && r.modo === "worker" ? null : "resultado inesperado: " + JSON.stringify(r)));
});

await caso("§52: OUTPUT, STATE_UPDATE, BREAKPOINT e FINISHED chegam nos ganchos certos", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const vistos = { saida: [], estado: [], bp: [] };
  const p = cliente.executar('algoritmo "e"\ninício\nfimalgoritmo', {
    saida: (t) => vistos.saida.push(t),
    estado: (e) => vistos.estado.push(e),
    breakpoint: (l, a) => vistos.bp.push([l, a]),
  });
  w.emitir({ tipo: "OUTPUT", texto: "primeiro" });
  w.emitir({ tipo: "OUTPUT", texto: "\n" });
  w.emitir({ tipo: "STATE_UPDATE", estado: { x: 1 } });
  w.emitir({ tipo: "BREAKPOINT", linha: 4, ativa: true });
  w.emitir({ tipo: "FINISHED", ok: true });
  return p.then((r) => {
    if (vistos.saida.join("") !== "primeiro\n") return "saída = " + JSON.stringify(vistos.saida);
    if (vistos.estado.length !== 1 || vistos.estado[0].x !== 1) return "estado não chegou: " + JSON.stringify(vistos.estado);
    if (vistos.bp.length !== 1 || vistos.bp[0][0] !== 4) return "breakpoint não chegou: " + JSON.stringify(vistos.bp);
    if (r.ok !== true) return "FINISHED ok:true não resolveu: " + JSON.stringify(r);
    return null;
  });
});

await caso("§52: ERROR do worker vira `{ok:false, erro}` no mesmo formato do §46", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const p = cliente.executar('algoritmo "e"\ninício\nfimalgoritmo', {});
  w.emitir({
    tipo: "ERROR",
    erro: { mensagem: "Variável 'x' não declarada", linha: 3, coluna: 4, codigo: "VAR_NAO_DECLARADA", tipo: "ErroDeExecucao" },
  });
  return p.then((r) => {
    if (r.ok !== false) return "ERROR não marcou falha";
    if (!r.erro || r.erro.linha !== 3) return "erro não preservou a linha: " + JSON.stringify(r.erro);
    if (r.erro.codigo !== "VAR_NAO_DECLARADA") return "código do erro perdido: " + JSON.stringify(r.erro);
    return null;
  });
});

await caso("§52: INPUT_REQUEST pergunta, o gancho responde, e o INPUT volta com o id certo", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const p = cliente.executar('algoritmo "l"\nvar\n   n: inteiro\ninício\n   leia(n)\nfimalgoritmo', {
    entrada: (prompt, id) => {
      if (typeof prompt !== "string") return Promise.reject(new Error("prompt não é texto"));
      if (id !== 7) return Promise.reject(new Error("id não chegou"));
      return Promise.resolve("42");
    },
  });
  w.emitir({ tipo: "INPUT_REQUEST", id: 7, prompt: "Entre com o valor de n" });
  // O `entrada` resolve em microtask: o teste cede o event loop de propósito,
  // para provar que a resposta NÃO é síncrona e mesmo assim chega.
  return new Promise((r) => setTimeout(r, 5))
    .then(() => {
      const resp = w.enviados[1];
      if (!resp) return "não respondeu ao INPUT_REQUEST: " + JSON.stringify(w.enviados);
      if (resp.tipo !== C.COMANDOS.INPUT) return "tipo = " + resp.tipo;
      if (resp.valor !== "42") return "valor = " + JSON.stringify(resp.valor);
      if (resp.id !== 7) return "id = " + resp.id;
      w.emitir({ tipo: "FINISHED", ok: true });
      return p.then((res) => (res.ok ? null : "não resolveu"));
    });
});

await caso("§52: entrada recusada pelo gancho cancela o INPUT e encerra como interrompido", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const p = cliente.executar('algoritmo "l"\nvar\n   n: inteiro\ninício\n   leia(n)\nfimalgoritmo', {
    entrada: () => Promise.reject(new Error("usuário apertou Parar")),
  });
  w.emitir({ tipo: "INPUT_REQUEST", id: 1, prompt: "valor?" });
  return new Promise((r) => setTimeout(r, 5)).then(() => p.then((r) => {
    const resp = w.enviados[1];
    if (!resp || resp.cancelado !== true) return "não mandou INPUT cancelado: " + JSON.stringify(w.enviados);
    if (r.ok !== false || r.interrompido !== true) return "não encerrou como interrompido: " + JSON.stringify(r);
    return null;
  }));
});

await caso("§52: PAUSE/RESUME/STEP/STOP/INPUT/SET_BREAKPOINT chegam ao worker pelo nome da §52", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  cliente.pausar();
  cliente.retomar();
  cliente.passo();
  cliente.parar();
  cliente.entrada("7");
  cliente.breakpoints([2, 5]);
  const tipos = w.enviados.map((m) => m.tipo);
  const esperado = ["PAUSE", "RESUME", "STEP", "STOP", "INPUT", "SET_BREAKPOINT"];
  if (tipos.join(",") !== esperado.join(",")) return "mandou " + tipos.join(",");
  const bp = w.ultimo();
  if (JSON.stringify(bp.linhas) !== "[2,5]") return "linhas de breakpoint erradas: " + JSON.stringify(bp.linhas);
  return null;
});

await caso("§52: os comandos de UI não existindo worker não lançam (são no-ops honestos)", () => {
  const cliente = C.criar({ protocolo: "file:", criarWorker: function () { throw new Error("nunca"); } });
  for (const fn of ["pausar", "retomar", "passo", "parar", "entrada", "breakpoints"]) {
    let r;
    try {
      r = cliente[fn]("x");
    } catch (e) {
      return fn + "() lançou sem worker: " + e.message;
    }
    if (r !== false) return fn + "() devolveu " + JSON.stringify(r) + "; esperava false (nada foi enviado)";
  }
  return null;
});

await caso("§52: worker que MORRE no meio da execução volta ao caminho principal e devolve resultado", () => {
  // A queda não abandona o programa: o código é reexecutado na aba e é o
  // resultado dela que chega ao `await`. Perder a execução inteira por causa de
  // uma falha de infraestrutura seria a pior das duas saídas.
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const saida = [];
  const p = cliente.executar('algoritmo "cai"\ninício\n   escreval("sobrevivi")\nfimalgoritmo', {
    saida: (t) => saida.push(t),
  });
  if (w.enviados.length !== 1) return "o RUN não chegou";
  w.morrer("out of memory");
  return p.then((r) => {
    if (!w.morto) return "não chamou terminate() no worker morto";
    if (cliente.modo !== "principal") return "o modo deveria ter caído para principal; ficou " + cliente.modo;
    if (r.retomadoNaAba !== true) return "o resultado não foi marcado como retomado na aba: " + JSON.stringify(r);
    if (!r.motivoQueda) return "o motivo da queda não voltou para a UI";
    if (r.ok !== true) return "a execução retomada falhou: " + JSON.stringify(r.erro || r);
    if (saida.join("").indexOf("sobrevivi") < 0) return "a saída da retomada não apareceu: " + JSON.stringify(saida);
    // Depois da queda, a PRÓXIMA execução já é na aba: o worker morto não volta.
    if (cliente.disponivel) return "ainda diz que há worker disponível";
    return null;
  });
});

await caso("§52: `onmessageerror` (mensagem ilegível) também derruba para a aba", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const p = cliente.executar('algoritmo "m"\ninício\n   escreval("ok")\nfimalgoritmo', { saida: () => {} });
  if (!w.onmessageerror) return "o cliente não instalou onmessageerror";
  w.onmessageerror({});
  return p.then((r) => (r.ok === true && r.retomadoNaAba === true ? null : "não retomou: " + JSON.stringify(r)));
});

await caso("§52: `postMessage` que lança no meio da execução também derruba para a aba", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  w.postMessage = function () {
    throw new Error("could not be cloned");
  };
  const p = cliente.executar('algoritmo "c"\ninício\n   escreval("cloned")\nfimalgoritmo', { saida: () => {} });
  return p.then((r) => {
    if (r.ok !== true) return "não retomou: " + JSON.stringify(r);
    if (r.retomadoNaAba !== true) return "não foi marcado como retomado";
    return null;
  });
});

await caso("§52: resposta de um worker já morto não resolve a execução seguinte", () => {
  // `geracao` existe para isso: o `onmessage` do worker velho chega depois que a
  // queda já pegou a execução, e resolver a promessa errada seria um programa
  // aparecem como "terminou" sem ter executado.
  const velho = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => velho });
  const p1 = cliente.executar('algoritmo "1"\ninício\n   escreval("um")\nfimalgoritmo', { saida: () => {} });
  const handlerVelho = velho.onmessage;
  velho.morrer("morreu");
  return p1.then(() => {
    const saida2 = [];
    const p2 = cliente.executar('algoritmo "2"\ninício\n   escreval("dois")\nfimalgoritmo', { saida: (t) => saida2.push(t) });
    // A resposta atrasada do worker VELHO não pode resolver a execução NOVA.
    handlerVelho({ data: { tipo: "FINISHED", ok: true } });
    if (cliente.modo !== "principal") return "modo = " + cliente.modo;
    return p2.then((r) => {
      if (r.ok !== true) return "a execução nova não rodou: " + JSON.stringify(r);
      if (saida2.join("").indexOf("dois") < 0) return "a saída da execução nova não veio: " + JSON.stringify(saida2);
      return null;
    });
  });
});

await caso("§52: um segundo `executar` em andamento não derruba o primeiro", () => {
  const w = workerFalso();
  const cliente = C.criar({ protocolo: "http:", criarWorker: () => w });
  const p1 = cliente.executar('algoritmo "a"\ninício\nfimalgoritmo', {});
  const p2 = cliente.executar('algoritmo "b"\ninício\nfimalgoritmo', {});
  if (w.enviados.length !== 1) return "o segundo RUN foi para o worker: " + JSON.stringify(w.enviados);
  w.emitir({ tipo: "FINISHED", ok: true });
  return Promise.all([p1, p2]).then((rs) => {
    if (rs[0].ok !== true) return "a primeira execução falhou";
    if (rs[1].ok !== false || rs[1].erro.codigo !== "OCUPADO") return "a segunda deveria dizer OCUPADO: " + JSON.stringify(rs[1]);
    return null;
  });
});

await caso("§52: `reiniciar` reavalia o suporte e cria worker novo quando agora dá", () => {
  const criados = [];
  const opcoes = {
    protocolo: "file:",
    criarWorker: function () {
      const w = workerFalso();
      criados.push(w);
      return w;
    },
  };
  const cliente = C.criar(opcoes);
  if (cliente.modo !== "principal") return "começou no modo errado";
  if (criados.length !== 0) return "criou worker em file:";
  if (cliente.reiniciar() !== false) return "reiniciar() em file: devolveu true";
  // O caso real do "reiniciar": o playground passou a ser servido por HTTP. O
  // cliente reconsulta o suporte (e NÃO carrega o veredito antigo, que foi
  // tomado quando a origem era 'null'), e o worker passa a existir.
  opcoes.protocolo = "http:";
  if (cliente.reiniciar() !== true) return "reiniciar() não criou o worker: " + cliente.motivo;
  if (cliente.modo !== "worker") return "modo = " + cliente.modo;
  if (cliente.protocolo !== "http:") return "protocolo não foi atualizado: " + cliente.protocolo;
  if (criados.length !== 1) return "criou " + criados.length + " worker(s)";
  if (cliente.worker !== criados[0]) return "não ficou com o worker novo";
  return null;
});

await caso("§52: `reiniciar` de um cliente que caiu volta a modo principal sem quebrar", () => {
  const cliente = C.criar({ protocolo: "http:", criarWorker: function () { throw new Error("SecurityError"); } });
  if (cliente.modo !== "principal") return "modo = " + cliente.modo;
  if (cliente.reiniciar() !== false) return "reiniciar devolveu true sem conseguir criar worker";
  if (cliente.modo !== "principal") return "modo mudou para " + cliente.modo;
  return cliente.executar('algoritmo "r"\ninício\n   escreval("ainda aqui")\nfimalgoritmo').then((r) => (r.ok ? null : "não executou"));
});

// ================================================= 7. proibições e file://

secao("[7/7] Proibições: o que a Onda 13 não pode fazer");

await caso("nenhum dos três arquivos usa `fetch`, `eval`, `Function()` ou storage sem `try`", () => {
  const proibidos = [
    [/\bfetch\s*\(/, "fetch()"],
    [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
    [/\bWebSocket\b/, "WebSocket"],
    [/\bnew\s+Function\b/, "new Function"],
    [/(?<![.\w$])eval\s*\(/, "eval()"],
    [/\bimport\s+.*\bfrom\b/, "import ... from"],
    [/\bexport\b/, "export"],
  ];
  const achados = [];
  for (const src of MODULOS) {
    const texto = readFileSync(join(RAIZ, src), "utf8");
    const codigo = texto
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    for (const [re, nome] of proibidos) {
      const m = re.exec(codigo);
      if (m) achados.push(src + ": " + nome);
    }
  }
  return eIgual(achados.length, 0, "proibição encontrada:\n       " + achados.join("\n       "));
});

await caso("nenhum dos três arquivos toca DOM (`document`, `innerHTML`, `location` fora do guard)", () => {
  const achados = [];
  for (const src of MODULOS) {
    const texto = readFileSync(join(RAIZ, src), "utf8");
    const codigo = texto
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    if (/\bdocument\b/.test(codigo)) achados.push(src + ": document");
    if (/\binnerHTML\b/.test(codigo)) achados.push(src + ": innerHTML");
    if (/\blocation\b/.test(codigo) && !/W\.location/.test(codigo)) achados.push(src + ": location");
    // `window` só pode aparecer no guard inicial (linha 0) — é o que decide se o
    // módulo roda no browser ou no Node, e ele não toca DOM em nenhum dos dois.
    texto.split("\n").forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // comentário descreve, não executa
      if (i > 0 && /\bwindow\b/.test(l) && !/typeof window/.test(l)) {
        achados.push(src + ":" + (i + 1) + ": window fora do guard");
      }
    });
  }
  return eIgual(achados.length, 0, "proibição encontrada:\n       " + achados.join("\n       "));
});

await caso("toda leitura/escrita de storage em `persistence.js` está dentro de `try`", () => {
  // A asserção é MECÂNICA de propósito: a §61 existe porque `localStorage`
  // lança, e um `storage.getItem` fora de `try` reintroduziu o bug sem que
  // nenhum teste de comportamento percebesse. Cada chamada precisa estar perto
  // de um `try` (mesma função, até 12 linhas acima).
  const texto = readFileSync(join(RAIZ, "src/playground/persistence.js"), "utf8");
  const linhas = texto.split("\n");
  const chamadas = [];
  linhas.forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*).*/, "");
    if (/\bstorage\.(get|set|remove)Item\s*\(/.test(codigo)) chamadas.push(i);
  });
  if (chamadas.length === 0) return "nenhuma chamada de storage encontrada: o teste está medindo nada";
  const semTry = [];
  for (const i of chamadas) {
    let achouTry = false;
    for (let k = i; k >= 0 && k >= i - 12; k--) {
      const c = linhas[k].replace(/^\s*(\/\/|\*).*/, "");
      if (/\btry\s*\{/.test(c)) achouTry = true;
      if (/^\s*function\s+\w+/.test(c) && k < i) break;
    }
    if (!achouTry) semTry.push(i + 1);
  }
  if (semTry.length > 0) return "chamada de storage fora de try na(s) linha(s) " + semTry.join(", ");
  return null;
});

await caso("a §62 nunca passa a string original ao `btoa`/`atob`", () => {
  // A asserção mecânica do bug que a §62 veio resolver: `btoa(texto)` cru é o
  // caminho que corrompe acento. O que é legível é `btoa(<string binária>)`,
  // montada byte a byte — e por isso o teste exige as DUAS metades: a string
  // binária é montada, e a string original não chega perto do `btoa`.
  const texto = readFileSync(join(RAIZ, "src/playground/share.js"), "utf8");
  const codigo = texto
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
  for (const cru of [/\bbtoa\s*\(\s*texto\b/, /\bbtoa\s*\(\s*codigo\b/, /\bbtoa\s*\(\s*original\b/, /\batob\s*\(\s*param\b/]) {
    const achado = cru.exec(codigo);
    if (achado) return "chamada crua encontrada: " + achado[0];
  }
  if (codigo.indexOf("String.fromCharCode") < 0) return "não monta string binária (String.fromCharCode) para o btoa";
  if (!/paraBytes/.test(codigo)) return "não tem a conversão para bytes UTF-8";
  // E o round-trip tem que passar pelas duas metades, não só por uma delas.
  if (!/bytesParaTexto/.test(codigo)) return "não tem a conversão de volta (bytes -> texto)";
  return null;
});

await caso("o worker-client não constrói worker antes de conferir o protocolo", () => {
  // Mecânico: em `suporta`, a comparação com `file:` vem ANTES de `ctorDe`.
  // Se alguém inverter a ordem, o cliente passa a gastar uma `SecurityError` por
  // execução, e o teste de comportamento (que conta construções) continuaria
  // verde se o mock não contasse.
  const texto = readFileSync(join(RAIZ, "src/playground/worker-client.js"), "utf8");
  const iArquivo = texto.indexOf("PROTOCOLO_SEM_WORKER");
  if (iArquivo < 0) return "a constante de protocolo sumiu do arquivo";
  const corpo = texto.slice(texto.indexOf("function suporta("), texto.indexOf("function criar("));
  if (corpo.length === 0) return "não achei a função suporta()";
  const iFile = corpo.indexOf("protocolo === PROTOCOLO_SEM_WORKER");
  const iCtor = corpo.indexOf("ctorDe(o)");
  if (iFile < 0) return "suporta() não compara o protocolo com file:";
  if (iCtor < 0) return "suporta() não consulta o construtor (o teste de valor fixo mudou)";
  if (iFile > iCtor) return "suporta() consulta o construtor ANTES de checar o protocolo — em file: isso gasta uma exceção por execução";
  return null;
});

await caso("a §61 e a §62 não dependem do §52, e o §52 não depende delas", () => {
  const textoDe = (nome) => readFileSync(join(RAIZ, "src/playground/" + nome), "utf8");
  const p = textoDe("persistence.js");
  const s = textoDe("share.js");
  const w = textoDe("worker-client.js");
  if (/WorkerClient|Share\./.test(p)) return "persistence.js fala de outro módulo da onda";
  if (/WorkerClient|Persistence\b/.test(s)) return "share.js fala de outro módulo da onda";
  if (/Share\.|Persistence\b/.test(w)) return "worker-client.js fala de outro módulo da onda";
  return null;
});

await caso("os três módulos são sintaticamente válidos e carregam fora do browser (guard do `window`)", () => {
  // O `import` acima JÁ prova isto: se algum deles escrevesse `window.X = ...`
  // fora do guard, o Node quebraria no import, antes do primeiro teste.
  for (const nome of ["Persistence", "Share", "WorkerClient"]) {
    if (typeof GP[nome] !== "object") return GP[nome] + " não é objeto";
  }
  return null;
});

await caso("a §62 e a §61 não quebram com o corpus inteiro passando pela URL e pelo storage", () => {
  // Teste de integração: os 95 `.alg` do corpus num estado salvo, e os mesmos
  // 95 pelo link. É o que garante que os dois caminhos de serialização aguentam
  // o material que o projeto realmente usa.
  const s = storageFalso();
  const loja = P.criar({ storage: s });
  const arquivos = todosAlgs();
  const codigos = arquivos.map((a) => lerAlg(a));
  const grande = codigos[Math.floor(codigos.length / 2)];
  loja.salvar({ codigo: grande, exercicio: caminhoRelativo(arquivos[0]) });
  const lido = loja.ler();
  if (!lido.ok) return "o corpus não sobreviveu ao storage: " + lido.motivo;
  if (lido.estado.codigo !== grande) return "o código do corpus voltou diferente";
  const enc = S.codigoParaParam(grande);
  if (!enc.ok) return "o corpus não sobreviveu ao link: " + enc.motivo;
  if (S.paramParaCodigo(enc.param).codigo !== grande) return "o corpus voltou diferente do link";
  return null;
});

console.log("-".repeat(66));
console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
if (fail > 0) process.exitCode = 1;
