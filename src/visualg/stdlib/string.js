// §30 — FUNÇÕES DE STRING.
//
// Este módulo registra as 9 funções da §30: `Asc`, `Carac`, `CaracPNum`,
// `Compr`, `Copia`, `Maiusc`, `Minusc`, `NumpCarac` e `Pos`.
//
// Requisitos de projeto (ver `backlog.md`): script clássico, sem `eval`, sem
// `new Function`, sem módulo ES, publicando em `W.VG`. Só depende de
// `VG.Diagnostics` e (opcionalmente) de `VG.Values` para a mensagem de tipo.
//
// Contrato de registro: chaves em MINÚSCULO, porque `Runtime.chamar` faz
// `this.registros[nome.toLowerCase()]` (`src/visualg/runtime.js:386-393`). Cada
// builtin é `(args, runtime, pos)`; `args` já vem avaliado. Note que o runtime
// hoje chama `builtin(args, this)` SEM o terceiro argumento, então `pos` chega
// `undefined` no caminho normal — é por isso que todo erro daqui passa por
// `posDe()`, que normaliza para `null` em vez de confiar em `pos.linha`.
//
// Códigos de erro: `TIPO_ARGUMENTOS` (ErroTipo) para aridade, tipo e domínio.
// Não há `Error` cru neste arquivo, nem `NaN`/`""` silencioso.
//
// ============================================================================
// AS DUAS DECISÕES DE PORTA DESTE ARQUIVO — ler antes de mexer
// ============================================================================
//
// (1) INDEXAÇÃO 1-BASED E INCLUSIVA, e `slice()` do JavaScript NÃO pode ser
//     usado direto. `slice(i, f)` é 0-based e EXCLUSIVO no fim; o VisuAlg
//     conta a partir de 1 e INCLUI o extremo final. `copia("ABCDE", 2, 4)`
//     tem de dar "BCD": a substring 0-based equivalente é `slice(1, 4)`, e
//     essa coincidência (o `+1` do começo e o `-1` do fim se cancelando) é
//     exatamente o tipo de acidente que passa em teste e quebra em produção.
//     Por isso a conversão fica isolada em `copia()` e é testada com os
//     extremos: 1, o meio, e além do comprimento.
//
//     DIVERGÊNCIA DOCUMENTADA: o `Copia` do VisuAlg original é
//     `Copia(<texto>, <início>, <quantidade>)` — o terceiro argumento é a
//     CONTAGEM de caracteres, não o fim. `Copia("ABCDE", 2, 4)` é "BCD" nas
//     duas leituras (3 caracteres a partir do 2º), e é por isso que os testes
//     desta onda não desempatam entre as duas. O que está implementado aqui é
//     a leitura INCLUSIVA de FIM, que é a que a onda 8B especifica
//     textualmente. As duas divergem em `copia("ABCDE", 2, 2)`: fim inclusivo
//     dá "B", quantidade dá "BC". Se a compatibilidade com o executável
//     original virar prioridade,
//     o ponto de troca é UMA linha: `fim` deixa de ser `fim` e vira
//     `ini - 1 + quantidade`.
//
// (2) A ORDEM DOS ARGUMENTOS DE `Pos` é `Pos(<o que se procura>, <onde se
//     procura>)`. Ou seja, o PRIMEIRO argumento é o alvo e o SEGUNDO é o
//     texto onde a busca acontece. `pos("BC", "ABCDE")` = 2.
//
//     A evidência é a ordem de escrita da linguagem: o VisuAlg escreve
//     `Pos("Video", N)` com N = "cursoEmVideo" e responde 8 — o literal vem
//     primeiro, a variável com o texto vem depois. Isto é o OPOSTO do
//     `Copy(s, ini, fim)` do Pascal, onde a string base é o primeiro
//     argumento, e por isso é a coisa mais fácil de inverter sem que nenhum
//     teste pequeno notice. Como o nome da variável é ambíguo por nature-
//     za (`pos(a, b)` não diz qual é o texto), a ordem fica fixada aqui e
//     coberta por teste: `pos("BC", "ABCDE")` = 2 e, na mesma bateria,
//     `pos("ABCDE", "BC")` = 0 — a leitura invertida daria 3 e 0, então os
//     dois casos juntos rejeitam as duas direções possíveis do erro.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const Diagnostics = VG.Diagnostics;
  // `Values` é opcional: o módulo precisa de `Diagnostics` para existir, mas usa
  // `Values.tipoDe` só para escrever "esperava caractere, veio inteiro" em vez
  // de repetir a tabela de tipos daqui.
  const V = VG.Values;

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
   * Argumento de texto. Não há coerção: `compr(5)` é erro, não 1. O VisuAlg
   * também não converte silenciosamente, e converter aqui esconderia do aluno
   * que ele passou um número onde cabia uma palavra.
   */
  function texto(nome, v, indice, pos) {
    if (typeof v === "string") return v;
    throw erro(
      "'" + nome + "' espera caractere no argumento " + (indice + 1) + ", veio " + tipoDe(v),
      posDe(pos)
    );
  }

  /** Argumento numérico finito. `NaN` e infinito são rejeitados na entrada. */
  function num(nome, v, indice, pos) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    throw erro(
      "'" + nome + "' espera número no argumento " + (indice + 1) + ", veio " + tipoDe(v),
      posDe(pos)
    );
  }

  /**
   * Argumento inteiro, exigido por toda função que trabalha com índice
   * (`Copia`, `Carac`). `2.0` passa (é inteiro em valor), `2.5` não.
   */
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
   * Texto que representa um número, na sintaxe brasileira.
   *
   * Só a PRIMEIRA vírgula vira ponto, e o resultado tem de casar
   * `/^-?\d+(\.\d+)?$/` inteiro. A regex é o filtro de verdade: `Number("2,75")`
   * devolveria `NaN` e `parseFloat("12abc")` devolveria 12 — os dois aceitariam
   * lixo. Como não pode haver `NaN` escaping (o §30 pede validação), o teste é
   * estrutural e não numérico.
   */
  const RE_NUMERO = /^-?\d+(\.\d+)?$/;

  function paraNumero(s) {
    return s.trim().replace(",", ".");
  }

  // ------------------------------------------------------------------ registro

  const REGISTRO = {
    /**
     * Asc: código do PRIMEIRO caractere (comportamento tradicional).
     *
     * Aceita caractere de tamanho 1 ou texto maior — em ambos os casos o que
     * interessa é o primeiro. String vazia é erro nomeado, e não 0: `Asc("")`
     * não tem primeiro caractere, e devolver 0 faria o aluno comparar com um
     * NUL sem nunca ouvir que o texto estava vazio.
     */
    asc: (args, runtime, pos) => {
      aridade("Asc", args, 1, 1, pos);
      const s = texto("Asc", args[0], 0, pos);
      if (s.length === 0) {
        throw erro("'Asc' não existe para texto vazio: não há primeiro caractere", posDe(pos));
      }
      return s.charCodeAt(0);
    },

    /**
     * Carac: caractere correspondente ao código.
     *
     * `n` tem de ser inteiro (código 67.5 não é código de tecla) e cair na
     * faixa Unicode. O limite superior é 0x10FFFF e não 255 de propósito: o
     * VisuAlg é ASCII, mas `Char`/`Chr` de outras origens e o `Carac` de
     *Portable Pascal aceitam a faixa toda, e estreitar para 255 rejeitaria
     * entrada legítima por um limite que a linguagem não impõe.
     */
    carac: (args, runtime, pos) => {
      aridade("Carac", args, 1, 1, pos);
      const n = inteiro("Carac", args[0], 0, pos);
      if (n < 0 || n > 0x10ffff) {
        throw erro("'Carac' só existe para código entre 0 e 1114111, veio " + n, posDe(pos));
      }
      return String.fromCharCode(n);
    },

    /**
     * CaracPNum: texto → número, com vírgula decimal (padrão brasileiro).
     *
     * `CaracPNum("2,75")` = 2.75 e `CaracPNum(" 7 ")` = 7 (espaço tolerado,
     * porque é o que sobra depois de um `leia` mal usado). Texto que não é
     * número é erro nomeado com o valor na mensagem, nunca `NaN`: um `NaN`
     * aqui contamina a variável e explode três linhas depois, com mensagem
     * sobre outra coisa.
     */
    caracpnum: (args, runtime, pos) => {
      aridade("CaracPNum", args, 1, 1, pos);
      const s = texto("CaracPNum", args[0], 0, pos);
      const normal = paraNumero(s);
      if (!RE_NUMERO.test(normal)) {
        throw erro(
          "'CaracPNum' espera número em '" + s + "' (aceita vírgula decimal), veio texto não numérico",
          posDe(pos)
        );
      }
      return Number(normal);
    },

    /**
     * Compr: comprimento do texto.
     *
     * É `.length`, e a confusão que a §30.3 pede para evitar é achar que há
     * um `+1` por causa da indexação 1-based. Não há: a indexação 1-based diz
     * que o PRIMEIRO caractere é o de índice 1, o que não muda a CONTAGEM.
     * `Compr("")` = 0 e `Compr("ABC")` = 3.
     */
    compr: (args, runtime, pos) => {
      aridade("Compr", args, 1, 1, pos);
      return texto("Compr", args[0], 0, pos).length;
    },

    /**
     * Copia: trecho do texto, 1-based e INCLUSIVO nos dois extremos.
     *
     *     copia("ABCDE", 2, 4) = "BCD"     (do 2º ao 4º, os dois inclusos)
     *     copia("ABCDE", 1, 1) = "A"       (um caractere só)
     *     copia("ABCDE", 1, 99) = "ABCDE"  (fim além do comprimento: até o fim)
     *     copia("ABCDE", 9, 10) = ""       (início além do comprimento: vazio)
     *     copia("ABCDE", 0, 2) = "AB"      (início abaixo de 1 é tratado como 1)
     *     copia("ABCDE", 4, 2) = ""        (faixa invertida: vazio, não erro)
     *
     * A conversão 1-based → 0-based é `slice(ini - 1, fim)`: o começo
     * desconta 1 porque `slice` começa em 0, e o fim NÃO desconta nada porque
     * o fim do VisuAlg é a posição do ÚLTIMO caractere e o de `slice` é a
     * posição DEPOIS dele — os dois "menos um" se cancelam, e é exatamente aí
     * que um `slice(ini, fim + 1)` ingênuo passaria em `copia("ABCDE", 2, 4)`
     * por acaso e quebraria em `copia("ABCDE", 1, 99)`.
     */
    copia: (args, runtime, pos) => {
      aridade("Copia", args, 3, 3, pos);
      const s = texto("Copia", args[0], 0, pos);
      const ini = inteiro("Copia", args[1], 1, pos);
      const fim = inteiro("Copia", args[2], 2, pos);

      // Início abaixo de 1 é tratado como 1, não erro: a §30 fala em
      // indexação do VisuAlg, e o executável original satura em 1.
      const comeco = ini < 1 ? 1 : ini;
      // Faixa invertida é conjunto vazio. Não é erro porque `Copia` não tem
      // domínio para proibir: ela promete um TRECHO, e não existe trecho de
      // 4 a 2.
      if (comeco > fim) return "";
      // `slice` já satura o fim no comprimento da string, e devolve "" quando
      // o começo passa dele. Saturar aqui tornaria o clamp explícito e o
      // comportamento independente de como `slice` trata o excesso.
      if (comeco > s.length) return "";
      return s.slice(comeco - 1, Math.min(fim, s.length));
    },

    /** Maiusc: caixa alta. */
    maiusc: (args, runtime, pos) => {
      aridade("Maiusc", args, 1, 1, pos);
      return texto("Maiusc", args[0], 0, pos).toUpperCase();
    },

    /** Minusc: caixa baixa. */
    minusc: (args, runtime, pos) => {
      aridade("Minusc", args, 1, 1, pos);
      return texto("Minusc", args[0], 0, pos).toLowerCase();
    },

    /**
     * NumpCarac: número → texto.
     *
     * Inteiro sai sem casas decimais (`7` → "7", não "7,00") e real sai na
     * representação normal (`2.75` → "2.75"). `String` já faz as duas coisas,
     * então não há `toFixed` aqui: `toFixed(0)` arredondaria e perderia a
     * parte fracionária, e `toFixed(2)` inventaria casas que o número não tem.
     *
     * NOTA: o ponto é o separador decimal, e não a vírgula do `CaracPNum`.
     * É assimétrico por escolha: `String` é a representação canônica e
     * estável de um número, e trocar a vírgula aqui obrigaria toda a
     * formatação de saída a desfazer a troca. Se a §15 um dia exigir vírgula na
     * escrita de real, o
     * lugar certo de trocar é a apresentação, não aqui.
     */
    numpcarac: (args, runtime, pos) => {
      aridade("NumpCarac", args, 1, 1, pos);
      return String(num("NumpCarac", args[0], 0, pos));
    },

    /**
     * Pos: posição 1-based da PRIMEIRA ocorrência, ou 0 se não achar.
     *
     *     pos("BC", "ABCDE") = 2
     *     pos("ZZ", "ABCDE") = 0
     *     pos("A", "AAA")    = 1     (a primeira, não a última)
     *
     * ORDEM DOS ARGUMENTOS: `Pos(<o que se procura>, <onde se procura>)` —
     * ver a nota (2) no topo do arquivo. `indexOf` é 0-based e devolve -1
     * quando não acha, então a conversão é `i + 1` e `-1 → 0`, que é
     * exatamente a segunda opção: 0 é o "não achou" do VisuAlg, e o mesmo
     * valor de `indexOf` viraria -1 se passasse direto.
     *
     * SENSÍVEL A CAIXA, apesar da §11 mandar comparação de texto sem caixa.
     * A evidência está no uso canônico do VisuAlg, que antes de chamar `Pos`
     * aplica `Minusc` nos DOIS argumentos
     * (`Pos(Minusc(P), Minusc(N))`): se a busca já fosse insensível, essa
     * dupla normalização não teria raison d'être. Busca textual responde a
     * "onde está", e "onde está 'video'" não é a mesma pergunta que "onde
     * está a palavra Video que o usuário digitou".
     */
    pos: (args, runtime, pos) => {
      aridade("Pos", args, 2, 2, pos);
      const alvo = texto("Pos", args[0], 0, pos);
      const s = texto("Pos", args[1], 1, pos);
      // `indexOf` devolve 0 para o alvo vazio, que é a posição 1 no
      // VisuAlg 1-based — o mesmo que Pascal e Delphi fazem. Não é
      // normalizado para 0 porque "texto vazio está no início" é a leitura
      // padrão dessas três linguagens.
      return s.indexOf(alvo) + 1;
    },
  };

  /**
   * Nomes para autocomplete e para a UI: os 9 da §30, na grafia e na ordem do
   * spec. `nomes` e `registro` são uma bijeção de propósito, para a UI poder
   * mostrar tudo que está registrado.
   *
   * A grafia importa: o runtime normaliza o nome com `toLowerCase()`, então
   * `CaracPNum` e `NumpCarac` chegam como `caracpnum` e `numpcarac` — as
   * chaves minúsculas acima. Nenhum `Copia` e nenhum `Asc` entraram na lista,
   * que é a da §30, e não a de `Environment.NOMES_RESERVADOS` (que ainda
   * traz os nomes legados `caracp`, `caract` e `todos`, e não pode ser
   * corrigido nesta onda).
   */
  const NOMES = [
    "Asc", "Carac", "CaracPNum", "Compr", "Copia", "Maiusc", "Minusc", "NumpCarac", "Pos",
  ];

  VG.StdlibString = { registro: REGISTRO, nomes: NOMES };
})(W.VG);
