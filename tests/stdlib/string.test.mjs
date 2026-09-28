// Testes da biblioteca de texto (§30) — `src/visualg/stdlib/string.js`.
//
// Executável isolado: `node tests/stdlib/string.test.mjs`.
//
// Carrega a engine na MESMA ordem do browser (`ORDEM_ENGINE` de
// `src/visualg/carga.mjs`) e depois o `string.js` por último, porque o módulo
// consome `W.VG.Diagnostics` e `W.VG.Values` no instante em que é avaliado.
//
// Tolerância: 1e-9 em tudo que não é inteiro exato. `caracpnum` produz real a
// partir de texto, e `parseFloat`/`Number` em ponto flutuante podem dar o
// último dígito diferente do que a conta "à mão" sugere.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ } from "../../tools/lib/corpus.mjs";
import { ORDEM_ENGINE } from "../../src/visualg/carga.mjs";

const MODULO = "src/visualg/stdlib/string.js";

for (const src of ORDEM_ENGINE) {
  await import(pathToFileURL(join(RAIZ, src)).href);
}
await import(pathToFileURL(join(RAIZ, MODULO)).href);

const VG = globalThis.VG;
const { registro, nomes } = VG.StdlibString;

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
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}

/** `a` e `b` iguais dentro de 1e-9. Só para números. */
function perto(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= TOL;
}

/**
 * Executa um builtin pelo nome em minúsculas, como o `runtime.js` faz
 * (`this.registros[nome.toLowerCase()]`, `src/visualg/runtime.js:389`).
 * `pos` é `null` porque o runtime ainda não repassa o terceiro argumento.
 */
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

/**
 * Igualdade de NUMERO. Não usa `==` nem `===` no valor: `compr("ABC")` tem de
 * devolver o inteiro 3, e a checagem só confirma que o tipo number voltou.
 */
function numIgual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (perto(obtido, esperado)) return null;
    return "esperado " + numero(esperado) + ", veio " + numero(obtido);
  });
}

/** Igualdade de REAL, exigindo que o resultado seja number e não texto. */
function realIgual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (typeof obtido !== "number") return "esperado number, veio " + typeof obtido + " " + numero(obtido);
    if (perto(obtido, esperado)) return null;
    return "esperado ~" + numero(esperado) + ", veio " + numero(obtido);
  });
}

/** Igualdade de TEXTO, com o valor entre aspas no detalhe para ler o espaço. */
function txtIgual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (obtido === esperado) return null;
    return "esperado " + JSON.stringify(esperado) + ", veio " + JSON.stringify(obtido);
  });
}

