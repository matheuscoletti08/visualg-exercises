// §29 — FUNÇÕES MATEMÁTICAS.
//
// Este módulo registra 21 funções: as 19 da enumeração da §29 (`Abs`, `ArcCos`,
// ... `Tan`) mais `Arred` e `ArredP`, que a enumeração não lista mas que
// `Environment.NOMES_RESERVADOS` reserva e a onda 8A pede. `nomes` traz as 21.
//
// A decisão que define este arquivo: as trigonométricas recebem GRAUS, não
// radianos. `sen(90)` é 1, e não 0.8939... (que é o que `Math.sin(90)` daria se
// a unidade estivesse errada). É o erro de porta do módulo, e por isso
// `grauprad`/`radpgrau` existem como função de usuário e não como detalhe
// interno a ser escondido.
//
// Requisitos de projeto (ver `backlog.md`): script clássico, sem `eval`, sem
// `new Function`, sem módulo ES, publicando em `W.VG`. Só depende de
// `VG.Diagnostics` e (opcionalmente) de `VG.Values` para a mensagem de tipo.
//
// Contrato de registro: chaves em MINÚSCULO, porque `Runtime.chamar` faz
// `this.registros[nome.toLowerCase()]` (`src/visualg/runtime.js:389`). Cada
// função é `(args, runtime, pos)`; `args` já vem avaliado do runtime.
//
// Códigos de erro: só existem `TIPO_ARGUMENTOS` (ErroTipo) e
// `RUNTIME_NAO_DECLARADA` (ErroRuntime) na hierarquia da §46 que fazem sentido
// aqui, e o primeiro é o que a §29 pede ("validar argumentos e gerar erros de
// domínio"). Todo erro de aridade, de tipo e de domínio deste arquivo sai como
// `TIPO_ARGUMENTOS` — inclusive `RaizQ(-1)`, que a §29.4 pede "tratamento
// explícito" e que por isso tem mensagem própria, não um `NaN` silencioso.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;
  // `Values` é opcional: o módulo precisa de `Diagnostics` para existir, mas usa
  // `Values.tipoDe` só para escrever "esperava número, veio caractere" em vez
  // de repetir a tabela de tipos aqui.
  const V = VG.Values;

  const RAD = Math.PI / 180;
  const GRAU = 180 / Math.PI;

  // ------------------------------------------------------------------ helpers

  function erro(mensagem, pos) {
    return Diagnostics.criar("TIPO_ARGUMENTOS", mensagem, pos || null);
  }

  function tipoDe(v) {
    return V && typeof V.tipoDe === "function" ? V.tipoDe(v) : typeof v;
  }

  function posDe(pos) {
    return pos || null;
  }

  /**
   * Aridade. `max` igual a `min` significa "exatamente"; diferente, intervalo.
   * A mensagem sai no formato do erro de subprograma do `runtime.js`, porque é
   * o mesmo usuário sendo avisado sobre a mesma coisa.
   */
  function aridade(nome, args, min, max, pos) {
    if (args.length >= min && args.length <= max) return;
    const esperado = min === max ? String(min) : min + " a " + max;
    throw erro(
      "'" + nome + "' espera " + esperado + " argumento(s), veio " + args.length,
      posDe(pos)
    );
  }

  /**
   * Argumento numérico finito. `NaN` e infinito são rejeitados aqui, na entrada:
   * é o que impede que `log(nan)` devolva `NaN` e o programa continue com uma
   * variável corrompida que só quebra três linhas depois.
   */
  function num(nome, v, indice, pos) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    throw erro(
      "'" + nome + "' espera número no argumento " + (indice + 1) + ", veio " + tipoDe(v),
      posDe(pos)
    );
  }

  /** Argumento inteiro (usado só por `randi`, que escolhe por índice). */
  function inteiro(nome, v, indice, pos) {
    const n = num(nome, v, indice, pos);
    if (!Number.isInteger(n)) {
      throw erro(
        "'" + nome + "' espera inteiro no argumento " + (indice + 1) + ", veio " + n,
        posDe(pos)
      );
    }
    return n;
  }

  /**
   * Resultado não finito = estouro de faixa. Virar `Infinity` silencioso é
   * pior que erro: `exp(1000)` contaminaria a variável e nenhum teste adiante
   * apontaria a origem.
   */
  function resultado(nome, r, pos) {
    if (typeof r === "number" && Number.isFinite(r)) return r;
    throw erro("'" + nome + "' produziu resultado fora da faixa numérica", posDe(pos));
  }

  /**
   * Normaliza graus em [0, 360). Reduzir antes de converter não é otimização,
   * é precisão: `sen(360)` dá 0 exato em vez de -2.4e-16, e um ângulo de
   * 1e15 graus não perde as casas baixas na conversão.
   */
  function reduzirGraus(graus) {
    const m = graus % 360;
    return m < 0 ? m + 360 : m;
  }

  /** Resto em [0, 180), para reconhecer ímpar de 90 sem dividir. */
  function resto180(graus) {
    const m = graus % 180;
    return m < 0 ? m + 180 : m;
  }

  /**
   * Mata o ruído binário antes de arredondar.
   *
   * `2.675 * 100` vale 267.49999999999997 em ponto flutuante, então um
   * arredondamento direto daria 2.67 — famouslyo bug. `toPrecision(15)`
   * recoloca o valor na escala decimal que ele representa de verdade.
   */
  function exatos(x) {
    return Number(x.toPrecision(15));
  }

  // ------------------------------------------------------------ arredondamento

  /**
   * Arredonda `x` para `casas` casas decimais, com desempate PARA LONGE DO
   * ZERO (2.5 → 3, -2.5 → -3). É a regra do `arred` do VisuAlg, e o oposto do
   * `arredp`.
   */
  function arredCasas(x, casas, pos) {
    const fator = Math.pow(10, casas);
    const y = exatos(x * fator);
    const base = Math.trunc(y);
    const fracao = y - base;
    let r;
    if (fracao >= 0.5) r = base + 1;
    else if (fracao <= -0.5) r = base - 1;
    else r = base;
    return resultado("arred", r / fator, pos);
  }

  /**
   * Arredonda `x` para o múltiplo de 10^expo mais próximo, também para longe
   * do zero: 1234 com expo 2 → 1200; 1250 com expo 2 → 1300.
   */
  function arredPotencia(x, expo, pos) {
    const passo = Math.pow(10, expo);
    const y = exatos(x / passo);
    const base = Math.trunc(y);
    const fracao = y - base;
    let r;
    if (fracao >= 0.5) r = base + 1;
    else if (fracao <= -0.5) r = base - 1;
    else r = base;
    return resultado("arred", r * passo, pos);
  }

  /**
   * Arredonda para o mais próximo com desempate PAR (arredondamento bancário,
   * round-half-to-even): 2.5 → 2, 3.5 → 4, -2.5 → -2.
   *
   * Não é `toFixed`: `toFixed` desempata para cima e o arredondamento bancário
   * é o que o `ArredP` do VisuAlg faz. É o `arredp` (arredonda "para o mais
   * próximo", contra o `arred`, que arredonda).
   */
  function arredP(x, casas, pos) {
    const fator = Math.pow(10, casas);
    const y = exatos(x * fator);
    const base = Math.floor(y);
    const fracao = y - base;
    let r;
    if (fracao > 0.5) r = base + 1;
    else if (fracao < 0.5) r = base;
    else r = base % 2 === 0 ? base : base + 1;
    return resultado("arredp", r / fator, pos);
  }

  // ------------------------------------------------------------ trigonometria

  /** Cosseno de um ângulo em GRAUS. Nunca erra: qualquer grau tem cosseno. */
  function coseno(graus) {
    return Math.cos(reduzirGraus(graus) * RAD);
  }

  /** Seno de um ângulo em GRAUS. */
  function seno(graus) {
    return Math.sin(reduzirGraus(graus) * RAD);
  }

  /**
   * Tangente de um ângulo em GRAUS.
   *
   * Só o ímpar múltiplo de 90 (90 + 180k) é erro: o cosseno é zero ali e o
   * resultado seria infinito. O par múltiplo de 180 (0, 180, -180) é valor
   * legítimo e vale 0 — `Tan(0)` = 0 é aritmética básica, não domínio vazio.
   */
  function tangente(nome, graus, pos) {
    if (resto180(graus) === 90) {
      throw erro(
        "'" + nome + "' não existe para " + graus + " graus (90 + 180k): o resultado seria infinito",
        posDe(pos)
      );
    }
    return Math.tan(reduzirGraus(graus) * RAD);
  }

  // ------------------------------------------------------------------ registro

  const REGISTRO = {
    // ------------------------------------------------------------ §29 Abs
    abs: (args, runtime, pos) => {
      aridade("Abs", args, 1, 1, pos);
      const x = num("Abs", args[0], 0, pos);
      // `Math.abs` já é identidade no sinal e preserva inteiro/real, então não
      // há coerceção a fazer aqui: `Abs(-5)` é inteiro 5, `Abs(-1.5)` é real.
      return Math.abs(x);
    },

    /**
     * Arred(x, casas)        → casas decimais, desempate para longe do zero.
     * Arred(x, casas, expo)  → múltiplo de 10^expo (o "com 3 argumentos" da
     *                          §29, que arredonda para potência de 10).
     * Arred(x, -2)           → 1200, mesma coisa que expo 2.
     *
     * As duas formas foram unificadas numa regra só: `casas` negativo é
     * `10^|casas|`, o que faz `arred(1234, -2)` = 1200 sem argumento extra, e
     * o terceiro argumento existe para quem prefere escrever o expo positivo.
     */
    arred: (args, runtime, pos) => {
      aridade("Arred", args, 2, 3, pos);
      const x = num("Arred", args[0], 0, pos);
      const casas = inteiro("Arred", args[1], 1, pos);
      if (args.length === 3) {
        const expo = inteiro("Arred", args[2], 2, pos);
        if (expo < 0) {
          throw erro(
            "'Arred' com 3 argumentos espera expoente >= 0, veio " + expo + " (use 'Arred(x, " + expo + ")' para casas negativas)",
            posDe(pos)
          );
        }
        return arredPotencia(x, expo, pos);
      }
      return casas < 0 ? arredPotencia(x, -casas, pos) : arredCasas(x, casas, pos);
    },

    /** ArredP: desempate par (round half to even), ver `arredP`. */
    arredp: (args, runtime, pos) => {
      aridade("ArredP", args, 2, 2, pos);
      const x = num("ArredP", args[0], 0, pos);
      return arredP(x, inteiro("ArredP", args[1], 1, pos), pos);
    },

    // ------------------------------------------------------- §29 inversas
    arccos: (args, runtime, pos) => {
      aridade("ArcCos", args, 1, 1, pos);
      const x = num("ArcCos", args[0], 0, pos);
      if (x < -1 || x > 1) {
        throw erro("'ArcCos' só existe para valores entre -1 e 1, veio " + x, posDe(pos));
      }
      return Math.acos(x) * GRAU;
    },

    arcsen: (args, runtime, pos) => {
      aridade("ArcSen", args, 1, 1, pos);
      const x = num("ArcSen", args[0], 0, pos);
      if (x < -1 || x > 1) {
        throw erro("'ArcSen' só existe para valores entre -1 e 1, veio " + x, posDe(pos));
      }
      return Math.asin(x) * GRAU;
    },

    arctan: (args, runtime, pos) => {
      aridade("ArcTan", args, 1, 1, pos);
      return Math.atan(num("ArcTan", args[0], 0, pos)) * GRAU;
    },

    // ------------------------------------------------------ §29 trigonometria
    cos: (args, runtime, pos) => {
      aridade("Cos", args, 1, 1, pos);
      return resultado("Cos", coseno(num("Cos", args[0], 0, pos)), pos);
    },

    /**
     * CoTan = 1/Tan. Múltiplo de 180 é erro nomeado, não `Infinity`: em VisuAlg
     * isso é divisão por zero mascarada, e o aluno precisa ver o motivo.
     */
    cotan: (args, runtime, pos) => {
      aridade("CoTan", args, 1, 1, pos);
      const g = num("CoTan", args[0], 0, pos);
      if (resto180(g) === 0) {
        throw erro(
          "'CoTan' não existe para " + g + " graus (múltiplo de 180): o resultado seria infinito",
          posDe(pos)
        );
      }
      return resultado("CoTan", 1 / Math.tan(reduzirGraus(g) * RAD), pos);
    },

    sen: (args, runtime, pos) => {
      aridade("Sen", args, 1, 1, pos);
      return resultado("Sen", seno(num("Sen", args[0], 0, pos)), pos);
    },

    tan: (args, runtime, pos) => {
      aridade("Tan", args, 1, 1, pos);
      return resultado("Tan", tangente("Tan", num("Tan", args[0], 0, pos), pos), pos);
    },

    // ------------------------------------------------------------ exponenciais
    exp: (args, runtime, pos) => {
      aridade("Exp", args, 1, 1, pos);
      return resultado("Exp", Math.exp(num("Exp", args[0], 0, pos)), pos);
    },

    log: (args, runtime, pos) => {
      aridade("Log", args, 1, 1, pos);
      const x = num("Log", args[0], 0, pos);
      if (x <= 0) {
        throw erro("'Log' só existe para x > 0, veio " + x, posDe(pos));
      }
      return resultado("Log", Math.log10(x), pos);
    },

    logn: (args, runtime, pos) => {
      aridade("LogN", args, 2, 2, pos);
      const x = num("LogN", args[0], 0, pos);
      const base = num("LogN", args[1], 1, pos);
      if (x <= 0) {
        throw erro("'LogN' só existe para x > 0, veio " + x, posDe(pos));
      }
      if (base <= 0) {
        throw erro("'LogN' só existe para base > 0, veio " + base, posDe(pos));
      }
      if (base === 1) {
        throw erro("'LogN' não aceita base 1: não há solução", posDe(pos));
      }
      return resultado("LogN", Math.log(x) / Math.log(base), pos);
    },

    // ------------------------------------------------------------- conversão
    grauprad: (args, runtime, pos) => {
      aridade("GraupRad", args, 1, 1, pos);
      return resultado("GraupRad", num("GraupRad", args[0], 0, pos) * RAD, pos);
    },

    radpgrau: (args, runtime, pos) => {
      aridade("RadpGrau", args, 1, 1, pos);
      return resultado("RadpGrau", num("RadpGrau", args[0], 0, pos) * GRAU, pos);
    },

    // -------------------------------------------------------------- numéricos
    int: (args, runtime, pos) => {
      aridade("Int", args, 1, 1, pos);
      // Trunca em zero, NÃO arredonda e NÃO faz floor: -2.7 → -2. `floor(-2.7)`
      // daria -3, que é a leitura de inteiro que o VisuAlg não faz.
      return Math.trunc(num("Int", args[0], 0, pos));
    },

    quad: (args, runtime, pos) => {
      aridade("Quad", args, 1, 1, pos);
      const x = num("Quad", args[0], 0, pos);
      return resultado("Quad", x * x, pos);
    },

    /**
     * RaizQ: a §29.4 pede "tratamento explícito" para `RaizQ(-1)`. É o único
     * ponto do arquivo onde `Math.sqrt` devolveria `NaN` sem ninguém perceber,
     * e o tratamento é erro nomeado com o valor na mensagem, para o aluno
     * ver que o problema é o argumento e não a função.
     */
    raizq: (args, runtime, pos) => {
      aridade("RaizQ", args, 1, 1, pos);
      const x = num("RaizQ", args[0], 0, pos);
      if (x < 0) {
        throw erro("'RaizQ' não existe para " + x + ": raiz quadrada de negativo não é real", posDe(pos));
      }
      return resultado("RaizQ", Math.sqrt(x), pos);
    },

    // ---------------------------------------------------------------- aleatório
    /** Pi: sem argumento, por isso a aridade é 0 e não 1. */
    pi: (args, runtime, pos) => {
      aridade("Pi", args, 0, 0, pos);
      return Math.PI;
    },

    rand: (args, runtime, pos) => {
      aridade("Rand", args, 0, 0, pos);
      // [0, 1): o VisuAlg nunca devolve 1, e `Math.random` também não.
      return Math.random();
    },

    /** RandI: inteiro de 1 a n inclusive. `n < 1` é erro, não conjunto vazio. */
    randi: (args, runtime, pos) => {
      aridade("RandI", args, 1, 1, pos);
      const n = inteiro("RandI", args[0], 0, pos);
      if (n < 1) {
        throw erro("'RandI' espera limite >= 1, veio " + n, posDe(pos));
      }
      return 1 + Math.floor(Math.random() * n);
    },
  };

  /**
   * Nomes para autocomplete e para a UI.
   *
   * Os 19 da §29, na grafia e na ordem do spec. `Arred` e `ArredP` vêm DEPOIS
   * porque a enumeração da §29 não os lista, mas `Environment.NOMES_RESERVADOS`
   * reserva os dois e a onda 8A os implementa: sem eles aqui, o autocomplete
   * esconderia duas funções que o usuário não pode nem declarar com outro
   * nome. `nomes` e `registro` são uma bijeção de propósito, para a UI poder
   * mostrar tudo que está registrado.
   */
  const NOMES = [
    "Abs", "ArcCos", "ArcSen", "ArcTan", "Cos", "CoTan", "Exp", "GraupRad", "Int",
    "Log", "LogN", "Pi", "Quad", "RadpGrau", "RaizQ", "Rand", "RandI", "Sen", "Tan",
    "Arred", "ArredP",
  ];

  VG.StdlibMath = { registro: REGISTRO, nomes: NOMES };
})(W.VG);
