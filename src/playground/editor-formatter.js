// §49 — FORMATTER DO PLAYGROUND.
//
// Um programa VisuAlg é uma sequência de LINHAS, e a estrutura do programa é
// dita por VINTE palavras-chave de bloco (`se`/`fimse`, `repita`/`até`,
// `escolha`/`caso`/`fimescolha`, `função`/`fimfunção`, `var`/`início`/
// `fimalgoritmo`, ...). O VisualAlg classicamente usa 3 espaços de indentação —
// confirmado nos 95 `.alg` de `faccat/` e `manzano/`, e não os 4 do exemplo
// didático do `task.md`, que é pseudocódigo genérico. Aqui a indentação é 3, e o
// bloco se alinha com o comando que o abriu: `senão` volta para a coluna do
// `se`, e o corpo do `caso` volta para a coluna do `escolha`.
//
// REGRA DE OURO: IDEMPOTÊNCIA. `formatar(formatar(x)) === formatar(x)`. Isso
// não é vaidade: o botão de formatar fica ao alcance do aluno que acabou de
// colar um exercício, e um formatador que embaralha o texto a cada clique
// destrói o trabalho. A garantia vem de duas decisões estruturais:
//
//   1. Nada é decidido por regex sobre o texto. A CLASSIFICAÇÃO de cada linha
//      vem do `Vg.Lexer` (o mesmo da engine) e a ESTRUTURA de blocos vem de uma
//      pilha real, montada com esses tokens. A §49 do `task.md` pede
//      "AST/CST, não uma sequência de regex"; aqui a CST é a pilha de blocos.
//   2. Cada linha é REEMITIDA a partir dos tokens, não editada no lugar. A
//      segunda passagem parte do mesmo texto normalizado que a primeira
//      produziu, e cada transformação (minúsculo, espaçamento, indentação) é
//      uma função idempotente do valor de origem.
//
// O que NÃO é responsabilidade deste arquivo: executar, avaliar tipos ou
// corrigir programa. É só forma. Nenhum `localStorage`, nenhuma rede, nenhum
// DOM: a função recebe STRING e devolve STRING, e quem chama decide o que
// fazer com o resultado. É o mesmo princípio do núcleo da engine, e é o que
// permite `tests/playground/editor.test.mjs` rodar em Node sem `document`.
//
// Dependência: `W.Vg` (engine). Sem engine carregada o formatter devolve
// `{ ok: false }` em vez de fingir que formatou — a ordem de carga é contrato de
// `carga.mjs`, e um formatter que "funciona" sem lexer não tem como saber o que
// é palavra-chave.
var W = typeof window !== "undefined" ? window : globalThis;
W.VGPlay = W.VGPlay || {};

