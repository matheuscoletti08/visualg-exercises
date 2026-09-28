// Fonte única de verdade sobre o corpus de exercícios e a decodificação de texto.
//
// Antes deste arquivo, `PASTAS` estava duplicado em `tools/testar.mjs` e
// `tools/gerar-exercicios.mjs`, e os dois decodificavam de forma diferente
// (`latin1` no teste, `windows-1252` no gerador). Qualquer arquivo de exercício
// com byte na faixa 0x80-0x9F era lido de um jeito pelo gerador e de outro pelo
// teste. Agora os dois consomem daqui.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR_TOOLS = dirname(fileURLToPath(import.meta.url));

/** Raiz do repositório. */
export const RAIZ = resolve(DIR_TOOLS, "..", "..");

/** Pastas de onde os exercícios são lidos. `exemplos/` foi removido de propósito. */
export const PASTAS = ["faccat", "manzano"];

const UFFFD = "�";
const MOJIBAKE = "ï¿½";

/**
 * Decodifica bytes de um `.alg`.
 *
 * Estratégia: tenta UTF-8 estrito; se falhar, cai para windows-1252 (o encoding
 * legado real do VisuAlg, que difere de latin1 apenas na faixa 0x80-0x9F).
 * Caracteres irrecuperáveis viram "?" em vez deirem lixo silencioso.
 */
export function decodificar(bytes) {
  let texto = null;
  let caiuParaLegacy = false;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
    caiuParaLegacy = true;
  }
  texto = texto.split(UFFFD).join("?");
  if (caiuParaLegacy) texto = texto.split(MOJIBAKE).join("?");
  return texto;
}

/** Lê um `.alg` e normaliza fim de linha para LF. */
export function lerAlg(caminho) {
  return decodificar(readFileSync(caminho)).replace(/\r\n/g, "\n");
}

/** Lista recursivamente os `.alg` de uma pasta, em ordem estável. */
export function listarAlgs(dir) {
  const saida = [];
  if (!existsSync(dir)) return saida;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entrada.name);
    if (entrada.isDirectory()) saida.push(...listarAlgs(p));
    else if (entrada.name.toLowerCase().endsWith(".alg")) saida.push(p);
  }
  return saida.sort();
}

/** Todos os `.alg` do corpus, em ordem estável de caminho absoluto. */
export function todosAlgs() {
  return PASTAS.flatMap((pasta) => listarAlgs(join(RAIZ, pasta)));
}

/** Caminho relativo à raiz, com separador "/" (usado nos relatórios de teste). */
export function caminhoRelativo(caminho) {
  return relative(RAIZ, caminho).split(sep).join("/");
}

/** Modifica arquivos sob a raiz. Usado pelo gerador. */
export { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
export { join, dirname, relative, sep } from "node:path";
