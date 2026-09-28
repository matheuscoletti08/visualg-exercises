// Testes da biblioteca matemática (§29) — `src/visualg/stdlib/math.js`.
//
// Executável isolado: `node tests/stdlib/math.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`) e depois o `math.js` por último, porque o módulo
// consome `W.VG.Diagnostics` no instante em que é avaliado. Se a ordem
// divergir da de `index.html`, o teste passa e o navegador quebra — o que
// `tools/verificar-carga.mjs` existe para impedir.
//
// Tolerância: 1e-9 em tudo que não é inteiro exato. `sen(30)` é
// 0.49999999999999994 em ponto flutuante, e um teste com `===` só passaria por
// acidente de arredondamento, não por corretude.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULO = "src/visualg/stdlib/math.js";

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
await import(pathToFileURL(join(RAIZ, MODULO)).href);

const VG = globalThis.VG;
const { registro, nomes } = VG.StdlibMath;

const TOL = 1e-9;

// --------------------------------------------------------------------- asserts

let total = 0;
let pass = 0;
let fail = 0;

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

function numero(v) {
  return typeof v === "number" ? v : JSON.stringify(v);
}

/** `a` e `b` iguais dentro de 1e-9. Inteiros exatos passam por aqui também. */
function perto(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= TOL;
}

/** Executa um builtin pelo nome em minúsculas, como o `runtime.js` faz. */
function chamar(nome, ...args) {
  return registro[nome.toLowerCase()](args, null, null);
}

/** Executa e espera erro; devolve o erro para o teste inspecionar. */
function falha(nome, ...args) {
  try {
    chamar(nome, ...args);
  } catch (e) {
    return e;
  }
  return null;
}

function caso(nome, fn) {
  try {
    const detalhe = fn();
    relatar(!detalhe, nome, detalhe || "falhou sem detalhe");
  } catch (e) {
    relatar(false, nome, "exceção inesperada: " + (e && e.message ? e.message : String(e)));
  }
}

function igual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (perto(obtido, esperado)) return null;
    return "esperado ~" + numero(esperado) + ", veio " + numero(obtido);
  });
}

function inteiroIgual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (obtido === esperado) return null;
    return "esperado " + esperado + " (inteiro), veio " + numero(obtido);
  });
}

/** Espera erro nomeado: devolve o erro, e `null` se não houve. */
function erroEsperado(nome, nomeFuncao, entrada, checar) {
  caso(nome, () => {
    const e = falha(nomeFuncao, ...entrada);
    if (!e) return "devia ter erro, veio " + numero(chamar(nomeFuncao, ...entrada));
    if (!(e instanceof VG.Diagnostics.ErroVisualG)) {
      return "erro não é da hierarquia §46: " + e.constructor.name;
    }
    if (e.codigo !== "TIPO_ARGUMENTOS") return "código de erro inesperado: " + e.codigo;
    const problema = checar ? checar(e) : null;
    return problema;
  });
}

// ---------------------------------------------------------------------- testes

console.log("");
console.log("§29 — biblioteca matemática (src/visualg/stdlib/math.js)");
console.log("-".repeat(66));

// --- registro ------------------------------------------------------------
caso("registro tem as 21 funções (19 da §29 + Arred e ArredP) em minúsculas", () => {
  const esperadas = [
    "abs", "arccos", "arcsen", "arctan", "cos", "cotan", "exp", "grauprad", "int", "log",
    "logn", "pi", "quad", "radpgrau", "raizq", "rand", "randi", "sen", "tan",
    "arred", "arredp",
  ];
  const faltando = esperadas.filter((n) => typeof registro[n] !== "function");
  if (faltando.length) return "sem implementação: " + faltando.join(", ");
  if (Object.keys(registro).length !== esperadas.length) {
    return "registro tem " + Object.keys(registro).length + " chaves, esperava " + esperadas.length;
  }
  return null;
});

