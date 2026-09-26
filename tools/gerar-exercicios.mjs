import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const baseDir = join(scriptDir, "..");
const saida = join(baseDir, "data", "exercises.js");
const PASTAS = ["faccat", "manzano"];
const GRUPOS = [
  { id: "manzano-p25", livro: "Manzano", rotulo: "Manzano — Pág. 25 (sequencial)", ordem: 1 },
  { id: "manzano-p26", livro: "Manzano", rotulo: "Manzano — Pág. 26 (extras)", ordem: 2 },
  { id: "manzano-p46", livro: "Manzano", rotulo: "Manzano — Pág. 46 (enquanto/faça)", ordem: 3 },
  { id: "manzano-p50", livro: "Manzano", rotulo: "Manzano — Pág. 50 (repita/até)", ordem: 4 },
  { id: "manzano-p66", livro: "Manzano", rotulo: "Manzano — Pág. 66 (para)", ordem: 5 },
  { id: "faccat-p4", livro: "Faccat", rotulo: "Faccat — Pág. 4 (operadores aritméticos)", ordem: 6 },
  { id: "faccat-p5", livro: "Faccat", rotulo: "Faccat — Pág. 5 (horizontalização)", ordem: 7 },
  { id: "faccat-p5-6", livro: "Faccat", rotulo: "Faccat — Pág. 5-6 (seleção)", ordem: 8 },
  { id: "faccat-p6-8", livro: "Faccat", rotulo: "Faccat — Pág. 6-8 (seleção aninhada)", ordem: 9 },
  { id: "faccat-p8", livro: "Faccat", rotulo: "Faccat — Pág. 8+ (operadores lógicos / seleção)", ordem: 10 },
  { id: "exemplos", livro: "Exemplos", rotulo: "Exemplos", ordem: 11 },
];
const RE_DESCRICAO = /^\s*\/\/\s*Descr[^:]{0,12}\s*:\s*(.+)$/im;
const UFFFD = "\uFFFD";
const MOJIBAKE = "\u00EF\u00BF\u00BD";
function decodificar(bytes) {
  let texto = null;
  let caiuParaLatin1 = false;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
    caiuParaLatin1 = true;
  }
  texto = texto.split(UFFFD).join("?");
  if (caiuParaLatin1) texto = texto.split(MOJIBAKE).join("?");
  return texto;
}
function grupoDe(id) {
  let m;
  if ((m = /^manzano\/ex(25|26|46|50|66)_/.exec(id))) {
    return "manzano-p" + m[1];
  }
  if ((m = /^faccat\/ex(\d+)$/.exec(id))) {
    const n = Number(m[1]);
    if (n >= 5 && n <= 11) return "faccat-p4";
    if (n === 12 || n === 13) return "faccat-p5";
    if (n >= 14 && n <= 26) return "faccat-p5-6";
    if (n >= 27 && n <= 38) return "faccat-p6-8";
    if (n >= 39 && n <= 48) return "faccat-p8";
    throw new Error("Exercicio sem grupo: " + id);
  }
  if (/^exemplos\//.test(id)) return "exemplos";
  throw new Error("Exercicio sem grupo: " + id);
}
function listarArquivos() {
  const encontrados = [];
  for (const pasta of PASTAS) {
    const dir = join(baseDir, pasta);
    for (const nome of readdirSync(dir)) {
      if (!/\.alg$/i.test(nome)) continue;
      const caminho = join(dir, nome);
      if (!statSync(caminho).isFile()) continue;
      const rel = relative(baseDir, caminho).split(sep).join("/");
      encontrados.push({ caminho, id: rel.replace(/\.alg$/i, "") });
    }
  }
  encontrados.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return encontrados;
}
const arquivos = listarArquivos();
const exercicios = arquivos.map(({ caminho, id }) => {
  const texto = decodificar(readFileSync(caminho)).replace(/\r\n/g, "\n");
  const codigo = texto.endsWith("\n") ? texto : texto + "\n";
  const titulo = id.slice(id.lastIndexOf("/") + 1);
  const m = RE_DESCRICAO.exec(codigo);
  const descricao = m ? m[1].replace(/\s+/g, " ").trim() : "";
  return { id, grupo: grupoDe(id), titulo, descricao, codigo };
});
const ordemDe = {};
for (const g of GRUPOS) ordemDe[g.id] = g.ordem;
exercicios.sort(
  (a, b) =>
    ordemDe[a.grupo] - ordemDe[b.grupo] ||
    a.titulo.localeCompare(b.titulo, "pt", { numeric: true }) ||
    a.id.localeCompare(b.id, "pt", { numeric: true })
);
const usados = new Set(exercicios.map((e) => e.grupo));
const gruposSaida = GRUPOS.filter((g) => usados.has(g.id)).sort((a, b) => a.ordem - b.ordem);
const linhas = [];
linhas.push(
  "// GERADO por tools/gerar-exercicios.mjs — não edite à mão. Rode: node tools/gerar-exercicios.mjs"
);
linhas.push("window.GRUPOS = [");
gruposSaida.forEach((g, i) => {
  linhas.push(
    "  { id: " +
      JSON.stringify(g.id) +
      ", livro: " +
      JSON.stringify(g.livro) +
      ", rotulo: " +
      JSON.stringify(g.rotulo) +
      ", ordem: " +
      g.ordem +
      " }" +
      (i < gruposSaida.length - 1 ? "," : "")
  );
});
linhas.push("];");
linhas.push("window.EXERCICIOS = [");
exercicios.forEach((e, i) => {
  linhas.push("  {");
  linhas.push("    id: " + JSON.stringify(e.id) + ",");
  linhas.push("    grupo: " + JSON.stringify(e.grupo) + ",");
  linhas.push("    titulo: " + JSON.stringify(e.titulo) + ",");
  linhas.push("    descricao: " + JSON.stringify(e.descricao) + ",");
  linhas.push("    codigo: " + JSON.stringify(e.codigo));
  linhas.push(i < exercicios.length - 1 ? "  }," : "  }");
});
linhas.push("];");
linhas.push("");
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, linhas.join("\n"), "utf8");
const contagem = {};
for (const e of exercicios) contagem[e.grupo] = (contagem[e.grupo] || 0) + 1;
console.log("Arquivos .alg encontrados: " + arquivos.length);
for (const g of gruposSaida) {
  console.log("  " + g.ordem + ". [" + g.id + "] " + g.rotulo + ": " + (contagem[g.id] || 0));
}
console.log("Total: " + exercicios.length + " exercicios em " + gruposSaida.length + " grupos");
console.log("Saida: " + saida);
