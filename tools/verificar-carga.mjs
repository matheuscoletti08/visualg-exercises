#!/usr/bin/env node
// Verifica duas coisas que antes dependiam de disciplina manual:
//
// 1. A ordem de `<script src>` em `index.html` bate com `src/visualg/carga.mjs`.
//    A engine é montada por scripts clássicos; tag fora de ordem falha em
//    runtime com mensagem ruim.
//
// 2. As proibições do `task.md` continuam valendo mecanicamente: nada de
//    `eval`/`new Function`, nada de `type="module"`, nada de CDN/`http(s)`, que
//    quebraria o funcionamento via `file://`.
//
// Uso: node tools/verificar-carga.mjs
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RAIZ } from "./lib/corpus.mjs";
import { ORDEM, CARGA } from "../src/visualg/carga.mjs";

const problemas = [];

function falha(msg, detalhe) {
  problemas.push({ msg, detalhe });
}

const indexPath = join(RAIZ, "index.html");
if (!existsSync(indexPath)) {
  console.error("❌ index.html não encontrado em " + RAIZ);
  process.exit(1);
}
const html = readFileSync(indexPath, "utf8");

// 1. Ordem de carga.
const RE_SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*>/gi;
const encontrado = [];
let m;
while ((m = RE_SCRIPT_SRC.exec(html)) !== null) encontrado.push(m[1].replace(/^\.?\//, ""));

if (encontrado.length === 0) {
  falha("index.html não tem nenhum <script src>", null);
} else {
  for (const c of CARGA) {
    const iEsperado = ORDEM.indexOf(c.src);
    const iEncontrado = encontrado.indexOf(c.src);
    if (iEncontrado === -1) {
      falha("script ausente do index.html: " + c.src, c.motivo);
    } else if (iEncontrado !== iEsperado) {
      falha(
        "script fora de ordem: " + c.src,
        "esperava posição " + (iEsperado + 1) + " (" + c.motivo + "), está na posição " + (iEncontrado + 1)
      );
    }
  }
  for (const src of encontrado) {
    if (!ORDEM.includes(src)) {
      falha("script no index.html que não está no contrato de carga: " + src, "declare em src/visualg/carga.mjs");
    }
  }
  // Um script declarado depois de script.js não tem para quem se ligar.
  const iScriptJs = encontrado.indexOf("script.js");
  if (iScriptJs !== -1 && iScriptJs !== encontrado.length - 1) {
    falha(
      "script.js não é o último script",
      "a UI consome a engine; tags depois dela não são inicializadas pela UI"
    );
  }
}

// 2. Proibições.
if (/\btype\s*=\s*"module"/i.test(html)) {
  falha('index.html usa type="module"', "quebra file://; o projeto usa <script> clássicos");
}
if (/\b(?:src|href)\s*=\s*"https?:/i.test(html)) {
  falha("index.html carrega recurso remoto (http/https)", "quebra file:// e exige rede");
}
if (/\b(?:src|href)\s*=\s*"\/\//i.test(html)) {
  falha("index.html carrega recurso com URL relativa de protocolo (//)", "quebra file:// e exige rede");
}

// Varredura de eval/Function na engine e na UI.
const ALVOS_EVAL = ["script.js", "interpreter", "src"];
const RE_EVAL = /(?<![.\w$])eval\s*\(/;
const RE_FUNCTION_CTOR = /(?<![.\w$])new\s+Function\s*\(/;

function coletarJs(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...coletarJs(p));
    else if (p.endsWith(".js")) saida.push(p);
  }
  return saida;
}

const varridos = [];
for (const alvo of ALVOS_EVAL) {
  const p = join(RAIZ, alvo);
  if (!existsSync(p)) continue;
  if (statSync(p).isFile()) varridos.push(p);
  else varridos.push(...coletarJs(p));
}
for (const p of varridos) {
  const texto = readFileSync(p, "utf8");
  const rel = p.slice(RAIZ.length + 1).split("\\").join("/");
  const linhas = texto.split("\n");
  linhas.forEach((linha, i) => {
    // Ignora linha que é só comentário.
    const t = linha.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    if (RE_EVAL.test(linha)) {
      falha("uso de eval() proibido", rel + ":" + (i + 1));
    }
    if (RE_FUNCTION_CTOR.test(linha)) {
      falha("uso de new Function() proibido", rel + ":" + (i + 1));
    }
  });
}

// Relatório.
if (problemas.length === 0) {
  console.log("✅ carga: " + encontrado.length + " scripts na ordem do contrato");
  console.log("✅ proibições: nenhum eval/Function, nenhum type=\"module\", nenhum recurso remoto");
  process.exit(0);
}
console.error("❌ " + problemas.length + " problema(s) em carga/proibições:");
for (const p of problemas) {
  console.error("  • " + p.msg + (p.detalhe ? "  — " + p.detalhe : ""));
}
process.exit(1);