caso("nomes traz os 19 do spec §29 mais Arred e ArredP, capitalizados", () => {
  if (!Array.isArray(nomes) || nomes.length !== 21) return "nomes não é array de 21: " + JSON.stringify(nomes);
  const minusculos = nomes.map((n) => n.toLowerCase()).sort();
  const chaves = Object.keys(registro).sort();
  const soNoNome = minusculos.filter((n) => !chaves.includes(n));
  const soNaChave = chaves.filter((n) => !minusculos.includes(n));
  if (soNoNome.length || soNaChave.length) {
    return "descaso: nomes " + JSON.stringify(soNoNome) + " / registro " + JSON.stringify(soNaChave);
  }
  return null;
});

caso("os 19 nomes da §29 estão na grafia do spec", () => {
  const spec29 = [
    "Abs", "ArcCos", "ArcSen", "ArcTan", "Cos", "CoTan", "Exp", "GraupRad", "Int",
    "Log", "LogN", "Pi", "Quad", "RadpGrau", "RaizQ", "Rand", "RandI", "Sen", "Tan",
  ];
  const faltando = spec29.filter((n) => !nomes.includes(n));
  return faltando.length ? "faltando em nomes: " + faltando.join(", ") : null;
});

// --- Abs -----------------------------------------------------------------
igual("Abs(-2.5) = 2.5", "abs", [-2.5], 2.5);
caso("Abs(7) devolve inteiro, não real", () => {
  const v = chamar("abs", 7);
  if (v === 7 && Number.isInteger(v)) return null;
  return "esperado inteiro 7, veio " + numero(v);
});

// --- Arred ---------------------------------------------------------------
igual("Arred(2.5, 0) = 3 (desempate para longe do zero)", "arred", [2.5, 0], 3);
igual("Arred(-2.5, 0) = -3 (desempate para longe do zero)", "arred", [-2.5, 0], -3);
igual("Arred(3.14159, 2) = 3.14", "arred", [3.14159, 2], 3.14);
igual("Arred(1234, -2) = 1200 (potência de 10 via casas negativo)", "arred", [1234, -2], 1200);
igual("Arred(1250, -2) = 1300 (desempate para cima em potência de 10)", "arred", [1250, -2], 1300);
igual("Arred(1234, 2, 2) = 1200 (3 argumentos = potência de 10)", "arred", [1234, 2, 2], 1200);
igual("Arred(1234.567, 0, 2) = 1200", "arred", [1234.567, 0, 2], 1200);
igual("Arred(2.675, 2) = 2.68 (ruído binário neutralizado)", "arred", [2.675, 2], 2.68);

// --- ArredP --------------------------------------------------------------
igual("ArredP(2.5, 0) = 2 (desempate par)", "arredp", [2.5, 0], 2);
igual("ArredP(3.5, 0) = 4 (desempate par)", "arredp", [3.5, 0], 4);
igual("ArredP(-2.5, 0) = -2 (desempate par)", "arredp", [-2.5, 0], -2);
igual("ArredP(2.3456, 2) = 2.35 (desempate para cima)", "arredp", [2.3456, 2], 2.35);
igual("ArredP(2.3449, 2) = 2.34", "arredp", [2.3449, 2], 2.34);
igual("ArredP(2.675, 2) = 2.68 (ruído binário neutralizado)", "arredp", [2.675, 2], 2.68);

// --- inversas, em GRAUS --------------------------------------------------
igual("ArcSen(1) = 90 graus", "arcsen", [1], 90);
igual("ArcCos(0) = 90 graus", "arccos", [0], 90);
igual("ArcTan(1) = 45 graus", "arctan", [1], 45);
igual("ArcCos(-1) = 180 graus", "arccos", [-1], 180);
igual("ArcTan(-1) = -45 graus", "arctan", [-1], -45);
igual("ArcSen(0) = 0 graus", "arcsen", [0], 0);