(function (GP) {
  "use strict";

  // 3 espaços por nível, confirmado nos 95 exercícios do corpus. Mudar para 4
  // faria o formatador brigar com o resto do projeto.
  const INDENTACAO = "   ";

  /**
   * Palavras que ABREM bloco. O valor é o rótulo do quadro na pilha, não a
   * palavra em si: `se` e `senão` compartilham o rótulo `se` porque é o MESMO
   * bloco, e é isso que faz `fimse` voltar para a coluna certa depois de um
   * `senão`.
   */
  const ABRE = {
    "se": "se",
    "senão": "se",
    "enquanto": "enquanto",
    "repita": "repita",
    "para": "para",
    "escolha": "escolha",
    "caso": "caso",
    "outrocaso": "caso",
    "função": "funcao",
    "procedimento": "procedimento",
    "var": "var",
  };

  /** Palavras que FECHAM bloco; o valor é o rótulo do quadro a desempilhar. */
  const FECHA = {
    "fimse": "se",
    "fimenquanto": "enquanto",
    "até": "repita",
    "fimpara": "para",
    "fimescolha": "escolha",
    "fimfunção": "funcao",
    "fimprocedimento": "procedimento",
    "fimalgoritmo": "corpo",
  };

  /**
   * Palavras que se alinham com a linha do comando que abriu o bloco, sem
   * fechar o bloco: `senão` alinha com `se`, `caso`/`outrocaso` alinham com
   * `escolha`. É o "alinhamento dos blocos" que a Onda 10C pede.
   */
  const ALINHA = { "senão": "se", "caso": "escolha", "outrocaso": "escolha" };

  /**
   * Palavras que COLAM no parêntese seguinte.
   *
   * `escreva(x)` e `leia(x)` são chamada, e chamada não tem espaço. `se (x > 1)`
   * NÃO é: é condição entre parênteses, e o VisuAlg escreve com espaço — tanto
   * no `task.md` quanto nos 95 `.alg` do corpus. A distinção é da gramática, não
   * do gosto, e por isso a lista é explícita em vez de "toda palavra-chave cola":
   * as extensões de §31–§39 (`mudacor(...)`, `aleatorio(...)`) entram aqui
   * porque o `parser.js` também aceita a forma com parênteses para elas.
   */
  const COLADO = {
    escreva: true,
    escreval: true,
    leia: true,
    aleatorio: true,
    arquivo: true,
    eco: true,
    mudacor: true,
    limpatela: true,
    cronometro: true,
    pausa: true,
    debug: true,
  };

  /**
   * Palavras que jogam tudo de volta para a coluna zero. Só `algoritmo`: a
   * primeira linha do arquivo é o único ponto em que a pilha de blocos é
   * descartada por inteiro.
   *
   * `início` e `fimalgoritmo` NÃO estão aqui. Eles delimitam o corpo do
   * algoritmo, e o corpo é um nível — é assim que os 95 exercícios do corpus
   * estão escritos, com `escreva(...)` indentado dentro do `início` e não na
   * coluna do `algoritmo`. `início` fecha o quadro do `var` e abre o do corpo;
   * `fimalgoritmo` fecha o do corpo.
   */
  const RAIZ = { "algoritmo": true };

  // -------------------------------------------------------------- diagnóstico

  /**
   * Erro no formato de `Diagnostics.serializar` quando ele existe, para a UI
   * pintar linha/coluna igual pinta em qualquer outro erro do playground. O
   * `fallback` existe para o caso de a ordem de carga estar errada — aí já não
   * dá para confiar em nada, mas a mensagem ainda precisa ser legível.
   */
  function serializar(erro) {
    const D = W.VG && W.VG.Diagnostics;
    if (D && typeof D.serializar === "function") return D.serializar(erro);
    return {
      mensagem: (erro && erro.message) || String(erro),
      linha: erro && erro.linha != null ? erro.linha : null,
      coluna: erro && erro.coluna != null ? erro.coluna : null,
      codigo: (erro && erro.codigo) || "DESCONHECIDO",
      tipo: (erro && erro.name) || "Error",
    };
  }

  // ------------------------------------------------------------------ lexemas

  /**
   * Tabela de TIPOS de token (`Vg.Tokens.T`).
   *
   * Lida por chamada, e não capturada no carregamento do módulo, porque a ordem
   * de carga é contrato (`carga.mjs`) e um `<script>` fora de ordem não pode
   * quebrar o editor com um `undefined` congelado na closure. `W.Vg.Tokens` é o
   * vocabulário (palavras-chave, tipos de dado); os TIPOS é a enumeração de
   * `lexer.js`, e são coisas diferentes.
   */
  function tipos() {
    return (W.Vg && W.Vg.Tokens && W.Vg.Tokens.T) || {};
  }

  /**
   * Tokeniza UMA LINHA FÍSICA e devolve os tokens com a fatiagem exata do
   * código-fonte.
   *
   * Linha a linha, e não o programa inteiro, porque o lexer do VisualG não tem
   * string multilinha (`lerTexto` quebra no `\n` com erro): nenhuma estrutura
   * atravessa linha, exceto parênteses, e parênteses são tratados por contagem.
   * A fatiagem existe para preservar a grafia do original — `"` ou `'`, e
   * `1.50` em vez de `1.5` — que já se perdeu ao remontar pelo valor.
   *
   * `numero` é a linha NO PROGRAMA. O lexer, recebendo uma linha solta, numera
   * tudo como linha 1, e a comparação com as posições da AST (que são do
   * programa inteiro) silenciosamente nunca casaria — `faccat/ex21.alg` voltaria
   * com a variável `inicio` acentuada no meio de uma comparação.
   */
  function tokenizarLinha(texto, T, numero) {
    const brutos = new W.Vg.Lexer(texto).tokenizar();
    const saida = [];
    for (const t of brutos) {
      if (t.tipo === tipos().FIM) continue;
      const comprimento = t.comprimento;
      saida.push({
        tipo: t.tipo,
        valor: t.valor,
        bruto: t.bruto || null,
        linha: numero,
        coluna: t.coluna,
        comprimento: comprimento == null ? null : comprimento,
        fatia: comprimento == null ? null : texto.substr(t.coluna - 1, comprimento),
      });
    }
    return saida;
  }

  /** O token é um VALOR (operando ou nome callable), e não um operador? */
  function ehValor(t, unario) {
    if (!t) return false;
    if (t.tipo === tipos().IDENTIFICADOR || t.tipo === tipos().NUMERO || t.tipo === tipos().TEXTO) return true;
    if (t.tipo === tipos().PALAVRA_CHAVE) return !!t.ehNome;
    if (t.tipo !== tipos().OPERADOR) return false;
    if (t.valor === ")" || t.valor === "]" || t.valor === ".." || t.valor === ".") return true;
    if ((t.valor === "-" || t.valor === "+") && unario[t.indice]) return true;
    return false;
  }

  /**
   * Marca quais tokens de palavra-chave estão sendo usados como NOME, e devolve
   * se a linha terminou dentro de `leia(`.
   *
   * Isto é o que impede o formatter de QUEBRAR o corpus. `faccat/ex21.alg`
   * declara `inicio: inteiro` e `fim: inteiro`: `início` é palavra-chave da
   * linguagem e nome de variável ao mesmo tempo. O `parser.js` grava o nome
   * BRUTO (`nomeDe`/`nomeDeclarado` devolvem `t.bruto`), então reescrever
   * `inicio` como `início` renomearia a variável e o programa pararia de
   * compilar. Pior: `faccat/ex05.alg` declara `e: inteiro`, e `e` é o operador
   * lógico E.
   *
   * Três gatilhos, todos derivados de token (nada de regex):
   *   1. o token seguinte é `:`, `,`, `<-`, `:=` ou `[` → posição de nome;
   *   2. está dentro de `leia(...)` → posição de nome (alvo de leitura);
   *   3. a AST diz que ESTE token é o nome (`escopo.ePosicaoDe`).
   *
   * O gatilho 3 é o que resolve o caso que os outros dois não pegam: a
   * variável `inicio` aparecendo como OPERANDO (`se inicio > 5 então`). Ele é
   * preciso porque a mesma palavra-chave, no mesmo arquivo, é nome em um ponto
   * e palavra-chave em outro — `faccat/ex21.alg` tem a linha `Inicio` (o
   * começo do corpo) e a variável `inicio` ao lado. A regra por chave sem acento
   * resolveria as duas errado. Por isso a posição vem da AST: cada nó
   * `identificador` e cada chamada carrega `linha`/`coluna` (§48), e é lá que se
   * descobre que aquele token é operando e não palavra-chave. No caminho de
   * recuperação (programa que não parseia) não há AST, e aí a regra ampla por
   * chave é a melhor aposta: preserve o nome é mais seguro do que acentuar.
   */
  function marcarNomes(tokens, T, escopo, dentroLeia) {
    let emLeia = !!dentroLeia;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      t.indice = i;
      if (t.tipo === tipos().PALAVRA_CHAVE) {
        const nx = tokens[i + 1];
        let nome = false;
        if (emLeia) {
          nome = true;
        } else if (nx) {
          if (nx.tipo === tipos().DOIS_PONTOS || nx.tipo === tipos().VIRGULA || nx.tipo === tipos().ATRIBUICAO) nome = true;
          // `[` depois da palavra-chave é nome indexado (`inicio[1] <- 5`),
          // MENOS se a palavra é um tipo: em `vetor [1..5] de real` o colchete
          // abre a dimensão, não um índice.
          else if (nx.tipo === tipos().OPERADOR && nx.valor === "[" && !T.ehTipo(t.valor)) nome = true;
        }
        if (!nome) nome = ehPosicaoDeNome(escopo, t);
        t.ehNome = nome;
      }
      if (t.tipo === tipos().PALAVRA_CHAVE && t.valor === "leia") emLeia = true;
      else if (t.tipo === tipos().OPERADOR && t.valor === ")") emLeia = false;
    }
    return emLeia;
  }

  /**
   * A AST reconhece este token como um NOME (e não como palavra-chave)?
   *
   * Com AST, a resposta é a posição: `posicoes` foi montada varrendo os nós
   * `identificador`/`chamada` cujo nome colide com uma palavra-chave. Sem AST
   * (programa que não parseia) a resposta é a chave sem acento do nome constar
   * do escopo — regra ampla, que preserva nome demais em vez de acentuar nome
   * a mais, porque acento em operando quebra o programa e acento em `início`
   * errado só é feio.
   */
  function ehPosicaoDeNome(escopo, t) {
    if (escopo.posicoes) return escopo.posicoes.has(t.linha + ":" + t.coluna);
    return escopo.nomes.has(W.Vg.Tokens.chaveDe(t.bruto || t.valor));
  }

  /** Texto de saída de um token. Palavra-chave vira a forma canônica. */
  function textoDe(t, T) {
    if (t.tipo === tipos().PALAVRA_CHAVE) return t.ehNome ? t.bruto || t.valor : t.valor;
    if (t.fatia !== null && t.fatia !== undefined) return t.fatia;
    return String(t.valor);
  }

  // --------------------------------------------------------------- espaçamento

  /**
   * Calcula se cada token recebe um espaço ANTES dele, mais os dois arrays
   * auxiliares que as decisões seguintes precisam (`unario` e `colonEspacado`).
   * É a única parte do formatter que mexe em espaçamento, e ela é consultada
   * token a token — nada é procurado no texto.
   *
   * Regras, na ordem em que decidem:
   *   - `)` e `]`: nunca colados à direita (`(a+b)*c`).
   *   - `(`/`[`/`.`/`..`: colados a um valor (`escreva(`, `RaizQ(`, `x[1..5]`,
   *     `1..5`) e soltos depois de operador (`* (x+1)*2`). Exceção para
   *     palavra-chave de TIPO: `vetor [1..5] de real` precisa do espaço, senão
   *     viraria `vetor[1..5]`, que é outra coisa.
   *   - depois de `,`/`;`: um espaço, sempre.
   *   - depois de `:`: depende. `x: inteiro` e `funcao f(): inteiro` são
   *     declaração; `escreva(10:5)` e `escreva(3.14159:8:2)` (§16) são
   *     especificador de formato. O que separa os dois casos é o token de ANTES
   *     do `:` — se for número ou texto, é especificador e não leva espaço.
   *   - depois de `-`/`+` unários: nada (`-5`, `x <- -5`).
   *   - caso contrário: um espaço.
   */
  function calcularEspacos(tokens, T, inicial) {
    const n = tokens.length;
    const antes = new Array(n);
    const unario = new Array(n);
    const colon = new Array(n);

    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      unario[i] =
        t.tipo === tipos().OPERADOR && (t.valor === "-" || t.valor === "+") && !ehValor(tokens[i - 1], unario);
      colon[i] =
        t.tipo === tipos().DOIS_PONTOS &&
        !(i > 0 && (tokens[i - 1].tipo === tipos().NUMERO || tokens[i - 1].tipo === tipos().TEXTO));
    }

    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      const p = i === 0 ? null : tokens[i - 1];
      if (i === 0) {
        antes[i] = !!inicial;
        continue;
      }
      if (t.tipo === tipos().OPERADOR && (t.valor === ")" || t.valor === "]")) {
        antes[i] = false;
        continue;
      }
      if (p.tipo === tipos().OPERADOR && (p.valor === ".." || p.valor === ".")) {
        // `1..5` e `a.b` são colados: o ponto de intervalo é do VisuAlg e abrir
        // espaço transformaria `1 .. 5` em outra coisa para quem lê.
        antes[i] = false;
        continue;
      }
      if (t.tipo === tipos().DOIS_PONTOS || t.tipo === tipos().VIRGULA || t.tipo === tipos().PONTO_E_VIRGULA) {
        // Pontuação NUNCA recebe espaço à esquerda: `x: inteiro`, `a, b`, `a; b`.
        antes[i] = false;
        continue;
      }
      if (
        t.tipo === tipos().OPERADOR &&
        (t.valor === "(" || t.valor === "[" || t.valor === "." || t.valor === "..")
      ) {
        // Colado a um valor (`escreva(`, `RaizQ(`, `x[1..5]`, `1..5`) e solto
        // depois de operador (`* (x+1)*2`). Depois de palavra-chave depende de
        // `COLADO`: `vetor [1..5] de real` e `se (x > 1)` levam espaço,
        // `escreva(` não. Nome usado como nome (variável, subprograma) cola
        // sempre, porque é chamada ou indexação.
        if (p.tipo === tipos().PALAVRA_CHAVE && !p.ehNome) antes[i] = !!T.ehTipo(p.valor) || !COLADO[p.valor];
        else antes[i] = !ehValor(p, unario);
        continue;
      }
      if (p.tipo === tipos().OPERADOR && (p.valor === "(" || p.valor === "[")) {
        // Depois de abre-parêntese/abre-colchete não há espaço: `escreva(x)`,
        // `notas[1]`, `f((a + b))`.
        antes[i] = false;
        continue;
      }
      if (p.tipo === tipos().VIRGULA || p.tipo === tipos().PONTO_E_VIRGULA) {
        antes[i] = true;
        continue;
      }
      if (p.tipo === tipos().DOIS_PONTOS) {
        antes[i] = colon[i - 1];
        continue;
      }
      if (p.tipo === tipos().OPERADOR && (p.valor === "-" || p.valor === "+") && unario[i - 1]) {
        antes[i] = false;
        continue;
      }
      antes[i] = true;
    }
    return { antes: antes, unario: unario };
  }

  /**
   * Reemite a lista de tokens de UMA LINHA FÍSICA, já com o espaçamento certo.
   * `inicial` é usado pela linha de continuação de parêntese, que começa com um
   * espaço para não colar em `,`. O `trim` no fim é o que fecha a
   * idempotência: a segunda passagem não tem como devolver espaço a mais.
   */
  function renderizar(tokens, T, inicial) {
    if (tokens.length === 0) return "";
    const esp = calcularEspacos(tokens, T, inicial);
    let saida = esp.antes[0] ? " " : "";
    for (let i = 0; i < tokens.length; i++) {
      if (i > 0 && esp.antes[i]) saida += " ";
      saida += textoDe(tokens[i], T);
    }
    return saida.replace(/\s+$/, "");
  }

  // ------------------------------------------------------------ linhas físicas

  /**
   * Quebra o texto em linhas físicas, com os tokens, o comentário que fecha a
   * linha, a profundidade de parênteses ao fim da linha e se a linha abre
   * parêntese. As três últimas informações existem para
   * chamada quebrada em várias linhas (`escreva("a",\n "b")`): o corpus não tem,
   * mas o aluno digita, e um formatter que quebra programa válido é pior do
   * que um formatter ausente.
   */
  function quebrar(codigo, T) {
    const linhas = codigo.split("\n");
    const saida = [];
    let profundidade = 0;
    for (let i = 0; i < linhas.length; i++) {
      const texto = linhas[i];
      const tokens = tokenizarLinha(texto, T, i + 1);
      const ultimo = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const fimDosTokens = ultimo ? ultimo.coluna - 1 + (ultimo.comprimento || 0) : 0;

      // O comentário é o que sobra DEPOIS do último token, nunca uma busca de
      // `//` na linha: `escreva("http://x")` tem `//` dentro da literal, e uma
      // busca ingenua comeria metade da linha.
      const resto = texto.slice(fimDosTokens).replace(/\s+$/, "");
      const inicioDoComentario = resto.indexOf("//");
      const comentario = inicioDoComentario >= 0 ? resto.slice(inicioDoComentario) : "";

      let abreParentese = false;
      for (const t of tokens) {
        if (t.tipo !== tipos().OPERADOR) continue;
        if (t.valor === "(" || t.valor === "[") {
          profundidade++;
          abreParentese = true;
        } else if (t.valor === ")" || t.valor === "]") {
          profundidade--;
          abreParentese = false;
        }
      }
      if (profundidade < 0) profundidade = 0;

      saida.push({
        numero: i + 1,
        tokens: tokens,
        comentario: comentario,
        abreParentese: abreParentese,
        profundidade: profundidade,
        vazia: tokens.length === 0 && texto.replace(/\s+$/, "") === "",
      });
    }
    return saida;
  }

  // ------------------------------------------------------------------ estrutura

  /**
   * Nomes visíveis no programa, em chave sem acento, MAIS as posições em que a
   * AST diz que um token é nome.
   *
   * Devolve um objeto com dois conjuntos porque eles respondem a perguntas
   * diferentes:
   *   `nomes`   — quais chaves o programa declarou. Serve ao autocomplete (§50).
   *   `posicoes`— `linha:coluna` de cada uso de um nome que também é
   *              palavra-chave. É o que permite diferenciar `Inicio` (palavra
   *              chave) de `inicio` (variável) no mesmo arquivo.
   *
   * Não há recuperação por token aqui, ao contrário do autocomplete: o
   * formatter SÓ roda depois de `analisar` passar, então a AST está sempre
   * disponível. Uma cópia da recuperação seria código que nunca executa, e
   * código que nunca executa é onde mora o bug que ninguém encontra.
   *
   * A varredura é genérica sobre a AST porque `identificador` aparece em
   * atribuição, `leia`, operando, índice, parâmetro e retorno; um `switch` sobre
   * os nove tipos de nó da §48 seria uma lista que envelhece mal.
   */
  function coletarEscopo(programa, T) {
    const nomes = new Set();
    const vistos = new Set();
    const posicoes = new Set();
    const add = (n) => {
      if (typeof n !== "string" || n === "") return;
      const k = T.chaveDe(n);
      if (vistos.has(k)) return;
      vistos.add(k);
      nomes.add(k);
    };
    for (const d of programa.variaveis || []) for (const n of d.nomes || []) add(n);
    for (const s of programa.subprogramas || []) {
      add(s.nome);
      for (const p of s.parametros || []) add(p.nome);
    }
    // Só interessam as chaves que SÃO palavra-chave; para o resto, `marcarNomes`
    // nunca pergunta, porque token `identificador` não vira nome por essa via.
    const emConflito = new Set();
    for (const chave of nomes) {
      if (T.palavraChaveDe(chave) !== null) emConflito.add(chave);
    }
    if (emConflito.size > 0) varrerPosicoes(programa, emConflito, posicoes);
    return { nomes: nomes, posicoes: posicoes };
  }

  /** Percorre a AST e marca `linha:coluna` de cada uso de nome em conflito. */
  function varrerPosicoes(no, emConflito, saida) {
    const T = W.Vg.Tokens;
    if (no === null || typeof no !== "object") return;
    if (Array.isArray(no)) {
      for (const x of no) varrerPosicoes(x, emConflito, saida);
      return;
    }
    if (no.tipo === "identificador" && typeof no.nome === "string" && no.linha != null) {
      if (emConflito.has(T.chaveDe(no.nome))) saida.add(no.linha + ":" + no.coluna);
    } else if (no.tipo === "chamada" && typeof no.nome === "string" && no.linha != null) {
      if (emConflito.has(T.chaveDe(no.nome))) saida.add(no.linha + ":" + no.coluna);
    }
    for (const k of Object.keys(no)) varrerPosicoes(no[k], emConflito, saida);
  }

  // ------------------------------------------------------------------ montagem

  function indentar(nivel, indentacao) {
    let s = "";
    for (let i = 0; i < nivel; i++) s += indentacao;
    return s;
  }

  /** Índice da próxima linha com código, ignorando vazias e comentários. */
  function proximaComCodigo(linhas, i) {
    for (let k = i + 1; k < linhas.length; k++) {
      if (linhas[k].tokens.length > 0) return k;
    }
    return -1;
  }

  /**
   * Desempilha até achar o quadro do rótulo pedido e devolve o nível em que ele
   * foi impresso. Se o rótulo não estiver na pilha — impossível em programa que
   * passou por `analisar`, mas o formatter nunca pode lançar, porque a exceção
   * subiria por dentro do `keydown` do editor — desempilha um quadro mesmo assim.
   */
  function desempilhar(pilha, rotulo) {
    for (let i = pilha.length - 1; i >= 0; i--) {
      if (pilha[i].tipo === rotulo) {
        const nivel = pilha[i].nivel;
        pilha.length = i;
        return nivel;
      }
    }
    const ultimo = pilha.pop();
    return ultimo ? ultimo.nivel : 0;
  }

  /**
   * `formatar(codigo, opcoes)` → `{ ok, texto, erro }`.
   *   `ok: true`  — `texto` é o programa formatado.
   *   `ok: false` — `texto` é o ORIGINAL, e `erro` traz
   *                  `{ mensagem, linha, coluna, codigo, tipo }`.
   *
   * A §49 diz "não alterar semântica", e devolver lixo para programa que não
   * compila seria mudar o programa do aluno por um motivo que não é dele. O
   * erro volta no formato da §46 para a UI pintar a linha como pinta qualquer
   * outro erro do playground.
   */
  function formatar(codigo, opcoes) {
    const o = opcoes || {};
    const original = typeof codigo === "string" ? codigo : "";
    const indentacao = typeof o.indentacao === "string" ? o.indentacao : INDENTACAO;

    if (!W.Vg || typeof W.Vg.analisar !== "function" || !W.Vg.Tokens) {
      return {
        ok: false,
        texto: original,
        erro: {
          codigo: "FORMATTER_SEM_ENGINE",
          mensagem: "Formatter exige a engine (W.Vg) carregada antes; ver src/visualg/carga.mjs",
          linha: null,
          coluna: null,
          tipo: "ErroDeUso",
        },
      };
    }

    const T = W.Vg.Tokens;

    // 1. VALIDAÇÃO. `analisar` é lexe + parse, sem semântica: programa com tipo
    //    errado ainda tem forma e deve ser formatado; programa com forma errada
    //    não tem.
    let programa = null;
    try {
      programa = W.Vg.analisar(original);
    } catch (e) {
      return { ok: false, texto: original, erro: serializar(e) };
    }

    const normalizado = original.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 2. LINHAS. Quebrar já tokeniza; um erro aqui só é possível se o lexer
    //    discordar do parser, e mesmo assim é preferível devolver o original
    //    com o erro a devolver meio programa.
    let linhas;
    try {
      linhas = quebrar(normalizado, T);
    } catch (e) {
      return { ok: false, texto: original, erro: serializar(e) };
    }

    // 3. ESCOPO E DECLARAÇÕES. `linhasDeclaradas` vem da AST: é ela que sabe em
    //    que LINHA começa cada `nome: tipo`, e é o que dá um nível à seção `var`
    //    sem precisar adivinhar pelo texto.
    const escopo = coletarEscopo(programa, T);
    const linhasDeclaradas = new Set();
    for (const d of (programa && programa.variaveis) || []) {
      if (d && d.linha != null) linhasDeclaradas.add(d.linha);
    }

    const saida = [];
    const pilha = [{ tipo: "raiz", nivel: 0 }];
    let nivel = 0;
    let continua = false;
    let dentroLeia = false;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];

      // `marcarNomes` roda ANTES de qualquer ramo, porque a linha de
      // continuação também precisa de `ehNome` para reemitir `inicio` como
      // `inicio` e não como `início`.
      if (linha.tokens.length > 0) dentroLeia = marcarNomes(linha.tokens, T, escopo, continua ? dentroLeia : false);

      if (linha.vazia) {
        // Linha em branco nunca é indentada e nunca mexe na pilha: idempotente
        // por construção, porque a segunda passagem não encontra o que fazer.
        saida.push("");
        continue;
      }

      if (linha.tokens.length === 0) {
        // Comentário sozinho: não mexe na pilha. A indentação evita o caso feio
        // do comentário de rodapé da seção `var` herdando o nível do `início`
        // seguinte: se a próxima linha de código não é declaração, o comentário
        // fica na coluna do `var`.
        let n = nivel;
        if (pilha[pilha.length - 1].tipo === "var") {
          const prox = proximaComCodigo(linhas, i);
          if (prox < 0 || !linhasDeclaradas.has(linhas[prox].numero)) n = pilha[pilha.length - 1].nivel;
        }
        saida.push(indentar(n, indentacao) + linha.comentario);
        continue;
      }

      // Linha de continuação (parêntese aberto na linha anterior): entra um nível
      // à frente e NÃO mexe na pilha de blocos.
      if (continua) {
        saida.push(
          indentar(nivel + 1, indentacao) + renderizar(linha.tokens, T, !linha.abreParentese)
        );
        continua = linha.profundidade > 0;
        continue;
      }

      const primeiro = linha.tokens[0];
      const cabeca = primeiro.tipo === tipos().PALAVRA_CHAVE ? primeiro.valor : null;
      // `inicio: inteiro` de `faccat/ex21.alg` começa com a palavra-chave
      // `início`, que também é o começo do corpo do algoritmo. Os dois casos são
      // distinguíveis porque só um dos dois está na lista de linhas declaradas
      // que a AST montou — por isso a linha declarada é avaliada ANTES de
      // qualquer palavra-chave.
      const declarada = linhasDeclaradas.has(linha.numero);

      let reabre = null;
      if (declarada) {
        if (nivel === 0) {
          pilha.push({ tipo: "var", nivel: 0 });
          nivel = 1;
        }
      } else if (cabeca && RAIZ[cabeca]) {
        pilha.length = 0;
        pilha.push({ tipo: "raiz", nivel: 0 });
        nivel = 0;
      } else if (cabeca === "início") {
        // Fecha a seção `var` e abre o corpo do algoritmo. O corpo é um nível:
        // é assim que o corpus dos 95 está escrito, e é o que a §2 do `task.md`
        // mostra. Sem o quadro `var` (programa sem declarações) o corpo abre na
        // coluna em que o `início` está, que é zero.
        nivel = desempilhar(pilha, "var");
        reabre = "corpo";
      } else if (cabeca && FECHA[cabeca]) {
        nivel = desempilhar(pilha, FECHA[cabeca]);
      } else if (cabeca && ALINHA[cabeca]) {
        nivel = desempilhar(pilha, ALINHA[cabeca]);
        reabre = ABRE[cabeca];
      }

      // --- impressão --------------------------------------------------------
      saida.push(
        indentar(nivel, indentacao) + renderizar(linha.tokens, T, false) + (linha.comentario ? "  " + linha.comentario : "")
      );

      // --- ajuste de nível DEPOIS de imprimir -------------------------------
      if (!declarada) {
        if (cabeca && ABRE[cabeca]) {
          if (cabeca === "var") nivel = 0;
          pilha.push({ tipo: ABRE[cabeca], nivel: nivel });
          nivel = nivel + 1;
        } else if (reabre) {
          pilha.push({ tipo: reabre, nivel: nivel });
          nivel = nivel + 1;
        }
      }

      continua = linha.profundidade > 0;
    }

    // O `\n` final do original volta sozinho: `split("\n")` de um texto que
    // termina em newline produz um último elemento vazio, e a junção o
    // transforma no `\n` de volta. Quem chamou sem newline final não ganha um
    // de brinde, e é por isso que a montagem é idempotente sem conserto extra.
    const texto = saida.join("\n");
    return { ok: true, texto: texto, erro: null };
  }

  /** Atalho para quem só quer a string; devolve o original se não formatar. */
  function apenasTexto(codigo, opcoes) {
    return formatar(codigo, opcoes).texto;
  }

  GP.Formatter = {
    formatar: formatar,
    apenasTexto: apenasTexto,
    INDENTACAO: INDENTACAO,
    ABRE: ABRE,
    FECHA: FECHA,
    ALINHA: ALINHA,
    RAIZ: RAIZ,
  };
})(W.VGPlay);
