#!/usr/bin/env node
// Roda TODAS as suítes e devolve 1 se alguma falhar.
//
// A lista é explícita, não descoberta por varredura, porque descobrir por
// varredura esconde suíte esquecida atrás de um nome de arquivo inesperado — e
// uma suíte esquecida é pior que nenhuma, porque parece cobertura.
//
// Uso: node tools/testar-tudo.mjs
import { spawnSync } from "node:child_process";
import { join, relative, sep } from "node:path";
import { RAIZ } from "./lib/corpus.mjs";

const SUITES = [
  // O smoke dos 95 e os 21 unitários de comportamento, como antes.
  "tools/testar.mjs",
  // Por camada do engine, na ordem em que as ondas as criaram.
  "tests/semantic/semantic.test.mjs",
  "tests/stdlib/math.test.mjs",
  "tests/stdlib/string.test.mjs",
  "tests/extensions/extensions.test.mjs",
  // Playground.
  "tests/playground/editor.test.mjs",
  "tests/playground/persist.test.mjs",
  // A cola entre `script.js` e a API do Debugger. Existe porque o core pode
  // estar 100% verde e a página ainda assim estar quebrada: `script.js` chamava
  // métodos que a reescrita do debugger removeu, e o `TypeError` no handler do
  // botão Passo deixava a UI sem nenhuma forma de recuperar.
  "tests/playground/glue.test.mjs",
  "tests/debugger/debugger.test.mjs",
  "tests/compat/corpus.test.mjs",
];

// Verificações de contrato, que não são suíte de casos mas não podem faltar.
const VERIFICACOES = ["tools/verificar-carga.mjs"];

let totalTestes = 0;
let totalPass = 0;
let totalFail = 0;
const quebradas = [];

function contaLinha(saida) {
  const m = saida.match(/RESUMO:\s*(\d+)\s+testes\s*\|\s*(\d+)\s+pass\s*\|\s*(\d+)\s+fail/);
  if (!m) return null;
  return { testes: +m[1], pass: +m[2], fail: +m[3] };
}

console.log("=".repeat(66));
console.log("VERIFICAÇÕES DE CONTRATO");
console.log("=".repeat(66));
for (const v of VERIFICACOES) {
  const r = spawnSync(process.execPath, [join(RAIZ, v)], { cwd: RAIZ, encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  const marca = r.status === 0 ? "✅" : "❌";
  console.log(marca + " " + v);
  for (const l of saida.split(/\r?\n/)) {
    if (l.startsWith("✅") || l.startsWith("❌")) console.log("   " + l.trim());
  }
  if (r.status !== 0) quebradas.push(v);
}

for (const s of SUITES) {
  const rel = relative(RAIZ, join(RAIZ, s)).split(sep).join("/");
  console.log("");
  console.log("=".repeat(66));
  console.log("SUÍTE " + rel);
  console.log("=".repeat(66));
  const r = spawnSync(process.execPath, [join(RAIZ, s)], { cwd: RAIZ, encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  if (r.status !== 0) {
    const c = contaLinha(saida);
    if (c) {
      totalTestes += c.testes;
      totalPass += c.pass;
      totalFail += c.fail;
    }
    quebradas.push(rel);
    console.log(saida.trim());
  } else {
    const c = contaLinha(saida);
    if (c) {
      totalTestes += c.testes;
      totalPass += c.pass;
      totalFail += c.fail;
      console.log("✅ " + c.testes + " testes | " + c.pass + " pass | " + c.fail + " fail");
      const info = saida.split(/\r?\n/).filter((l) => l.includes("composição") || l.includes("ℹ️"));
      for (const l of info) console.log("   " + l.trim());
    } else {
      console.log(saida.trim());
    }
  }
}

console.log("");
console.log("=".repeat(66));
if (quebradas.length === 0) {
  console.log("✅ TUDO VERDE — " + SUITES.length + " suítes | " + totalTestes + " testes | " + totalPass + " pass | " + totalFail + " fail");
} else {
  console.log("❌ " + quebradas.length + "verification(s) FALHARAM: " + quebradas.join(", "));
  console.log("   total: " + totalTestes + " testes | " + totalPass + " pass | " + totalFail + " fail");
}
console.log("=".repeat(66));
process.exit(quebradas.length === 0 ? 0 : 1);