// --- trigonometria em GRAUS (o ponto do módulo) ---------------------------
igual("Sen(90) = 1 (graus, não radianos)", "sen", [90], 1);
igual("Sen(0) = 0", "sen", [0], 0);
igual("Sen(30) = 0.5", "sen", [30], 0.5);
igual("Sen(180) = 0", "sen", [180], 0);
igual("Cos(0) = 1", "cos", [0], 1);
igual("Cos(180) = -1", "cos", [180], -1);
igual("Cos(60) = 0.5", "cos", [60], 0.5);
igual("Cos(360) = 1 (redução de volta a 0 graus, exato)", "cos", [360], 1);
igual("Tan(45) = 1", "tan", [45], 1);
igual("Tan(0) = 0 (múltiplo de 180 é valor legítimo)", "tan", [0], 0);
igual("Tan(180) = 0 (cosseno -1, não é erro de domínio)", "tan", [180], 0);
igual("Tan(-45) = -1", "tan", [-45], -1);
igual("CoTan(45) = 1", "cotan", [45], 1);
igual("CoTan(1) = recíproco de Tan(1)", "cotan", [1], 1 / Math.tan((1 * Math.PI) / 180));
igual("GraupRad(180) = PI", "grauprad", [180], Math.PI);
igual("GraupRad(0) = 0", "grauprad", [0], 0);
igual("RadpGrau(PI) = 180", "radpgrau", [Math.PI], 180);
igual("RadpGrau(0) = 0", "radpgrau", [0], 0);
caso("GraupRad e RadpGrau são inversas", () => {
  const ida = chamar("grauprad", 137);
  const volta = chamar("radpgrau", ida);
  return perto(volta, 137) ? null : "137 graus -> " + ida + " rad -> " + volta + " graus";
});

// --- exponenciais e logaritmos -------------------------------------------
igual("Exp(0) = 1", "exp", [0], 1);
igual("Exp(1) = e", "exp", [1], Math.E);
igual("Exp(2) = e ao quadrado", "exp", [2], Math.E * Math.E);
igual("Log(100) = 2", "log", [100], 2);
igual("Log(1000) = 3", "log", [1000], 3);
igual("Log(1) = 0", "log", [1], 0);
igual("LogN(8, 2) = 3", "logn", [8, 2], 3);
igual("LogN(1000, 10) = 3", "logn", [1000, 10], 3);
igual("LogN(1, 5) = 0", "logn", [1, 5], 0);
caso("LogN(27, 3) = 3", () => {
  const v = chamar("logn", 27, 3);
  return perto(v, 3) ? null : "esperado 3, veio " + numero(v);
});

// --- inteiros e potências ------------------------------------------------
inteiroIgual("Int(2.7) = 2", "int", [2.7], 2);
inteiroIgual("Int(-2.7) = -2 (trunca em zero, não floor)", "int", [-2.7], -2);
inteiroIgual("Int(5) = 5", "int", [5], 5);
inteiroIgual("Quad(7) = 49", "quad", [7], 49);
inteiroIgual("Quad(-3) = 9", "quad", [-3], 9);
igual("Quad(1.5) = 2.25", "quad", [1.5], 2.25);
igual("RaizQ(9) = 3", "raizq", [9], 3);
igual("RaizQ(2) = 1.4142...", "raizq", [2], Math.SQRT2);
igual("RaizQ(0) = 0", "raizq", [0], 0);
igual("RaizQ(0.25) = 0.5", "raizq", [0.25], 0.5);