/** Igualdade de INTEIRO, exigindo `Number.isInteger`. */
function intIgual(nome, nomeFuncao, entrada, esperado) {
  caso(nome, () => {
    const obtido = chamar(nomeFuncao, ...entrada);
    if (obtido === esperado && Number.isInteger(obtido)) return null;
    return "esperado inteiro " + esperado + ", veio " + numero(obtido);
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
console.log("§30 — biblioteca de texto (src/visualg/stdlib/string.js)");
console.log("-".repeat(66));

// --- registro ------------------------------------------------------------
caso("registro tem as 9 funções da §30 em minúsculas", () => {
  const esperadas = [
    "asc", "carac", "caracpnum", "compr", "copia",
    "maiusc", "minusc", "numpcarac", "pos",
  ];
  const faltando = esperadas.filter((n) => typeof registro[n] !== "function");
  if (faltando.length) return "sem implementação: " + faltando.join(", ");
  if (Object.keys(registro).length !== esperadas.length) {
    return "registro tem " + Object.keys(registro).length + " chaves, esperava " + esperadas.length;
  }
  return null;
});

caso("nomes traz os 9 do spec §30, capitalizados", () => {
  if (!Array.isArray(nomes) || nomes.length !== 9) return "nomes não é array de 9: " + JSON.stringify(nomes);
  const minusculos = nomes.map((n) => n.toLowerCase()).sort();
  const chaves = Object.keys(registro).sort();
  const soNoNome = minusculos.filter((n) => !chaves.includes(n));
  const soNaChave = chaves.filter((n) => !minusculos.includes(n));
  if (soNoNome.length || soNaChave.length) {
    return "descaso: nomes " + JSON.stringify(soNoNome) + " / registro " + JSON.stringify(soNaChave);
  }
  return null;
});

caso("os 9 nomes da §30 estão na grafia do spec", () => {
  const spec30 = ["Asc", "Carac", "CaracPNum", "Compr", "Copia", "Maiusc", "Minusc", "NumpCarac", "Pos"];
  const faltando = spec30.filter((n) => !nomes.includes(n));
  return faltando.length ? "faltando em nomes: " + faltando.join(", ") : null;
});

caso("toda chave do registro é alcançável pelo que o runtime faz (toLowerCase)", () => {
  // `CaracPNum` e `NumpCarac` normalizam para `caracpnum`/`numpcarac`, e é por
  // isso que as chaves NÃO podem ter acento nem maiúscula.
  const inacessiveis = nomes.filter((n) => typeof registro[n.toLowerCase()] !== "function");
  return inacessiveis.length ? "sem implementação para: " + inacessiveis.join(", ") : null;
});

// --- Copia: indexação 1-based INCLUSIVA (o ponto central da §30) ---------
// Os três primeiros são os casos que a onda 8B exige; o resto é a borda.
txtIgual('copia("ABCDE", 2, 4) = "BCD" (1-based e INCLUSIVO nos dois extremos)', "copia", ["ABCDE", 2, 4], "BCD");
txtIgual('copia("ABCDE", 1, 99) = "ABCDE" (fim além do comprimento: vai até o fim)', "copia", ["ABCDE", 1, 99], "ABCDE");
txtIgual('copia("ABCDE", 9, 10) = "" (início além do comprimento)', "copia", ["ABCDE", 9, 10], "");
txtIgual('copia("ABCDE", 1, 1) = "A" (um caractere só)', "copia", ["ABCDE", 1, 1], "A");
txtIgual('copia("ABCDE", 5, 5) = "E" (último caractere, extremo final incluído)', "copia", ["ABCDE", 5, 5], "E");
txtIgual('copia("ABCDE", 0, 2) = "AB" (início abaixo de 1 é tratado como 1)', "copia", ["ABCDE", 0, 2], "AB");
txtIgual('copia("ABCDE", -3, 2) = "AB" (início negativo satura em 1)', "copia", ["ABCDE", -3, 2], "AB");
txtIgual('copia("ABCDE", 4, 2) = "" (faixa invertida é vazio, não erro)', "copia", ["ABCDE", 4, 2], "");
txtIgual('copia("", 1, 5) = ""', "copia", ["", 1, 5], "");
txtIgual('copia("ABCDE", 3, 3) = "C" (início e fim no mesmo ponto)', "copia", ["ABCDE", 3, 3], "C");
caso("copia NÃO é slice() ingênuo: a sub-bateria desmente os dois deslocamentos", () => {
  // Um `slice(ini, fim)` sem o `-1` daria "CDE" no primeiro caso. Um
  // `slice(ini, fim + 1)` daria "BCDE". Só o `-1` no começo com o fim cru dá
  // "BCD", que é o esperado. Se alguém "consertar" a fórmula, este teste quebra.
  const meio = chamar("copia", "ABCDE", 2, 4);
  if (meio !== "BCD") return 'copia("ABCDE", 2, 4) deveria dar "BCD", veio ' + JSON.stringify(meio);
  const primeiro = chamar("copia", "ABCDE", 1, 1);
  if (primeiro !== "A") return 'copia("ABCDE", 1, 1) deveria dar "A", veio ' + JSON.stringify(primeiro);
  const ultimo = chamar("copia", "ABCDE", 5, 5);
  if (ultimo !== "E") return 'copia("ABCDE", 5, 5) deveria dar "E", veio ' + JSON.stringify(ultimo);
  return null;
});
caso("copia fecha: 12 comparações contra a substring esperada", () => {
  // Rede de segurança para a tabela de casos. `Copia` é a única função do
  // módulo com aritmética de índice, e é a que mais merece conferência dupla.
  const casos = [
    ["ABCDE", 1, 1, "A"], ["ABCDE", 1, 2, "AB"], ["ABCDE", 1, 3, "ABC"],
    ["ABCDE", 2, 3, "BC"], ["ABCDE", 2, 4, "BCD"], ["ABCDE", 2, 5, "BCDE"],
    ["ABCDE", 3, 4, "CD"], ["ABCDE", 3, 5, "CDE"], ["ABCDE", 4, 5, "DE"],
    ["ABCDE", 5, 5, "E"], ["ABCDE", 1, 5, "ABCDE"], ["ABCDE", 2, 2, "B"],
  ];
  for (const [s, i, f, esperado] of casos) {
    const obtido = chamar("copia", s, i, f);
    if (obtido !== esperado) {
      return "copia(" + JSON.stringify(s) + ", " + i + ", " + f + ") esperado " +
        JSON.stringify(esperado) + ", veio " + JSON.stringify(obtido);
    }
  }
  return null;
});
erroEsperado("copia(2.5) com início real dá erro: exige inteiro", "copia", ["ABCDE", 2.5, 4], (e) =>
  /inteiro/.test(e.mensagem) ? null : "mensagem não fala em inteiro: " + e.mensagem
);
erroEsperado("copia(\"ABCDE\", 1, 4.5) com fim real dá erro: exige inteiro", "copia", ["ABCDE", 1, 4.5], null);
erroEsperado("copia(5) com número no lugar do texto dá erro", "copia", [5, 1, 2], (e) =>
  /caractere/.test(e.mensagem) ? null : "mensagem não diz que veio inteiro: " + e.mensagem
);
erroEsperado("copia(VERDADEIRO) com lógico dá erro", "copia", [true, 1, 2], null);

// --- Pos: PRIMEIRO argumento é o alvo -------------------------------------
intIgual('pos("BC", "ABCDE") = 2 (1º argumento é o que se procura)', "pos", ["BC", "ABCDE"], 2);
intIgual('pos("ZZ", "ABCDE") = 0 (não achou)', "pos", ["ZZ", "ABCDE"], 0);
intIgual('pos("A", "AAA") = 1 (primeira ocorrência, não a última)', "pos", ["A", "AAA"], 1);
intIgual('pos("A", "ABCDE") = 1 (início do texto é posição 1, não 0)', "pos", ["A", "ABCDE"], 1);
intIgual('pos("E", "ABCDE") = 5 (último caractere é posição 5)', "pos", ["E", "ABCDE"], 5);
intIgual('pos("ABCDE", "ABCDE") = 1 (texto inteiro)', "pos", ["ABCDE", "ABCDE"], 1);
intIgual('pos("CD", "ABCDE") = 3 (posição do início da ocorrência)', "pos", ["CD", "ABCDE"], 3);
caso('a ordem dos argumentos de pos NÃO é invertível: pos("ABCDE", "BC") = 0', () => {
  // Se alguém trocar os argumentos, este é o caso que denuncia. Com a leitura
  // invertida daria 3 (BC começa na 3ª letra de "ABCDE").
  const v = chamar("pos", "ABCDE", "BC");
  if (v === 0) return null;
  return 'pos("ABCDE", "BC") esperado 0 (BC não está em "ABCDE"), veio ' + numero(v);
});
caso("pos devolve 0 e não -1 quando não acha (o -1 do indexOf não escapa)", () => {
  const v = chamar("pos", "ZZZ", "ABCDE");
  if (v === 0) return null;
  return "esperado 0, veio " + numero(v) + " (indexOf devolveu -1 e passou direto?)";
});
caso("pos é sensível a caixa, como o uso canônico do VisuAlg (Minusc nos dois)", () => {
  // A §11 manda comparação de texto sem caixa, mas o uso canônico do VisuAlg
  // normaliza os DOIS argumentos com Minusc antes de chamar Pos — o que só
  // faz sentido se Pos for sensível a caixa. Ver a nota (2) do string.js.
  const achou = chamar("pos", "video", "cursoEmVideo");
  if (achou === 0) return null;
  return 'pos("video", "cursoEmVideo") esperado 0 (case-sensitive), veio ' + numero(achou);
});
caso("pos normalizado com Minusc nos dois argumentos acha, como o VisuAlg faz", () => {
  const alvo = chamar("minusc", "Video");
  const base = chamar("minusc", "cursoEmVideo");
  const v = chamar("pos", alvo, base);
  if (v === 8) return null;
  return 'Pos(Minusc("Video"), Minusc("cursoEmVideo")) esperado 8, veio ' + numero(v);
});
erroEsperado("pos(1, \"ABC\") com alvo numérico dá erro", "pos", [1, "ABC"], null);
erroEsperado("pos(\"AB\", 2) com texto base numérico dá erro", "pos", ["AB", 2], null);

// --- Compr: contagem, sem o +1 da indexação -------------------------------
intIgual('compr("") = 0', "compr", [""], 0);
intIgual('compr("ABC") = 3', "compr", ["ABC"], 3);
intIgual('compr("A") = 1', "compr", ["A"], 1);
intIgual('compr("cursoEmVideo") = 12', "compr", ["cursoEmVideo"], 12);
intIgual("compr(espaço) = 1 (o espaço conta como caractere)", "compr", [" "], 1);
caso("compr confere com a última posição que copia consegue preencher", () => {
  const s = "abcdef";
  const n = chamar("compr", s);
  const ultimo = chamar("copia", s, n, n);
  if (ultimo !== "f") return "copia(s, compr(s), compr(s)) esperado \"f\", veio " + JSON.stringify(ultimo);
  const umAcima = chamar("copia", s, n + 1, n + 1);
  if (umAcima !== "") return "posição compr+1 deveria dar vazio, veio " + JSON.stringify(umAcima);
  return null;
});

// --- Asc: código do PRIMEIRO caractere ------------------------------------
intIgual('asc("A") = 65', "asc", ["A"], 65);
intIgual('asc("Z") = 90', "asc", ["Z"], 90);
intIgual('asc("a") = 97 (minúscula tem código diferente)', "asc", ["a"], 97);
intIgual('asc("0") = 48', "asc", ["0"], 48);
intIgual('asc(" ") = 32', "asc", [" "], 32);
intIgual('asc("ABC") = 65 (só o PRIMEIRO caractere, comportamento tradicional)', "asc", ["ABC"], 65);
intIgual('asc("cursoEmVideo") = 99 (o "c" de curso, não o "C")', "asc", ["cursoEmVideo"], 99);
erroEsperado('asc("") com texto vazio dá erro, não devolve 0', "asc", [""], (e) =>
  /Asc/.test(e.mensagem) ? null : "mensagem não cita Asc: " + e.mensagem
);
erroEsperado("asc(65) com número dá erro", "asc", [65], null);
caso("asc e carac são inversas no ASCII", () => {
  for (let c = 32; c < 127; c++) {
    const letra = chamar("carac", c);
    const volta = chamar("asc", letra);
    if (volta !== c) return "carac(" + c + ") = " + JSON.stringify(letra) + " mas asc volta " + volta;
  }
  return null;
});

// --- Carac: código -> caractere -------------------------------------------
txtIgual('carac(65) = "A"', "carac", [65], "A");
txtIgual("carac(66) = \"B\"", "carac", [66], "B");
txtIgual("carac(48) = \"0\"", "carac", [48], "0");
txtIgual("carac(32) = \" \" (espaço)", "carac", [32], " ");
txtIgual('carac(0) = "\\u0000" (código 0 é o NUL, não string vazia)', "carac", [0], "\u0000");
txtIgual('carac(10) = "\\n" (código 10 é a quebra de linha)', "carac", [10], "\n");
erroEsperado("carac(67.5) com real dá erro: código não é inteiro", "carac", [67.5], (e) =>
  /inteiro/.test(e.mensagem) ? null : "mensagem não fala em inteiro: " + e.mensagem
);
erroEsperado("carac(-1) com código negativo dá erro de domínio", "carac", [-1], null);
erroEsperado("carac(99999999) com código fora do Unicode dá erro de domínio", "carac", [99999999], null);
erroEsperado("carac(\"65\") com texto dá erro, não coerção", "carac", ["65"], (e) =>
  /caractere/.test(e.mensagem) ? null : "mensagem não diz que veio caractere: " + e.mensagem
);

// --- CaracPNum: texto -> número, validando -------------------------------
realIgual('caracpnum("2,75") = 2.75 (vírgula decimal, padrão brasileiro)', "caracpnum", ["2,75"], 2.75);
realIgual('caracpnum("2.75") = 2.75 (ponto também vale)', "caracpnum", ["2.75"], 2.75);
realIgual('caracpnum("7") = 7', "caracpnum", ["7"], 7);
realIgual('caracpnum("-3") = -3 (sinal)', "caracpnum", ["-3"], -3);
realIgual('caracpnum("-2,5") = -2.5 (sinal com vírgula)', "caracpnum", ["-2,5"], -2.5);
realIgual('caracpnum(" 7 ") = 7 (espaço tolerado)', "caracpnum", [" 7 "], 7);
realIgual('caracpnum("0") = 0', "caracpnum", ["0"], 0);
caso("caracpnum devolve inteiro quando o texto é inteiro", () => {
  const v = chamar("caracpnum", "42");
  if (v === 42 && Number.isInteger(v)) return null;
  return "esperado inteiro 42, veio " + numero(v);
});
erroEsperado('caracpnum("abc") dá erro, não NaN', "caracpnum", ["abc"], (e) =>
  /CaracPNum/.test(e.mensagem) ? null : "mensagem não cita CaracPNum: " + e.mensagem
);
erroEsperado('caracpnum("") com texto vazio dá erro', "caracpnum", [""], null);
erroEsperado('caracpnum("12abc") com lixo no fim dá erro (parseFloat aceitaria 12)', "caracpnum", ["12abc"], null);
erroEsperado('caracpnum("1,2,3") com duas vírgulas dá erro', "caracpnum", ["1,2,3"], null);
erroEsperado('caracpnum("2,5,5") com decimal e separador de milhar dá erro', "caracpnum", ["2,5,5"], null);
erroEsperado('caracpnum(".") dá erro', "caracpnum", ["."], null);
erroEsperado('caracpnum("-") dá erro', "caracpnum", ["-"], null);
erroEsperado("caracpnum(2.75) com número já dá erro: espera texto", "caracpnum", [2.75], null);
erroEsperado("caracpnum(VERDADEIRO) com lógico dá erro", "caracpnum", [true], null);
caso("nenhum caminho de caracpnum devolve NaN", () => {
  const entradas = ["abc", "", ".", "-", "12abc", "1e5", "0x10", "NaN", "Infinity"];
  for (const e of entradas) {
    const x = falha("caracpnum", e);
    if (!x) return "caracpnum(" + JSON.stringify(e) + ") devolveu em vez de dar erro";
  }
  return null;
});

// --- NumpCarac: número -> texto ------------------------------------------
txtIgual('numpcarac(7) = "7" (inteiro sem casas decimais)', "numpcarac", [7], "7");
txtIgual('numpcarac(2.75) = "2.75" (real na representação normal)', "numpcarac", [2.75], "2.75");
txtIgual('numpcarac(0) = "0"', "numpcarac", [0], "0");
txtIgual('numpcarac(-5) = "-5" (sinal preservado)', "numpcarac", [-5], "-5");
txtIgual('numpcarac(-2.5) = "-2.5"', "numpcarac", [-2.5], "-2.5");
txtIgual('numpcarac(100) = "100" (não vira "100,00")', "numpcarac", [100], "100");
erroEsperado('numpcarac("7") com texto dá erro', "numpcarac", ["7"], null);
erroEsperado("numpcarac(VERDADEIRO) com lógico dá erro", "numpcarac", [true], null);
erroEsperado("numpcarac(NaN) dá erro, não devolve \"NaN\"", "numpcarac", [NaN], null);
erroEsperado("numpcarac(Infinito) dá erro, não devolve \"Infinity\"", "numpcarac", [Infinity], null);
caso("numpcarac e caracpnum são inversas para o mesmo valor", () => {
  for (const n of [7, 2.75, 0, -5, 1234.5]) {
    const t = chamar("numpcarac", n);
    const volta = chamar("caracpnum", t);
    if (volta !== n) return n + " -> " + JSON.stringify(t) + " -> " + volta;
  }
  return null;
});

// --- Maiusc e Minusc -----------------------------------------------------
txtIgual('maiusc("abc") = "ABC"', "maiusc", ["abc"], "ABC");
txtIgual('maiusc("aBc") = "ABC"', "maiusc", ["aBc"], "ABC");
txtIgual('maiusc("") = ""', "maiusc", [""], "");
txtIgual('maiusc("123abc") = "123ABC" (dígitos não mudam)', "maiusc", ["123abc"], "123ABC");
txtIgual('minusc("ABC") = "abc"', "minusc", ["ABC"], "abc");
txtIgual('minusc("AbC") = "abc"', "minusc", ["AbC"], "abc");
txtIgual('minusc("") = ""', "minusc", [""], "");
txtIgual('minusc("CURSO123") = "curso123"', "minusc", ["CURSO123"], "curso123");
caso("maiusc e minusc são coerentes entre si (idempotentes, não inversas)", () => {
  // Conversão de caixa NÃO é involução: maiusc("AbC") = "ABC" e
  // minusc("AbC") = "abc". O que tem que valer é que aplicar duas vezes
  // não muda nada, e que a sequência leva ao mesmo resultado final.
  for (const s of ["abc", "AbC", "cursoEmVideo", "123xyz"]) {
    const maiuscDuas = chamar("maiusc", chamar("maiusc", s));
    if (maiuscDuas !== chamar("maiusc", s)) {
      return "maiusc não é idempotente em " + JSON.stringify(s) + ": " + JSON.stringify(maiuscDuas);
    }
    const minuscDuas = chamar("minusc", chamar("minusc", s));
    if (minuscDuas !== chamar("minusc", s)) {
      return "minusc não é idempotente em " + JSON.stringify(s) + ": " + JSON.stringify(minuscDuas);
    }
    // Atravessar uma e voltar tem de dar o mesmo texto normalizado, e não
    // o original: maiusc -> minusc preserva as letras, não a caixa.
    if (chamar("minusc", chamar("maiusc", s)) !== chamar("minusc", s)) {
      return "minusc(maiusc(s)) != minusc(s) para " + JSON.stringify(s);
    }
  }
  return null;
});
caso("maiusc preserva o comprimento (indiceação de copia continua válida)", () => {
  const s = "abc def";
  const m = chamar("maiusc", s);
  if (m.length !== chamar("compr", s)) return "maiusc mudou o comprimento: " + m.length;
  if (m !== "ABC DEF") return "esperado \"ABC DEF\", veio " + JSON.stringify(m);
  return null;
});
erroEsperado("maiusc(5) com número dá erro", "maiusc", [5], null);
erroEsperado("minusc(5) com número dá erro", "minusc", [5], null);
erroEsperado("maiusc(VERDADEIRO) com lógico dá erro", "maiusc", [true], null);

// --- aridade -------------------------------------------------------------
erroEsperado("Asc() sem argumento dá erro de aridade", "asc", [], null);
erroEsperado("Asc(\"A\", \"B\") com argumento a mais dá erro", "asc", ["A", "B"], null);
erroEsperado("Carac() sem argumento dá erro de aridade", "carac", [], null);
erroEsperado("CaracPNum() sem argumento dá erro de aridade", "caracpnum", [], null);
erroEsperado("Compr() sem argumento dá erro de aridade", "compr", [], null);
erroEsperado("Copia(\"ABCDE\") sem ini e fim dá erro de aridade", "copia", ["ABCDE"], null);
erroEsperado("Copia(\"ABCDE\", 2) só com ini dá erro de aridade", "copia", ["ABCDE", 2], null);
erroEsperado("Copia(\"ABCDE\", 1, 2, 3) com argumento a mais dá erro", "copia", ["ABCDE", 1, 2, 3], null);
erroEsperado("Maiusc() sem argumento dá erro de aridade", "maiusc", [], null);
erroEsperado("Minusc() sem argumento dá erro de aridade", "minusc", [], null);
erroEsperado("NumpCarac() sem argumento dá erro de aridade", "numpcarac", [], null);
erroEsperado("Pos() sem argumento dá erro de aridade", "pos", [], null);
erroEsperado("Pos(\"AB\") só com um dá erro de aridade", "pos", ["AB"], null);
erroEsperado("Pos(\"A\", \"ABC\", \"B\") com argumento a mais dá erro", "pos", ["A", "ABC", "B"], null);
caso("mensagem de aridade diz quantos argumentos eram esperados", () => {
  const e = falha("compr");
  if (!e) return "não deu erro";
  if (!/Compr/.test(e.mensagem)) return "mensagem não cita Compr: " + e.mensagem;
  if (!/argumento/.test(e.mensagem)) return "mensagem não fala em argumento: " + e.mensagem;
  return null;
});

// --- tipos (uma por função) ----------------------------------------------
erroEsperado("Asc(VERDADEIRO) com lógico dá erro", "asc", [true], null);
erroEsperado("Carac(VERDADEIRO) com lógico dá erro", "carac", [true], null);
erroEsperado("Compr(5) com número dá erro, não coerção", "compr", [5], (e) =>
  /caractere/.test(e.mensagem) ? null : "mensagem não diz que veio inteiro: " + e.mensagem
);
erroEsperado("Copia(5, 1, 1) com número no texto dá erro", "copia", [5, 1, 1], null);
erroEsperado("Copia(\"ABCDE\", \"2\", 4) com ini textual dá erro", "copia", ["ABCDE", "2", 4], null);
erroEsperado("Copia(\"ABCDE\", 2, \"4\") com fim textual dá erro", "copia", ["ABCDE", 2, "4"], null);
erroEsperado("Maiusc(1.5) com real dá erro", "maiusc", [1.5], null);
erroEsperado("Minusc(VERDADEIRO) com lógico dá erro", "minusc", [true], null);
erroEsperado("NumpCarac(VERDADEIRO) com lógico dá erro", "numpcarac", [true], null);
caso("nenhuma das 9 aceita vetor onde espera escalar", () => {
  const vetor = new VG.Values.Vetor("v", 1, 3, "inteiro");
  vetor.definir(1, 10);
  const chamadas = [
    ["asc", [vetor]], ["carac", [vetor]], ["caracpnum", [vetor]], ["compr", [vetor]],
    ["copia", [vetor, 1, 2]], ["maiusc", [vetor]], ["minusc", [vetor]],
    ["numpcarac", [vetor]], ["pos", [vetor, "abc"]],
  ];
  for (const [nome, args] of chamadas) {
    if (falha(nome, ...args) === null) return nome + " aceitou vetor no lugar de escalar";
  }
  return null;
});

// --- posição do erro -----------------------------------------------------
caso("erro de tipo traz posição quando o runtime a fornece", () => {
  // O `Runtime.chamar` ainda não repassa `pos` ao builtin (é um 3º argumento
  // opcional), mas o caminho tem que existir: erro sem `pos` é erro sem linha.
  const e = (() => {
    try {
      registro.compr([5], null, { linha: 12, coluna: 3 });
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
  const e = falha("compr", 5);
  if (!e) return "não deu erro";
  if (e.linha !== null || e.sourceColumn !== null) return "inventou posição: " + e.linha + ":" + e.sourceColumn;
  return null;
});

// --- nada de proibições do projeto ---------------------------------------
caso("nenhum erro cru de JavaScript: tudo passa por Diagnostics (§46)", () => {
  // `ErroVisualG` é subclasse de `Error`, então `instanceof Error` não separa.
  // O que separa é a hierarquia: um `throw new Error(...)` apareceria aqui como
  // `codigo` ausente.
  const e = falha("asc", "");
  if (!e) return 'asc("") não deu erro';
  if (!(e instanceof VG.Diagnostics.ErroTipo)) return "tipo de erro inesperado: " + e.constructor.name;
  if (!e.codigo) return "erro sem código: " + e.mensagem;
  return null;
});
caso("nenhum builtin devolve NaN nem Infinity (nenhum NaN escapando, §30.4)", () => {
  const sondas = [
    ["asc", ["A"]], ["carac", [65]], ["caracpnum", ["2,75"]], ["compr", ["ABC"]],
    ["copia", ["ABCDE", 2, 4]], ["maiusc", ["abc"]], ["minusc", ["ABC"]],
    ["numpcarac", [2.75]], ["pos", ["BC", "ABCDE"]],
  ];
  for (const [nome, args] of sondas) {
    const v = chamar(nome, ...args);
    if (typeof v === "number" && !Number.isFinite(v)) {
      return nome + "(" + JSON.stringify(args) + ") devolveu " + v;
    }
  }
  return null;
});
caso("todas as 9 devolvem string ou número finito (nada de objeto no meio)", () => {
  const sondas = [
    ["asc", ["A"]], ["carac", [65]], ["caracpnum", ["2,75"]], ["compr", ["ABC"]],
    ["copia", ["ABCDE", 2, 4]], ["maiusc", ["abc"]], ["minusc", ["ABC"]],
    ["numpcarac", [2.75]], ["pos", ["BC", "ABCDE"]],
  ];
  for (const [nome, args] of sondas) {
    const v = chamar(nome, ...args);
    if (typeof v !== "string" && typeof v !== "number") {
      return nome + " devolveu " + typeof v + ": " + numero(v);
    }
  }
  return null;
});

console.log("-".repeat(66));
console.log("RESUMO: " + total + " testes | " + pass + " pass | " + fail + " fail");
if (fail > 0) process.exitCode = 1;
