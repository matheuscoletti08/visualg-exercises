// §51 — REALCE DE SINTAXE DO PLAYGROUND, de 5 para 10 categorias.
//
// O `script.js` realça hoje com um scanner próprio de ~120 linhas e cinco
// classes: `tk`, `tk-num`, `tk-op`, `tk-str`, `tk-com`. Duas coisas motivam
// este arquivo:
//
//   1. O scanner do `script.js` tem uma lista de palavras-chave COPIADA
//      (`LISTA_CHAVES` em `script.js:15`) e está desatualizada em relação a
//      `Vg.Tokens.PALAVRAS`: não conhece `escolha`, `função`, `procedimento`,
//      `retorne`, `interrompa`, `aleatorio`... A §51 pede 11 distinções
//      (keywords, tipos, funções, números, strings, operadores, comentários,
//      booleanos, identificadores, nomes de funções/procedimentos,
//      constantes) e a lista divergente garante que metade nunca apareça.
//   2. Regex sobre texto é o caminho que o `task.md` proíbe na raiz ("NÃO
//      implemente isso usando ... uma sequência de regexes frágeis"). Aqui a
//      tokenização é a do `Vg.Lexer`, a mesma que executa o programa: o que o
//      editor pinta e o que o runtime lê não podem divergir.
//
// AS DEZ CATEGORIAS. A §51 lista onze distinções e o backlog fixa o alvo em
// dez. O ajuste é explícito e não é um corte arbitrário:
//
//   - "booleanos" e "constantes" viram UMA categoria, `tk-const`. O VisualAlg
//     não tem declaração `const`: os únicos valores nomeados da linguagem são
//     `verdadeiro` e `falso`, e uma categoria separada que nunca receberia
//     nada seria uma classe morta no CSS.
//   - as outras nove são uma para uma.
//
//   CATEGORIA         CLASSE     O QUE É
//   palavra-chave     tk-kw      se, enquanto, repita, algoritmo, fimalgoritmo...
//   tipo              tk-tipo    inteiro, real, caractere, lógico, vetor, matriz
//   constante         tk-const   verdadeiro, falso
//   funcao            tk-fn      builtins de §29/§30 (Sen, RaizQ, Maiusc...)
//   subprograma       tk-sub     função/procedimento DECLARADO no próprio código
//   numero            tk-num     1, 3.14
//   texto             tk-str     "cadeia"
//   operador          tk-op      + - * / <- := .. ( ) [ ] , : ; e <> etc.
//   comentario        tk-com     // até o fim da linha
//   identificador     tk-id      variável, parâmetro, qualquer nome
//
// `funcao` e `subprograma` são categorias separadas de propósito: `Sen(90)` é
// stdlib e está em `Vg.builtins`, `dobro(x)` é do aluno. O aluno precisa
// distinguir "isso aqui eu escrevi" de "isso aqui o VisualG me emprestou".
//
// SEGURANÇA. Este é o ponto de maior risco da onda: o realce injeta HTML, e o
// texto injetado é o que o aluno digitou. Um `escreva("<img src=x onerror=…>")`
// executaria no `innerHTML` de um `escape` faltando, e o playground roda
// `file://` — sem Content-Security-Policy, sem sandbox de origem. Por isso
// `escapar()` é a ÚNICA forma de texto entrar no HTML, ela é aplicada a TODO
// token (inclusive os que não viram `<span>`) e ela cobre `&`, `<`, `>` e `"`.
// `escapar` é exportada para o teste da §51 provarem isso em vez de acreditar.
//
// O lexer descarta comentário, então o realce reconstrói o texto: caminha pelos
// tokens com linha/coluna e o que sobrar entre um token e o seguinte é, por
// construção do lexer, espaço em branco ou comentário. A reconstrução é o que
// permite ESCAPAR o original em vez de reconstruir caractere a caractere — é o
// que faz `<b>` dentro de uma string virar texto e não marcação.
//
// Sem DOM: `realcar()` devolve STRING. Nenhum elemento é criado, nenhum
// `innerHTML` é tocado aqui; quem chama injeta. Nenhum `eval`, nenhuma rede,
// nenhum storage.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  // As dez categorias, na ordem em que a UI costuma exibi-las. A ordem é
  // estável porque o teste da §51 compara com `join(",")`.
  const CATEGORIAS = [
    "palavra-chave",
    "tipo",
    "constante",
    "funcao",
    "subprograma",
    "numero",
    "texto",
    "operador",
    "comentario",
    "identificador",
  ];

  /**
   * Categoria → classe CSS. O prefixo `tk-` é o mesmo do `script.js` atual, e
   * as cinco classes antigas continuam válidas (`tk`, `tk-num`, `tk-op`,
   * `tk-str`, `tk-com`): quem integra pode manter o CSS e acrescentar as cinco
   * novas, em vez de reescrever o tema.
   */
  const CLASSES = {
    "palavra-chave": "tk-kw",
    "tipo": "tk-tipo",
    "constante": "tk-const",
    "funcao": "tk-fn",
    "subprograma": "tk-sub",
    "numero": "tk-num",
    "texto": "tk-str",
    "operador": "tk-op",
    "comentario": "tk-com",
    "identificador": "tk-id",
  };

  /** Classe CSS → categoria, para a UI e para o teste contarem ao contrário. */
  const CATEGORIAS_POR_CLASSE = {};
  for (const c of CATEGORIAS) CATEGORIAS_POR_CLASSE[CLASSES[c]] = c;

  /** Tabela de TIPOS de token (`Vg.Tokens.T`), lida por chamada: a ordem de carga é contrato. */
  function tipos() {
    return (W.Vg && W.Vg.Tokens && W.Vg.Tokens.T) || {};
  }

  /**
   * Escapa HTML. SEMPRE, em TODO token, mesmo nos que não viram `<span>`.
   *
   * A ordem importa: `&` primeiro, senão o `&` de `&lt;` seria escapado de novo
   * e o leitor veria `&amp;lt;` no lugar de `<`. `"` entra também porque o
   * realce pode ser colocado em atributo por um consumidor futuro, e o custo é
   * zero — o texto é o mesmo para o olho.
   */
  function escapar(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Tabela de posição inicial de cada linha, para converter (linha, coluna) → índice. */
  function inicioDeCadaLinha(codigo) {
    const inicios = [0];
    for (let i = 0; i < codigo.length; i++) {
      if (codigo.charAt(i) === "\n") inicios.push(i + 1);
    }
    return inicios;
  }

  /**
   * Nomes dos subprogramas declarados no próprio programa, em chave sem
   * acento. É o que separa `tk-sub` de `tk-fn`.
   *
   * O §51 exige que o realce funcione "independentemente da execução", e isso
   * inclui independentemente de o programa COMPILAR: o aluno digita `função` e
   * ainda não escreveu o corpo. Por isso a falha de `analisar` aqui é absorvida
   * e devolve lista vazia — o realce continua, só perde a categoria `subprograma`
   * até o programa fechar o parêntese.
   */
  function subprogramasDe(codigo) {
    const chaves = new Set();
    const Vg = W.Vg;
    if (!Vg || typeof Vg.analisar !== "function" || !Vg.Tokens) return chaves;
    try {
      const programa = Vg.analisar(codigo);
      for (const s of (programa && programa.subprogramas) || []) {
        if (s && s.nome) chaves.add(Vg.Tokens.chaveDe(s.nome));
      }
    } catch (e) {
      // De propósito: realce não é validação. O texto segue sendo pintada.
    }
    return chaves;
  }

  /**
   * Categoria de um token.
   *
   * A ordem das decisões é a ordem da §51: tipo antes de palavra-chave (porque
   * `inteiro` É palavra-chave, e a UI precisa de uma cor só) e constante antes
   * de palavra-chave pelo mesmo motivo. `funcao` e `subprograma` reclassificam
   * um `identificador`: o lexer sozinho não sabe se `dobro` é função do aluno ou
   * builtin da stdlib, e a diferença está no programa inteiro, não no token.
   */
  function categorizar(t, T, subprogramas) {
    switch (t.tipo) {
      case tipos().PALAVRA_CHAVE:
        if (T.ehTipo(t.valor)) return "tipo";
        if (t.valor === "verdadeiro" || t.valor === "falso") return "constante";
        return "palavra-chave";
      case tipos().NUMERO:
        return "numero";
      case tipos().TEXTO:
        return "texto";
      case tipos().IDENTIFICADOR: {
        const chave = T.chaveDe(t.valor);
        if (subprogramas.has(chave)) return "subprograma";
        if (ehBuiltin(chave)) return "funcao";
        return "identificador";
      }
      case tipos().OPERADOR:
      case tipos().VIRGULA:
      case tipos().PONTO_E_VIRGULA:
      case tipos().DOIS_PONTOS:
      case tipos().ATRIBUICAO:
        return "operador";
      case tipos().BREAKPOINT:
        return "comentario";
      default:
        return "identificador";
    }
  }

  /**
   * Nomes de builtin registrados, em chave sem acento, montados a partir de
   * `Vg.builtins` — que é lista de listas de nomes (um grupo por módulo de
   * stdlib), o mesmo formato que `math.js` e `string.js` publicam.
   *
   * O conjunto é refeito no início de cada `segmentar` em vez de ser fixo no
   * carregamento do módulo: são quarenta nomes, e um cache que dependesse de
   * "a stdlib já estava lá quando este arquivo rodou" erraria em qualquer
   * página que carregasse o editor antes do engine.
   */
  let builtins = new Set();
  function ehBuiltin(chave) {
    return builtins.has(chave);
  }

  function carregarBuiltins() {
    const lista = new Set();
    const Vg = W.Vg;
    if (Vg && Vg.Tokens) {
      for (const grupo of Vg.builtins || []) {
        for (const nome of grupo || []) lista.add(Vg.Tokens.chaveDe(nome));
      }
    }
    builtins = lista;
    return lista;
  }

  /**
   * Segmentos de realce do texto: array de
   * `{ texto, categoria, classe, linha, coluna }` com categoria `null` para o
   * espaço em branco, que sai sem `<span>`.
   *
   * Um span por token é o que mantém a paridade `<textarea>`/`<pre>` do editor
   * de overlay: a mesma quantidade de nós dos dois lados, sem `<span>` em branco
   * para alinhar. Comentário é o único segmento que não corresponde a um token
   * (o lexer o descarta), e por isso a contagem de spans de um trecho com
   * comentário é `tokens + comentários` — o teste da §51 usa um trecho sem
   * comentário justamente para poder comparar com o número de tokens.
   */
  function segmentar(codigo) {
    const texto = typeof codigo === "string" ? codigo : "";
    const Vg = W.Vg;
    const T = Vg && Vg.Tokens ? Vg.Tokens : null;
    if (!T || !Vg || typeof Vg.Lexer !== "function") {
      return { segmentos: [{ texto: texto, categoria: null, linha: 1, coluna: 1 }], erro: null };
    }

    carregarBuiltins();
    const subprogramas = subprogramasDe(texto);
    const inicios = inicioDeCadaLinha(texto);

    let tokens;
    try {
      tokens = new Vg.Lexer(texto).tokenizar();
    } catch (e) {
      // Erro léxico não impede o editor de existir: devolve o texto cru, que a
      // UI mostra sem cor até a próxima tecla. É o comportamento de um editor
      // de verdade, e evita que um `"` não fechado apague o realce inteiro.
      return {
        segmentos: [{ texto: texto, categoria: null, linha: 1, coluna: 1 }],
        erro: e,
      };
    }

    const segmentos = [];
    let pos = 0;
    const empurrar = (trecho, categoria, linha, coluna) => {
      if (trecho === "") return;
      segmentos.push({ texto: trecho, categoria: categoria, linha: linha, coluna: coluna });
    };
    const linhaDe = (offset) => {
      let lo = 0;
      let hi = inicios.length - 1;
      while (lo < hi) {
        const meio = Math.ceil((lo + hi) / 2);
        if (inicios[meio] <= offset) lo = meio;
        else hi = meio - 1;
      }
      return lo + 1;
    };

    /**
     * Emite o que sobrou entre dois tokens.
     *
     * Por construção do lexer, esse vao é espaço em branco ou comentário — o
     * lexer não emite token para nenhum dos dois. O comentário é separado do
     * espaço que o cerca, e não emitido junto, por duas razões: o `<span>` de
     * comentário fica com o texto EXATO que o aluno escreveu (nada de `\n`
     * pendurado dentro da tag, que quebra a paridade de nós do overlay do
     * editor), e o teste da §51 consegue comparar o texto do segmento com o
     * texto da linha do código-fonte.
     *
     * O corte no fim da linha é `indexOf("\n")`, não regex: é a mesma regra que
     * o `lexer.js` usa (`avanca(1)` até o `\n`).
     */
    const vao = (de, ate) => {
      if (ate <= de) return;
      const bruto = texto.slice(de, ate);
      const linha = linhaDe(de);
      const coluna = de - inicios[linha - 1] + 1;
      const marca = bruto.indexOf("//");
      if (marca < 0) {
        empurrar(bruto, null, linha, coluna);
        return;
      }
      empurrar(bruto.slice(0, marca), null, linha, coluna);
      const resto = bruto.slice(marca);
      const fimDaLinha = resto.indexOf("\n");
      const comentario = fimDaLinha < 0 ? resto : resto.slice(0, fimDaLinha);
      const depois = fimDaLinha < 0 ? "" : resto.slice(fimDaLinha);
      empurrar(comentario, "comentario", linha, coluna + marca);
      empurrar(depois, null, linha + (fimDaLinha < 0 ? 0 : 1), 1);
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.tipo === tipos().FIM) break;
      const inicio = inicios[t.linha - 1] + t.coluna - 1;
      const comprimento = t.comprimento == null ? String(t.valor).length : t.comprimento;

      // O texto do segmento é sempre a FATIA DO ORIGINAL, nunca remontada a
      // partir do valor do token: é o que garante que `1.50` continue `1.50` e
      // que as aspas da literal continuem sendo as que o aluno escreveu.
      vao(pos, inicio);
      const categoria = categorizar(t, T, subprogramas);
      empurrar(texto.substr(inicio, comprimento), categoria, t.linha, t.coluna);
      pos = inicio + comprimento;
    }
    vao(pos, texto.length);
    return { segmentos: segmentos, erro: null };
  }

  /**
   * `realcar(codigo, opcoes)` → `{ ok, html, categorias, totais, erro }`.
   *   `html`       — o texto inteiro como HTML, pronto para `innerHTML`.
   *   `categorias` — as categorias que APARECERAM (para a UI decidir o que
   *                 mostrar); o repertório completo é `CATEGORIAS`.
   *   `totais`     — contagem por categoria, para teste e para telemetria.
   *   `erro`       — o erro léxico, se houve. `ok: false` significa "mostrei o
   *                 texto sem cor", não "não mostrei nada".
   */
  function realcar(codigo) {
    const r = segmentar(codigo);
    let html = "";
    const totais = {};
    for (const c of CATEGORIAS) totais[c] = 0;
    for (const s of r.segmentos) {
      if (s.categoria === null) {
        html += escapar(s.texto);
        continue;
      }
      totais[s.categoria] = (totais[s.categoria] || 0) + 1;
      html += '<span class="' + CLASSES[s.categoria] + '">' + escapar(s.texto) + "</span>";
    }
    const categorias = CATEGORIAS.filter((c) => totais[c] > 0);
    return {
      ok: !r.erro,
      html: html,
      categorias: categorias,
      totais: totais,
      erro: r.erro ? String(r.erro.message || r.erro) : null,
    };
  }

  /** Atalho para quem só quer a string: `realceHtml(codigo)`. */
  function realceHtml(codigo) {
    return realcar(codigo).html;
  }

  /** Só os segmentos, sem HTML — é o que a §41/§42 vai consumir. */
  function realcarSegmentos(codigo) {
    return segmentar(codigo).segmentos;
  }

  /** Quantidade de `<span>` do HTML, para o teste da §51. */
  function contarSpans(html) {
    return (String(html).match(/<span /g) || []).length;
  }

  GP.Highlight = {
    CATEGORIAS: CATEGORIAS,
    CLASSES: CLASSES,
    CATEGORIAS_POR_CLASSE: CATEGORIAS_POR_CLASSE,
    realcar: realcar,
    realceHtml: realceHtml,
    realcarSegmentos: realcarSegmentos,
    categorizar: categorizar,
    escapar: escapar,
    contarSpans: contarSpans,
  };
})(W.VGPlay);