// --- Pi, Rand, RandI -----------------------------------------------------
caso("Pi() = PI", () => {
  const v = chamar("pi");
  return perto(v, Math.PI) ? null : "esperado PI, veio " + numero(v);
});
caso("Pi() sem argumento funciona; Pi(1) é erro de aridade", () => {
  if (falha("pi", 1) === null) return "Pi(1) devia dar erro de aridade";
  return null;
});
caso("Rand() fica em [0, 1) e não recebe argumento", () => {
  for (let i = 0; i < 500; i++) {
    const v = chamar("rand");
    if (!(v >= 0 && v < 1)) return "fora de [0,1): " + numero(v);
  }
  if (falha("rand", 1) === null) return "Rand(1) devia dar erro de aridade";
  return null;
});
caso("RandI(n) devolve inteiro de 1 a n", () => {
  for (let i = 0; i < 500; i++) {
    const v = chamar("randi", 6);
    if (!Number.isInteger(v) || v < 1 || v > 6) return "fora de 1..6: " + numero(v);
  }
  return null;
});
caso("RandI(1) devolve sempre 1", () => {
  for (let i = 0; i < 50; i++) {
    if (chamar("randi", 1) !== 1) return "RandI(1) não é sempre 1";
  }
  return null;
});
caso("Rand cobre a faixa toda (as duas pontas aparecem)", () => {
  // Só para não passar um `randi` degenerado que sempre devolve 1: 3000 amostras
  // de 1..6 têm chance desprezível de não ver 1 nem 6.
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 3000; i++) {
    const v = chamar("randi", 6);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min !== 1 || max !== 6) return "cobertura só de " + min + " a " + max;
  return null;
});

// --- erros de domínio (§29.4 pede tratamento explícito) -------------------
erroEsperado(
  "RaizQ(-1) dá erro nomeado, não NaN (§29.4)",
  "raizq",
  [-1],
  (e) => (/RaizQ/.test(e.mensagem) ? null : "mensagem não cita RaizQ: " + e.mensagem)
);
erroEsperado("ArcCos(2) dá erro de domínio", "arccos", [2], null);
erroEsperado("ArcCos(-1.5) dá erro de domínio", "arccos", [-1.5], null);
erroEsperado("ArcSen(1.0001) dá erro de domínio", "arcsen", [1.0001], null);
erroEsperado("ArcSen(-2) dá erro de domínio", "arcsen", [-2], null);
erroEsperado("Log(0) dá erro de domínio", "log", [0], null);
erroEsperado("Log(-1) dá erro de domínio", "log", [-1], null);
erroEsperado("LogN(10, 1) dá erro: base 1 não tem solução", "logn", [10, 1], null);
erroEsperado("LogN(10, 0) dá erro de base", "logn", [10, 0], null);
erroEsperado("LogN(10, -2) dá erro de base", "logn", [10, -2], null);
erroEsperado("LogN(0, 10) dá erro de argumento", "logn", [0, 10], null);
caso("Cos(90) = 0 e Tan(90) dá erro (mesmo argumento, domínios diferentes)", () => {
  const c = chamar("cos", 90);
  if (!perto(c, 0)) return "Cos(90) esperado 0, veio " + numero(c);
  const e = falha("tan", 90);
  if (!e) return "Tan(90) devia dar erro de domínio";
  if (e.codigo !== "TIPO_ARGUMENTOS") return "código inesperado: " + e.codigo;
  return null;
});
erroEsperado("Tan(90) dá erro: múltiplo de 90", "tan", [90], null);
erroEsperado("Tan(-90) dá erro: múltiplo de 90 negativo", "tan", [-90], null);
erroEsperado("Tan(270) dá erro: 90 + 180k", "tan", [270], null);
erroEsperado("Tan(-270) dá erro: -(90 + 180k)", "tan", [-270], null);
erroEsperado("CoTan(0) dá erro: múltiplo de 180", "cotan", [0], null);
erroEsperado("CoTan(180) dá erro: múltiplo de 180", "cotan", [180], null);
erroEsperado("CoTan(-180) dá erro", "cotan", [-180], null);
erroEsperado("RandI(0) dá erro", "randi", [0], null);
erroEsperado("RandI(-3) dá erro", "randi", [-3], null);

