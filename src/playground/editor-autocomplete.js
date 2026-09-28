// §50 — AUTOCOMPLETE DO PLAYGROUND.
//
// A §50 pede três famílias: palavras-chave, funções (Abs, RaizQ, Compr, Copia,
// Maiusc, Minusc...) e snippets (`se`, `para`, `enquanto`, `repita`, `funcao`,
// `procedimento`, `algoritmo`). Isto entrega as três e acrescenta as duas que
// faltavam para o autocomplete ser útil dentro do programa em edição:
//
//   · TIPOS DE DADO — `Vg.Tokens.TIPOS_DADOS`. Sem eles, quem escreve `x: `
//     recebe palavra-chave e nada que serve para depois do `:`. Com eles, a §6 fica
//     a um `Tab` de distância.
//   · SÍMBOLOS DE ESCOPO — as variáveis declaradas no próprio programa e os
//     parâmetros dos subprogramas. É a sugestão que mais importa, porque é a
//     única que o autocomplete não consegue adivinhar: `altura` não está em
//     lugar nenhum da linguagem, está no programa que o aluno está escrevendo.
//
// A RELEVÂNCIA tem regra, não é achismo: casamento exato > começo de palavra >
// qualquer posição, e dentro de cada faixa o nome mais curto vem primeiro, com
// um bônus para símbolo de escopo e para tipo quando o cursor está depois de um
// `:`. É por isso que `en` traz `então` e `enquanto` no topo e `escreva` no fim.
//
// SOMBREAMENTO. Um programa pode declarar o nome de um builtin — `Var Pi:
// inteiro` é programa válido — e nesse caso o nome declarado é o que o runtime
// resolve. O autocomplete obedece: a sugestão de builtin com o mesmo nome some
// da lista. Sugerir `Pi(90)` logo depois de o aluno declarar a variável `Pi` é
// oferecer a coisa que o programa dele acabou de proibir.
//
// NENHUMA LÓGICA DE DOM. `sugerir(codigo, posicao)` recebe a string do editor e
// um índice, e devolve um array de objetos. Quem chama decide se pinta uma lista
// flutuante, um `<datalist>` ou imprime no console. É o que permite testar
// tudo isso em Node, onde `document` não existe.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  /**
   * Categorias de sugestão, na ordem em que a UI as exibe. `variavel` e
   * `parametro` são separadas porque o aluno precisa saber se o símbolo
   * sobrevive ao fim da subrotina.
   */
  const CATEGORIAS = [
    "variavel",
    "parametro",
    "funcao",
    "procedimento",
    "palavra-chave",
    "tipo",
    "builtin",
    "snippet",
  ];

  /**
   * Snippets da §50. `corpo` é o que entra no editor quando o aluno aceita a
   * sugestão; o cursor volta para a posição marcada por `|`, que a UI remove
   * antes de injetar. Sem marcador o cursor vai para o fim, que é o padrão.
   */
  const SNIPPETS = [
    { nome: "se", corpo: "se | então\n   |\nfimse" },
    { nome: "senão", corpo: "senão\n   |" },
    { nome: "enquanto", corpo: "enquanto | faça\n   |\nfimenquanto" },
    { nome: "repita", corpo: "repita\n   |\naté |" },
    { nome: "para", corpo: "para | de 1 até 10 faça\n   |\nfimpara" },
    { nome: "escolha", corpo: "escolha |\n   caso |\n      |\n      interrompa\n   outrocaso\n      |\nfimescolha" },
    { nome: "função", corpo: "função |(): inteiro\n   |\nfimfunção" },
    { nome: "procedimento", corpo: "procedimento |()\n   |\nfimprocedimento" },
    { nome: "algoritmo", corpo: "algoritmo \"|\"\nvar\n   |: inteiro\ninício\n   |\nfimalgoritmo" },
    { nome: "escreva", corpo: "escreva(|)" },
  ];

  /** Peso de cada categoria no desempate, quando o resto empata. */
  const PESO_CATEGORIA = {
    variavel: 40,
    parametro: 38,
    procedimento: 30,
    funcao: 28,
    "palavra-chave": 20,
    tipo: 12,
    builtin: 10,
    snippet: 4,
  };

  /** Tabela de TIPOS de token (`Vg.Tokens.T`), lida por chamada: a ordem de carga é contrato. */
  function tipos() {
    return (W.Vg && W.Vg.Tokens && W.Vg.Tokens.T) || {};
  }

  // ------------------------------------------------------------------ prefixo

  /**
   * Texto da palavra que o cursor está tocando, e onde ela começa.
   *
   * A varredura é para TRÁS e aceita letra, dígito, `_` e qualquer caractere
   * acima de 127 (acentos e `§`), o mesmo predicado de `letra`/`digito` do
   * lexer. Ela é a única coisa que este arquivo procura no texto por posição,
   * e não por padrão: não há lista de prefixos, nem alternância de palavra.
   *
   * `posicao` é um índice no texto, como `selectionStart` de `<textarea>`.
   * Índice negativo é tratado como 0 em vez de estourar — um chamador com
   * posição indefinida recebe "no começo", não uma exceção no meio do
   * `keydown`.
   */
  function extrairPrefixo(codigo, posicao) {
    const texto = typeof codigo === "string" ? codigo : "";
    let p = typeof posicao === "number" && posicao > 0 ? Math.floor(posicao) : 0;
    if (p > texto.length) p = texto.length;
    let inicio = p;
    while (inicio > 0) {
      const c = texto.charAt(inicio - 1);
      const dentroDeNome =
        c === "_" ||
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        c.charCodeAt(0) > 127;
      if (!dentroDeNome) break;
      inicio--;
    }
    return { prefixo: texto.slice(inicio, p), inicio: inicio, posicao: p };
  }

  /**
   * Em que contexto o cursor está: `codigo`, `texto`, `comentario` ou `tipo`.
   *
   * - `texto` e `comentario` não sugerem NADA. Uma lista de palavras-chave
   *   aparecendo por cima de `escreva("se")` é ruído que atrapalha.
   * - `tipo` é quando o cursor está depois de um `:` ou no meio de uma seção
   *   `var`/assinatura: aí os tipos de dado sobem para o topo.
   *
   * A detecção de literal é feita sobre a LINHA corrente, alternando aspas —
   * o lexer do VisualG não tem escape (§4 do `lexer.js`), então alternar é
   * exatamente o que o lexer faz, e não há caso que os dois discordem.
   */
  function contextoDe(codigo, posicao) {
    const texto = typeof codigo === "string" ? codigo : "";
    const p = extrairPrefixo(codigo, posicao);
    const inicioLinha = texto.lastIndexOf("\n", Math.max(0, p.inicio - 1)) + 1;
    const trecho = texto.slice(inicioLinha, p.inicio);

    let aspa = "";
    for (let i = 0; i < trecho.length; i++) {
      const c = trecho.charAt(i);
      if (aspa) {
        if (c === aspa) aspa = "";
      } else if (c === '"' || c === "'") aspa = c;
    }
    if (aspa) return "texto";

    if (trecho.indexOf("//") >= 0) return "comentario";

    // Depois de um `:` que não seja especificador de `escreva(x:5)`: o `:` de
    // declaração é o que interessa, e ele vem depois de um nome, não de número.
    const doisPontos = trecho.lastIndexOf(":");
    if (doisPontos >= 0) {
      const antes = trecho.slice(0, doisPontos).replace(/\s+$/, "");
      const ultimo = antes.charAt(antes.length - 1);
      const ehEspecificador = ultimo >= "0" && ultimo <= "9" || ultimo === '"' || ultimo === "'";
      if (!ehEspecificador) return "tipo";
    }
    if (/^\s*var\s*$/i.test(trecho)) return "tipo";
    return "codigo";
  }

  // -------------------------------------------------------------------- escopo

  /**
   * Símbolos do programa: variáveis declaradas, subprogramas e parâmetros.
   *
   * A AST é a fonte (`Vg.analisar`), porque ela já resolveu o grupo de nomes
   * (`x, y: inteiro` vira dois `declaracao.nomes`) e sabe o tipo. Quando o
   * programa NÃO compila — que é o estado normal de quem está digitando — há
   * recuperação por token: a seção `var` e as assinaturas ainda são legíveis,
   * e perder o escopo no meio de um `fimse` não digitado custaria mais do que
   * a recuperação imperfeita. `analisar` nunca lança para fora daqui.
   */
  function simbolos(codigo) {
    const Vg = W.Vg;
    const T = Vg && Vg.Tokens ? Vg.Tokens : null;
    const saida = { variaveis: [], subprogramas: [], parametros: [] };
    if (!T) return saida;
    const texto = typeof codigo === "string" ? codigo : "";
    let programa = null;
    try {
      programa = Vg.analisar(texto);
    } catch (e) {
      programa = null;
    }
    if (programa) {
      for (const d of programa.variaveis || []) {
        for (const n of d.nomes || []) {
          saida.variaveis.push({ nome: n, tipo: d.tipo || null, linha: d.linha });
        }
      }
      for (const s of programa.subprogramas || []) {
        saida.subprogramas.push({
          nome: s.nome,
          tipo: s.tipo === "funcao" ? "funcao" : "procedimento",
          retorno: s.retorno || null,
        });
        for (const p of s.parametros || []) {
          saida.parametros.push({ nome: p.nome, tipo: p.tipo || null, porReferencia: !!p.porReferencia });
        }
      }
      return saida;
    }
    recuperarSimbolos(texto, saida);
    return saida;
  }

  /**
   * Recuperação por token para programa que NÃO compila — que é o estado normal
   * de quem está digitando.
   *
   * A unidade de leitura é a LINHA, não o token solto, e o terminador de uma
   * declaração é o ":". Uma seção "var" é uma sequência de linhas, e cada linha
   * é "nome (, nome)* : tipo ...": tudo antes do primeiro ":" é nome, o que vem
   * depois é tipo. Uma linha sem ":" encerra a seção. É isso que faz
   * "var inicio: inteiro" declarar "inicio" (palavra-chave com valor canônico
   * "início") sem declarar "inteiro" — a diferença entre o escopo certo e um
   * escopo com "início", "real" e "fimalgoritmo" na lista.
   *
   * A assinatura de função/procedimento é lida entre parênteses, com ";"
   * marcando a virada do grupo "var" (§25 — por referência).
   */
  function recuperarSimbolos(texto, saida) {
    let tokens;
    try {
      tokens = new W.Vg.Lexer(texto).tokenizar();
    } catch (e) {
      return; // nem lexou: sem escopo, mas sem quebrar o editor
    }
    if (!tokens.length) return;
    recuperarVariaveis(tokens, saida);
    recuperarAssinaturas(tokens, saida);
  }

  /** Nomes da seção "var", lidos por linha até a primeira linha sem ":". */
  function recuperarVariaveis(tokens, saida) {
    let i = 0;
    let achouVar = false;
    for (; i < tokens.length; i++) {
      if (tokens[i].tipo === tipos().PALAVRA_CHAVE && tokens[i].valor === "var") {
        achouVar = true;
        i++;
        break;
      }
    }
    if (!achouVar) return;
    while (i < tokens.length) {
      const linha = tokens[i].linha;
      let fim = i;
      while (fim < tokens.length && tokens[fim].linha === linha) fim++;
      let doisPontos = -1;
      for (let k = i; k < fim; k++) {
        if (tokens[k].tipo === tipos().DOIS_PONTOS) { doisPontos = k; break; }
      }
      // Linha de código (sem ":"): a seção de declarações acabou.
      if (doisPontos < 0) return;
      let tipo = null;
      for (let k = doisPontos + 1; k < fim; k++) {
        if (tokens[k].tipo === tipos().PALAVRA_CHAVE) { tipo = tokens[k].valor; break; }
      }
      for (let k = i; k < doisPontos; k++) {
        const t = tokens[k];
        if (t.tipo !== tipos().IDENTIFICADOR && t.tipo !== tipos().PALAVRA_CHAVE) continue;
        saida.variaveis.push({ nome: t.bruto || t.valor, tipo: tipo, linha: linha });
      }
      i = fim;
    }
  }

  /** Nome e parâmetros de "função"/"procedimento", lidos entre parênteses. */
  function recuperarAssinaturas(tokens, saida) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.tipo !== tipos().PALAVRA_CHAVE) continue;
      if (t.valor !== "função" && t.valor !== "procedimento") continue;
      let j = i + 1;
      // O nome do subprograma pode ser palavra-chave usada como nome; o bruto
      // manda, pelo mesmo motivo do `parser.js`.
      if (j < tokens.length && (tokens[j].tipo === tipos().IDENTIFICADOR || tokens[j].tipo === tipos().PALAVRA_CHAVE)) {
        saida.subprogramas.push({
          nome: tokens[j].bruto || tokens[j].valor,
          tipo: t.valor === "função" ? "funcao" : "procedimento",
          retorno: null,
        });
        j++;
      }
      if (j >= tokens.length || tokens[j].tipo !== tipos().OPERADOR || tokens[j].valor !== "(") continue;
      j++;
      let porReferencia = false;
      let grupo = [];
      let tipo = null;
      let esperandoTipo = false;
      for (; j < tokens.length; j++) {
        const p = tokens[j];
        if (p.tipo === tipos().OPERADOR && p.valor === ")") break;
        if (p.tipo === tipos().PALAVRA_CHAVE && p.valor === "var") { porReferencia = true; continue; }
        if (p.tipo === tipos().PONTO_E_VIRGULA) {
          for (const nome of grupo) saida.parametros.push({ nome: nome, tipo: tipo, porReferencia: porReferencia });
          grupo = [];
          tipo = null;
          porReferencia = false;
          esperandoTipo = false;
          continue;
        }
        if (p.tipo === tipos().VIRGULA) continue;
        if (p.tipo === tipos().DOIS_PONTOS) { esperandoTipo = true; continue; }
        if (esperandoTipo) {
          if (p.tipo === tipos().PALAVRA_CHAVE) tipo = p.valor;
          continue;
        }
        if (p.tipo === tipos().IDENTIFICADOR) grupo.push(p.valor);
        else if (p.tipo === tipos().PALAVRA_CHAVE) grupo.push(p.bruto || p.valor);
      }
      for (const nome of grupo) saida.parametros.push({ nome: nome, tipo: tipo, porReferencia: porReferencia });
    }
  }


  // -------------------------------------------------------------- candidatos

  /**
   * Candidatos base, sem filtro de prefixo: é a lista de tudo que a linguagem e
   * o programa oferecem. `sugerir` filtra e ordena a partir daqui.
   *
   * `opcoes.codigo` é o texto do editor; `opcoes.escopo`, quando vem, evita
   * um segundo `analisar` — `sugerir` já calculou o escopo para aplicar o
   * sombreamento, e parsear o programa duas vezes por tecla é desperdício que o
   * aluno sente no delay da lista.
   *
   * As palavras-chave vêm de `Vg.Tokens.PALAVRAS` (fonte única, §4), com a
   * forma CANÔNICA acentuada — `então`, não `entao`. A deduplicação é pela
   * chave sem acento porque `PALAVRAS` tem `caracter`/`caractere` e `logico`
   * apontando para a mesma canônica, e sugerir `caractere` duas vezes com
   * grafias diferentes seria ruído.
   */
  function candidatos(opcoes) {
    const o = opcoes || {};
    const Vg = W.Vg;
    const T = Vg && Vg.Tokens ? Vg.Tokens : null;
    const lista = [];
    const vistos = new Set();
    const add = (nome, tipo, detalhe, extra) => {
      if (typeof nome !== "string" || nome === "") return;
      const chave = T ? T.chaveDe(nome) : nome.toLowerCase();
      const id = tipo + " " + chave;
      if (vistos.has(id)) return;
      vistos.add(id);
      const s = { nome: nome, tipo: tipo, detalhe: detalhe || "" };
      if (extra) for (const k of Object.keys(extra)) s[k] = extra[k];
      lista.push(s);
    };

    if (!T) return lista;

    // 1. escopo do programa: variáveis, parâmetros e subprogramas.
    const escopo = o.escopo || simbolos(o.codigo);
    for (const v of escopo.variaveis) add(v.nome, "variavel", v.tipo || "declarada", { linha: v.linha });
    for (const p of escopo.parametros) add(p.nome, "parametro", p.tipo || "parâmetro");
    for (const s of escopo.subprogramas) add(s.nome, s.tipo, s.retorno ? "retorna " + s.retorno : "do programa");

    // 2. tipos de dado (§6). Vêm antes das palavras-chave na lista porque a
    //    pontuação do tipo é maior quando o cursor está depois de um `:`.
    for (const t of T.TIPOS_DADOS) add(t, "tipo", "tipo de dado");

    // 3. palavras-chave (§4), sem os tipos (já passados acima).
    const tiposChave = {};
    for (const t of T.TIPOS_DADOS) tiposChave[T.chaveDe(t)] = true;
    for (const chave of Object.keys(T.PALAVRAS)) {
      const canonica = T.PALAVRAS[chave];
      if (tiposChave[T.chaveDe(canonica)]) continue;
      add(canonica, "palavra-chave", "palavra-chave");
    }

    // 4. builtins. `Vg.builtins` é lista de grupos (um por módulo de stdlib).
    for (const grupo of Vg.builtins || []) {
      for (const nome of grupo || []) add(nome, "builtin", "função da linguagem");
    }

    // 5. snippets da §50.
    for (const s of SNIPPETS) add(s.nome, "snippet", "modelo", { corpo: s.corpo });

    return lista;
  }

  /**
   * Nomes que o programa DECLAROU e que a linguagem também oferece (builtin,
   * palavra-chave ou tipo). O que sai daqui é omitido da lista: quem escreveu
   * `Var Pi: inteiro` está com a variável, não com a função.
   */
  function sombreados(escopo) {
    const T = W.Vg.Tokens;
    const chaves = new Set();
    if (!T) return chaves;
    const add = (n) => {
      if (typeof n === "string" && n !== "") chaves.add(T.chaveDe(n));
    };
    for (const v of escopo.variaveis) add(v.nome);
    for (const p of escopo.parametros) add(p.nome);
    for (const s of escopo.subprogramas) add(s.nome);
    return chaves;
  }

  // ------------------------------------------------------------------- ordem

  /**
   * Pontua um candidato contra o prefixo.
   *
   * Três faixas, e a distância é o desempate dentro delas: exato (1000) > início
   * de palavra (800) > em qualquer posição (600). O "em qualquer posição" só
   * entra com prefixo de dois caracteres ou mais — com `e` ele traria metade da
   * linguagem, que é ruído, não sugestão.
   */
  function pontuar(c, prefixoChave, contexto) {
    const chave = W.Vg.Tokens.chaveDe(c.nome);
    let base = 0;
    if (chave === prefixoChave) base = 1000;
    else if (chave.indexOf(prefixoChave) === 0) base = 800;
    else if (prefixoChave.length >= 2 && chave.indexOf(prefixoChave) >= 0) base = 600;
    else return -1;
    let pontos = base + (PESO_CATEGORIA[c.tipo] || 0);
    if (contexto === "tipo" && (c.tipo === "tipo" || c.tipo === "variavel" || c.tipo === "parametro")) pontos += 30;
    return pontos - Math.min(c.nome.length, 40) / 100;
  }

  /**
   * `sugerir(codigo, posicao, opcoes)` → array de
   * `{ nome, tipo, detalhe, corpo?, pontuacao, posicao, inscricao }`, em ordem
   * decrescente de relevância.
   *
   * Devolve lista VAZIA (e não lança) quando não há engine, quando o cursor
   * está dentro de literal ou comentário, ou quando nada casa. Uma lista de
   * sugestão é conselho de UI: falhar é sempre "não mostra nada".
   *
   * `opcoes`:
   *   limite   — quantas sugestões voltar (padrão 25; 0 = sem limite)
   *   incluirSnippets — padrão true
   */
  function sugerir(codigo, posicao, opcoes) {
    const o = opcoes || {};
    const Vg = W.Vg;
    if (!Vg || !Vg.Tokens || typeof Vg.analisar !== "function") return [];
    const limite = typeof o.limite === "number" ? o.limite : 25;
    const contexto = contextoDe(codigo, posicao);
    if (contexto === "texto" || contexto === "comentario") return [];

    const T = Vg.Tokens;
    const extraido = extrairPrefixo(codigo, posicao);
    const prefixoChave = T.chaveDe(extraido.prefixo);

    const escopo = simbolos(codigo);
    const ocultos = sombreados(escopo);
    const lista = candidatos({ codigo: codigo, escopo: escopo });

    const saida = [];
    for (const c of lista) {
      if (o.incluirSnippets === false && c.tipo === "snippet") continue;
      // Sombreamento: a declaração do programa ganha da entrada da linguagem.
      if (c.tipo !== "variavel" && c.tipo !== "parametro" && c.tipo !== "funcao" && c.tipo !== "procedimento") {
        if (ocultos.has(T.chaveDe(c.nome))) continue;
      }
      if (prefixoChave === "") {
        // Sem prefixo a lista é curta de propósito: variáveis do programa,
        // subprogramas e snippets. Um menu com as 70 palavras da linguagem
        // quando o aluno não digitou nada é um menu que ninguém lê. A exceção
        // é o contexto de tipo, logo depois de um `:` — aí entra também a lista
        // de tipos, que é literalmente o que se pede ali.
        const sempre = c.tipo === "variavel" || c.tipo === "parametro" || c.tipo === "procedimento" || c.tipo === "funcao" || c.tipo === "snippet";
        if (!sempre && !(contexto === "tipo" && c.tipo === "tipo")) continue;
      }
      const p = prefixoChave === "" ? (PESO_CATEGORIA[c.tipo] || 0) : pontuar(c, prefixoChave, contexto);
      if (p < 0) continue;
      saida.push({ nome: c.nome, tipo: c.tipo, detalhe: c.detalhe, corpo: c.corpo, pontuacao: p });
    }

    saida.sort(
      (a, b) =>
        (b.pontuacao - a.pontuacao) ||
        (a.nome.length - b.nome.length) ||
        (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0)
    );
    // `posicao` é onde a substituição COMEÇA, isto é, o índice do primeiro
    // caractere do prefixo. Quem aceita a sugestão substitui de `posicao` até o
    // cursor; `inscricao` é o que entra no lugar.
    const comeco = extraido.inicio;
    const limitados = limite > 0 ? saida.slice(0, limite) : saida;
    for (const s of limitados) {
      s.posicao = comeco;
      s.inscricao = s.tipo === "snippet" ? String(s.corpo || "").split("|").join("") : s.nome;
    }
    return limitados;
  }

  /** Nomes de uma lista de sugestões, na ordem — atalho para o teste e a UI. */
  function nomes(sugestoes) {
    return (sugestoes || []).map((s) => s.nome);
  }

  GP.Autocomplete = {
    CATEGORIAS: CATEGORIAS,
    SNIPPETS: SNIPPETS,
    sugerir: sugerir,
    nomes: nomes,
    extrairPrefixo: extrairPrefixo,
    contextoDe: contextoDe,
    simbolos: simbolos,
    candidatos: candidatos,
  };
})(W.VGPlay);