// --- aridade -------------------------------------------------------------
erroEsperado("Abs() sem argumento dá erro de aridade", "abs", [], null);
erroEsperado("Abs(1, 2) com argumento a mais dá erro", "abs", [1, 2], null);
erroEsperado("Arred(1.5) sem casas dá erro de aridade", "arred", [1.5], null);
erroEsperado("ArredP(1.5) sem casas dá erro de aridade", "arredp", [1.5], null);
erroEsperado("Arred(1, 2, 3, 4) dá erro de aridade", "arred", [1, 2, 3, 4], null);
erroEsperado("LogN(10) sem base dá erro de aridade", "logn", [10], null);
erroEsperado("Sen() sem argumento dá erro de aridade", "sen", [], null);
erroEsperado("RaizQ() sem argumento dá erro de aridade", "raizq", [], null);
erroEsperado("Rand() com argumento dá erro de aridade", "rand", [1], null);
erroEsperado("RandI() sem argumento dá erro de aridade", "randi", [], null);
caso("mensagem de aridade diz quantos argumentos eram esperados", () => {
  const e = falha("abs");
  if (!e) return "não deu erro";
  if (!/Abs/.test(e.mensagem)) return "mensagem não cita Abs: " + e.mensagem;
  if (!/argumento/.test(e.mensagem)) return "mensagem não fala em argumento: " + e.mensagem;
  return null;
});

// --- tipos ---------------------------------------------------------------
erroEsperado("Abs('3') com texto dá erro nomeado, não coerção", "abs", ["3"], (e) =>
  /caractere/.test(e.mensagem) ? null : "mensagem não diz que veio caractere: " + e.mensagem
);
erroEsperado("Sen('90') com texto dá erro, não NaN", "sen", ["90"], null);
erroEsperado("RaizQ(VERDADEIRO) com lógico dá erro", "raizq", [true], null);
erroEsperado("LogN(10, 'a') com texto na base dá erro", "logn", [10, "a"], null);
erroEsperado("Arred(1.5, '2') com casas textuais dá erro", "arred", [1.5, "2"], null);
erroEsperado("RandI(6.5) com real dá erro: exige inteiro", "randi", [6.5], null);
erroEsperado("Int(NaN) dá erro, não devolve 0", "int", [NaN], null);
erroEsperado("Abs(Infinito) dá erro, não devolve infinito", "abs", [Infinity], null);
caso("erro de tipo traz posição quando o runtime a fornece", () => {
  // O `Runtime.chamar` ainda não repassa `pos` ao builtin (é um 3º argumento
  // opcional), mas o caminho tem que existir: erro sem `pos` é erro sem linha.
  const e = (() => {
    try {
      registro.abs(["x"], null, { linha: 12, coluna: 3 });
      return null;
    } catch (x) {
      return x;
    }
  })();
  if (!e) return "não deu erro";
  if (e.linha !== 12 || e.sourceColumn !== 3) {
    return "posição perdida: linha " + e.linha + " coluna " + e.sourceColumn;
  }
  return null;
});
caso("sem posição, o erro não inventa linha", () => {
  const e = falha("sen", "x");
  if (!e) return "não deu erro";
  if (e.linha !== null || e.sourceColumn !== null) return "inventou posição: " + e.linha + ":" + e.sourceColumn;
  return null;
});

// --- nada de proibições do projeto ---------------------------------------
caso("nenhum erro cru de JavaScript: tudo passa por Diagnostics (§46)", () => {
  // `ErroVisualG` é subclasse de `Error`, então `instanceof Error` não separa.
  // O que separa é a hierarquia: um `throw new Error(...)` apareceria aqui como
  // `codigo` ausente.
  const e = falha("raizq", -1);
  if (!e) return "RaizQ(-1) não deu erro";
  if (!(e instanceof VG.Diagnostics.ErroTipo)) return "tipo de erro inesperado: " + e.constructor.name;
  if (!e.codigo) return "erro sem código: " + e.mensagem;
  return null;
});

console.log("-".repeat(66));
console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
if (fail > 0) process.exitCode = 1;
