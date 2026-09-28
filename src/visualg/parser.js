// Parser do VisualG — onda 3.
//
// Precedência, da §13 do `task.md`, da mais solta para a mais forte:
//
//     xou
//     ou
//     e
//     nao
//     relacionais
//     + -
//     * / \ div mod %
//     ^
//     unário +/-
//     ( )
//
// `xou` ser o mais fraco é contraintuitivo (em quase toda linguagem `xor` amarra
// quase tanto quanto `ou`), mas é o que o spec determina, e a decisão D6 do
// backlog manda seguir o `task.md` como fonte da verdade.
//
// `nao` fica ENTRE os relacionais e o `e`. Na prática isso produz o mesmo
// resultado do parser antigo para `nao x > 1` (os relacionais amarravam antes,
// dando `nao (x > 1)`), então os 95 exercícios do corpus não mudam de
// comportamento por causa disso.
//
// `^` é associativo à direita e o lado esquerdo passa por `unario()`, então
// `-2^2` é `(-2)^2` — coerente com `unário` estar acima de `^` na tabela.
var W = typeof window !== "undefined" ? window : globalThis;
W.VG = W.VG || {};

(function (VG) {
  "use strict";

  const N = VG.Ast.N;
  const T = VG.Tokens.T;
  const Diagnostics = VG.Diagnostics;

  const RELACIONAIS = ["=", "<>", "<", ">", "<=", ">="];
  const AGLUTINANTES = { div: "div", mod: "%", "\\": "\\" };

  /** Palavras-chave que iniciam comando. Qualquer outra pode ser nome de variável. */
  const COMANDOS = [
    "se", "enquanto", "repita", "para",
    "escreva", "escreval", "leia",
    "escolha", "interrompa", "retorne",
  ];

  class Parser {
    constructor(tokens) {
      this.tokens = Array.isArray(tokens) ? tokens : [];
      this.pos = 0;
    }

    // ------------------------------------------------------------- posição

    atual() {
      return this.tokens[this.pos] || { tipo: T.FIM, valor: "<fim>", linha: null, coluna: null };
    }

    proximo() {
      return this.tokens[this.pos + 1] || { tipo: T.FIM, valor: "<fim>", linha: null, coluna: null };
    }

    avancar() {
      const t = this.atual();
      if (t.tipo !== T.FIM) this.pos++;
      return t;
    }

    posicao(t) {
      return { linha: t.linha, coluna: t.coluna, comprimento: t.length || null, contexto: t.valor };
    }

    erro(codigo, mensagem, t) {
      const tok = t || this.atual();
      throw Diagnostics.criar(codigo, mensagem, this.posicao(tok));
    }

    // ------------------------------------------------------------- casadores

    ehPalavra(valor) {
      const t = this.atual();
      return t.tipo === T.PALAVRA_CHAVE && t.valor === valor;
    }

    ehOperador(valor) {
      const t = this.atual();
      // `,` `:` e `;` recebem tipo próprio no lexer para deixar a intenção
      // explícita, mas para o parser são operadores como quaisquer outros.
      if (t.tipo === T.VIRGULA || t.tipo === T.DOIS_PONTOS || t.tipo === T.PONTO_E_VIRGULA) {
        return t.valor === valor;
      }
      return t.tipo === T.OPERADOR && t.valor === valor;
    }

    ehAtribuicao() {
      const t = this.atual();
      return t.tipo === T.ATRIBUICAO;
    }

    consumirPalavra(valor, porQuem) {
      if (!this.ehPalavra(valor)) {
        this.erro(
          "SINTESE_ESPERADO",
          "Esperado '" + (porQuem || valor) + "', encontrado '" + this.descrever(this.atual()) + "'"
        );
      }
      return this.avancar();
    }

    consumirOperador(valor) {
      if (!this.ehOperador(valor)) {
        this.erro(
          "SINTESE_ESPERADO",
          "Esperado '" + valor + "', encontrado '" + this.descrever(this.atual()) + "'"
        );
      }
      return this.avancar();
    }

    /** Texto legível de um token, para mensagens de erro. */
    descrever(t) {
      if (t.tipo === T.FIM) return "fim do programa";
      return String(t.valor);
    }

    // -------------------------------------------------------------- programa

    parse() {
      const inicio = this.atual();
      this.consumirPalavra("algoritmo", "algoritmo");
      if (this.atual().tipo !== T.TEXTO) {
        this.erro("SINTESE_ESPERADO", "Esperado o nome do algoritmo entre aspas");
      }
      const nome = this.avancar().valor;

      const variaveis = this.declaracoes();
      this.consumirPalavra("início", "início");
      const corpo = this.blocos(["fimalgoritmo"]);
      this.consumirPalavra("fimalgoritmo", "fimalgoritmo");

      // §23–§27 — no VisuAlg os subprogramas vêm DEPOIS do fimalgoritmo.
      const subprogramas = this.subprogramas();
      if (this.atual().tipo !== T.FIM) {
        this.erro(
          "SINTESE_TOKEN_INESPERADO",
          "Esperado 'funcao' ou 'procedimento' ou fim do programa, encontrado '" +
            this.descrever(this.atual()) + "'"
        );
      }

      const programa = N.programa(nome, variaveis, corpo, this.posicao(inicio));
      programa.subprogramas = subprogramas;
      return programa;
    }

    /** Bloco `var`: uma ou mais declarações de §6. */
    declaracoes() {
      const saida = [];
      if (!this.ehPalavra("var")) return saida;
      this.avancar();
      while (this.ehNomeDeclarado()) {
        saida.push(this.declaracao());
      }
      return saida;
    }

    ehIdentificador() {
      return this.atual().tipo === T.IDENTIFICADOR;
    }

    /**
     * Nome de variável/parametro, tolerando palavra-chave usada como nome.
     *
     * `faccat/ex21.alg` declara `inicio: inteiro` e `fim: inteiro` — `inicio` é
     * palavra-chave da linguagem e ainda assim o exercício usa como variável. O
     * desempate é o `:` imediatamente seguinte: em VisuAlg nenhum outro lugar
     * tem `:` logo depois de um token, então a leitura é inequívoca e não é
     * adivinhação. O nome gravado é o BRUTO (`inicio`), não a forma canônica
     * (`início`), porque é assim que o programa foi escrito.
     */
    ehNomeDeclarado() {
      const t = this.atual();
      if (t.tipo === T.IDENTIFICADOR) return true;
      return t.tipo === T.PALAVRA_CHAVE && this.proximo().tipo === T.DOIS_PONTOS;
    }

    /** Consome e devolve o nome de uma declaração. */
    nomeDeclarado() {
      const t = this.avancar();
      return t.tipo === T.IDENTIFICADOR ? t.valor : t.bruto || t.valor;
    }

    /**
     * Nome de um token usado como identificador.
     *
     * Devolve a grafia BRUTA, nunca a canônica: `inicio: inteiro` precisa se
     * chamar `inicio` no escopo, não `início`. A análise semântica da onda 6 é
     * quem decide se o nome existe; o parser só reconhece a forma.
     */
    nomeDe(t) {
      return t.tipo === T.IDENTIFICADOR ? t.valor : t.bruto || t.valor;
    }

    /** Uma palavra-chave serve como alvo de `leia` ou como operando? */
    ehNomeDeAlvo() {
      return this.atual().tipo === T.IDENTIFICADOR || this.atual().tipo === T.PALAVRA_CHAVE;
    }

    /**
     * `nome: tipo`, `x, y, z: inteiro`, `notas: vetor [1..5] de real`.
     *
     * O `de` antes do tipo do elemento só aparece na forma vetor/matriz, e a
     * quantidade de faixas decide a natureza: uma faixa é vetor, duas ou mais é
     * matriz. O spec escreve matriz com a palavra `vetor` (`matriz: vetor
     * [1..3,1..3] de inteiro`), então as duas palavras são aceitas.
     */
    declaracao() {
      const tok = this.atual();
      const nomes = [];
      while (this.ehIdentificador() || (tok.tipo === T.PALAVRA_CHAVE && this.ehNomeDeclarado())) {
        nomes.push(this.nomeDeclarado());
        if (this.ehOperador(",")) {
          this.avancar();
          continue;
        }
        break;
      }
      this.consumirOperador(":");
      const tipoTok = this.atual();
      if (tipoTok.tipo !== T.PALAVRA_CHAVE) {
        this.erro("SINTESE_ESPERADO", "Esperado o tipo da variável '" + nomes.join(", ") + "'");
      }
      this.avancar();
      const tipo = tipoTok.valor;

      if (tipo === "vetor" || tipo === "matriz") {
        const dimensoes = this.dimensoes();
        this.consumirPalavra("de", "de (antes do tipo do elemento)");
        const elem = this.atual();
        if (elem.tipo !== T.PALAVRA_CHAVE || !VG.Tokens.ehTipo(elem.valor)) {
          this.erro("SINTESE_ESPERADO", "Esperado o tipo do elemento do vetor/matriz");
        }
        this.avancar();
        return N.declaracao(
          nomes,
          dimensoes.length > 1 ? "matriz" : "vetor",
          dimensoes,
          this.posicao(tok),
          elem.valor
        );
      }

      if (!VG.Tokens.ehTipo(tipo)) {
        this.erro("SINTESE_ESPERADO", "Tipo inválido: '" + tipo + "'", tipoTok);
      }
      return N.declaracao(nomes, tipo, [], this.posicao(tok));
    }

    /** `[1..5]` ou `[1..3,1..3]`; devolve uma lista de faixas. */
    dimensoes() {
      const saida = [];
      this.consumirOperador("[");
      while (true) {
        const de = this.expressao();
        this.consumirOperador("..", ".. (intervalo de dimensão)");
        const ate = this.expressao();
        saida.push({ de: de, ate: ate });
        if (this.ehOperador(",")) {
          this.avancar();
          continue;
        }
        break;
      }
      this.consumirOperador("]");
      return saida;
    }

    // ------------------------------------------------------------ statements

    /** Sequência de comandos até um terminador ou fim de tokens. */
    blocos(terminadores) {
      const comandos = [];
      while (this.atual().tipo !== T.FIM) {
        const t = this.atual();
        if (t.tipo === T.PALAVRA_CHAVE && terminadores.indexOf(t.valor) >= 0) break;
        comandos.push(this.comando());
      }
      return comandos;
    }

    comando() {
      const t = this.atual();

      if (t.tipo === T.PONTO_E_VIRGULA) {
        this.avancar();
        return null;
      }
      if (t.tipo !== T.PALAVRA_CHAVE && t.tipo !== T.IDENTIFICADOR) {
        this.erro("SINTESE_ESPERADO", "Esperado um comando, encontrado '" + this.descrever(t) + "'", t);
      }

      if (t.tipo === T.PALAVRA_CHAVE && COMANDOS.indexOf(t.valor) >= 0) {
        switch (t.valor) {
          case "se": return this.cmdSe();
          case "enquanto": return this.cmdEnquanto();
          case "repita": return this.cmdRepita();
          case "para": return this.cmdPara();
          case "escreva": return this.cmdEscreva(false);
          case "escreval": return this.cmdEscreva(true);
          case "leia": return this.cmdLeia();
          case "escolha": return this.cmdEscolha();
          case "interrompa": {
            this.avancar();
            return N.interrompa(this.posicao(t));
          }
          case "retorne": {
            this.avancar();
            const valor = this.ehFimDeBloco() ? null : this.expressao();
            return N.retorne(valor, this.posicao(t));
          }
        }
      }

      // Identificador (ou palavra-chave usada como nome, como `inicio <- 5`):
      // atribuição, alvo indexado ou chamada de procedimento.
      //
      // §31–§39 — antes disso, o comando de extensão. A consulta é feita AQUI,
      // no instante do parse, e não no topo do arquivo: `extensions.js` é
      // carregado DEPOIS do parser (a ordem é contrato de `carga.mjs`) e só
      // existe quando todos os scripts já rodaram.
      const ext = this.extensaoDe(t);
      if (ext) return this.cmdExtensao(t, ext);

      if (!this.ehNomeDeAlvo()) {
        this.erro("SINTESE_ESPERADO", "Esperado um comando, encontrado '" + this.descrever(t) + "'", t);
      }
      const nome = this.avancar();
      const rotulo = this.nomeDe(nome);
      if (this.ehAtribuicao()) {
        this.avancar();
        const alvo = N.identificador(rotulo, this.posicao(nome));
        return N.atribuicao(alvo, this.expressao(), this.posicao(nome));
      }
      if (this.ehOperador("[")) {
        const alvo = this.comIndices(N.identificador(rotulo, this.posicao(nome)));
        if (!this.ehAtribuicao()) {
          this.erro("SINTESE_ESPERADO", "Esperado '<-' ou ':=' após o alvo indexado '" + rotulo + "'");
        }
        this.avancar();
        return N.atribuicao(alvo, this.expressao(), this.posicao(nome));
      }
      if (this.ehOperador("(")) {
        return N.expressao(this.chamada(rotulo, this.posicao(nome)), this.posicao(nome));
      }
      this.erro(
        "SINTESE_ESPERADO",
        "Esperado '<-' ou ':=' após '" + rotulo + "', encontrado '" + this.descrever(this.atual()) + "'",
        nome
      );
    }

    // ------------------------------------------------------- §31–§39 extensões

    /**
     * O token atual inicia um comando de extensão?
     *
     * Devolve a DESCRIÇÃO do comando (`VG.Extensoes.comandos[chave]`) ou `null`.
     * A chave é a forma sem acento em minúsculas, a mesma de
     * `Tokens.chaveDe`, e é o que permite `ESCREVER` (identificador) e
     * `limpatela` (palavra-chave) passarem pelo MESMO caminho.
     *
     * A guarda de atribuição é o que impede a extensão de sequestrar programa
     * que usa o nome como variável: `eco <- 1` é atribuição, porque o token
     * SEGUINTE é `<-`, e não o comando `eco`. Sem ela, `fim` e `nome` — que são
     * nomes de variável no corpus dos 95 exercícios — deixariam de funcionar.
     * A guarda olha `proximo()` e não `atual()` porque `t` É o token atual: o
     * `<-` é o de baixo dele.
     */
    extensaoDe(t) {
      const X = VG.Extensoes;
      if (!X || !X.comandos) return null;
      if (t.tipo !== T.PALAVRA_CHAVE && t.tipo !== T.IDENTIFICADOR) return null;
      const def = X.comandos[VG.Tokens.chaveDe(t.bruto || t.valor)];
      if (!def) return null;
      const depois = this.proximo();
      if (depois.tipo === T.ATRIBUICAO) return null;
      return def;
    }

    /** `limpatela`, `aleatorio 1,10`, `ESCREVER("linha")`, `mudacor("A","F")`. */
    cmdExtensao(t, def) {
      this.avancar();
      const argumentos = this.argumentosDeExtensao(def.forma);
      if (argumentos === null) {
        this.erro("SINTESE_ESPERADO", "Esperado " + (def.ajuda || ("argumentos de '" + def.nome + "'")), t);
      }
      // `comando` é a CHAVE canônica em minúsculas (é o que o runtime procura em
      // `VG.Extensoes.comandos`); `grafia` é o nome como o aluno escreveu, para a
      // UI exibir `ESCREVER` e não `escrever`.
      return N.extensao(VG.Tokens.chaveDe(def.nome), argumentos, this.posicao(t), def.nome);
    }

    /**
     * Lê os argumentos do comando de extensão segundo a FORMA que o módulo
     * declarou. Devolve `null` quando a forma exige argumento e não veio, para
     * o chamador acusar erro de sintaxe com a ajuda do comando.
     *
     * A forma "solta" (sem parênteses) é a parte delicada: `aleatorio` na linha
     * de cima de `x <- 1` não pode engolir o `x`. Por isso o argumento é lido
     * em speculativo e DESFEITO quando o token seguinte é `<-`/`:=`, porque isso
     * prova que o identificador lido era o alvo do comando seguinte.
     */
    argumentosDeExtensao(forma) {
      if (forma === "nenhuma") return [];

      // Forma entre parênteses, o padrão do VisuAlg 3.x: `mudacor("AMARELO", "FRENTE")`.
      if (this.ehOperador("(")) {
        this.avancar();
        const lista = [];
        if (!this.ehOperador(")")) {
          while (true) {
            lista.push(this.expressao());
            if (this.ehOperador(",")) {
              this.avancar();
              continue;
            }
            break;
          }
        }
        this.consumirOperador(")");
        return lista;
      }

      // `eco on` / `aleatorio off` / `cronometro on`.
      if (this.ehLigaDesliga()) {
        const tok = this.avancar();
        return [N.literal(VG.Tokens.chaveDe(tok.bruto || tok.valor) === "on", "lógico", this.posicao(tok))];
      }
      if (forma === "liga") return [];
      if (!this.iniciaValorSolto()) return forma === "expressao" ? null : [];

      const marco = this.pos;
      const lista = [this.expressao()];
      while (this.ehOperador(",")) {
        const marcoLista = this.pos;
        this.avancar();
        if (!this.iniciaValorSolto()) {
          this.pos = marcoLista;
          break;
        }
        lista.push(this.expressao());
      }
      if (this.ehAtribuicao()) {
        this.pos = marco;
        return forma === "expressao" ? null : [];
      }
      if (forma === "expressao" && lista.length !== 1) return null;
      return lista;
    }

    /** `on`/`off` soltos, que não são palavra-chave de propósito (ver tokens.js). */
    ehLigaDesliga() {
      const t = this.atual();
      if (t.tipo !== T.IDENTIFICADOR && t.tipo !== T.PALAVRA_CHAVE) return false;
      const chave = VG.Tokens.chaveDe(t.bruto || t.valor);
      return chave === "on" || chave === "off";
    }

    /**
     * O token atual pode iniciar um argumento SEM parênteses?
     *
     * Número, texto e `(` são sempre sim. Identificador é sim, exceto quando é
     * palavra-chave da linguagem ou builtin registrado: `ESCREVER` seguido de
     * `escreva("x")` engoliria a linha seguinte se `escreva` contasse como
     * valor, e `ESCREVER` seguido de `sen(30)` engoliria a chamada.
     */
    iniciaValorSolto() {
      const t = this.atual();
      if (t.tipo === T.NUMERO || t.tipo === T.TEXTO) return true;
      if (this.ehOperador("(")) return true;
      if (t.tipo !== T.IDENTIFICADOR) return false;
      const chave = VG.Tokens.chaveDe(t.valor);
      if (VG.Tokens.palavraChaveDe(t.valor) !== null) return false;
      const registros = W.Vg ? W.Vg.registros : null;
      if (registros && typeof registros === "object" && registros[chave] !== undefined) return false;
      return true;
    }

    ehFimDeBloco() {
      const t = this.atual();
      return (
        t.tipo === T.FIM ||
        (t.tipo === T.PALAVRA_CHAVE &&
          ["fimalgoritmo", "fimse", "senao", "fimenquanto", "até", "fimpara", "fimescolha", "fimfunção",
           "fimprocedimento", "outrocaso", "caso"].indexOf(t.valor) >= 0)
      );
    }

    cmdSe() {
      const t = this.avancar();
      const condicao = this.expressao();
      this.consumirPalavra("então", "então");
      const entao = this.blocos(["senão", "fimse", "fimalgoritmo"]);
      let senao = null;
      if (this.ehPalavra("senão")) {
        this.avancar();
        senao = this.blocos(["fimse", "fimalgoritmo"]);
      }
      this.consumirPalavra("fimse", "fimse");
      return N.se(condicao, entao, senao, this.posicao(t));
    }

    cmdEnquanto() {
      const t = this.avancar();
      const condicao = this.expressao();
      this.consumirPalavra("faça", "faça");
      const corpo = this.blocos(["fimenquanto", "fimalgoritmo"]);
      this.consumirPalavra("fimenquanto", "fimenquanto");
      return N.enquanto(condicao, corpo, this.posicao(t));
    }

    cmdRepita() {
      const t = this.avancar();
      const corpo = this.blocos(["até", "fimalgoritmo"]);
      this.consumirPalavra("até", "até");
      const condicao = this.expressao();
      return N.repita(corpo, condicao, this.posicao(t));
    }

    cmdPara() {
      const t = this.avancar();
      if (!this.ehNomeDeAlvo()) {
        this.erro("SINTESE_ESPERADO", "Esperado o nome da variável no laço 'para'");
      }
      const nome = this.avancar();
      const rotulo = this.nomeDe(nome);
      this.consumirPalavra("de", "de");
      const de = this.expressao();
      this.consumirPalavra("até", "até");
      const ate = this.expressao();
      let passo = null;
      if (this.ehPalavra("passo")) {
        // §15 — `passo 0` NÃO é erro de sintaxe. A sintaxe é válida; a
        // semântica é que não. O parser antigo (e a primeira versão deste)
        // lançava aqui, o que classificava errado e proibia o analisador
        // semântico de ser a autoridade. A validação vive em `semantic.js` com
        // o código INVALID_LOOP_STEP, e o runtime barra o caso dinâmico.
        this.avancar();
        passo = this.expressao();
      }
      this.consumirPalavra("faça", "faça");
      const corpo = this.blocos(["fimpara", "fimalgoritmo"]);
      this.consumirPalavra("fimpara", "fimpara");
      return N.para(N.identificador(rotulo, this.posicao(nome)), de, ate, passo, corpo, this.posicao(t));
    }

    cmdEscreva(comQuebra) {
      const t = this.avancar();
      this.consumirOperador("(");
      const argumentos = [];
      if (!this.ehOperador(")")) {
        while (true) {
          argumentos.push(this.argumento());
          if (this.ehOperador(",")) {
            this.avancar();
            continue;
          }
          break;
        }
      }
      this.consumirOperador(")");
      return N.escrever(argumentos, comQuebra, this.posicao(t));
    }

    /** Argumento de `escreva`, com o especificador `:N` ou `:N:M` da §17. */
    argumento() {
      const t = this.atual();
      const expr = this.expressao();
      let largura = null;
      let casas = null;
      while (this.ehOperador(":") && this.proximo().tipo === T.NUMERO) {
        this.avancar();
        const n = this.avancar().valor;
        if (largura === null) largura = n;
        else casas = n;
      }
      return N.arg(expr, largura, casas, this.posicao(t));
    }

    cmdLeia() {
      const t = this.avancar();
      this.consumirOperador("(");
      const alvos = [];
      while (true) {
        if (!this.ehNomeDeAlvo()) {
          this.erro("SINTESE_ESPERADO", "Esperado o nome da variável em 'leia'");
        }
        const tokAlvo = this.avancar();
        const rotulo = this.nomeDe(tokAlvo);
        const alvo = this.ehOperador("[")
          ? this.comIndices(N.identificador(rotulo, this.posicao(tokAlvo)))
          : N.identificador(rotulo, this.posicao(tokAlvo));
        alvos.push(alvo);
        if (this.ehOperador(",")) {
          this.avancar();
          continue;
        }
        break;
      }
      this.consumirOperador(")");
      return N.ler(alvos, this.posicao(t));
    }

    /**
     * §18 — `escolha`. Sem `break` implícito, ao contrário do VisuAlg clássico:
     * a §601 do spec diz para não alterar a semântica, e cair para o próximo
     * `caso` depois de executar um seria exatamente isso. O corpo do `caso` tem
     * de terminar em `interrompa` quando quiser sair.
     *
     * Também aceita `caso 1, 2, 3` e o intervalo `caso 1 ate 5` da linha 3.x.
     */
    cmdEscolha() {
      const t = this.avancar();
      const seletor = this.expressao();
      const casos = [];
      let outrocaso = null;
      while (true) {
        if (this.ehPalavra("caso")) {
          const tokCaso = this.avancar();
          const valores = [];
          while (true) {
            // O `até` do intervalo é verificado DEPOIS do valor, senão
            // `caso 4 ate 6` deixaria o `até` solto e o parser cairia em
            // `comando()`.
            const primeiro = this.expressao();
            if (this.ehPalavra("até")) {
              this.avancar();
              valores.push({ de: primeiro, ate: this.expressao(), intervalo: true });
            } else {
              valores.push(primeiro);
            }
            if (this.ehOperador(",")) {
              this.avancar();
              continue;
            }
            break;
          }
          const corpo = this.blocos(["caso", "outrocaso", "fimescolha", "fimalgoritmo"]);
          casos.push(N.casoClausula(valores, corpo, this.posicao(tokCaso)));
          continue;
        }
        if (this.ehPalavra("outrocaso")) {
          const tok = this.avancar();
          const corpo = this.blocos(["caso", "fimescolha", "fimalgoritmo"]);
          if (outrocaso) this.erro("SINTESE_TOKEN_INESPERADO", "Segundo 'outrocaso' no mesmo 'escolha'", tok);
          outrocaso = N.outrocasoClausula(corpo, this.posicao(tok));
          continue;
        }
        break;
      }
      this.consumirPalavra("fimescolha", "fimescolha");
      return N.escolha(seletor, casos, outrocaso, this.posicao(t));
    }

    // ----------------------------------------------------------- subprogramas

    subprogramas() {
      const saida = [];
      while (this.ehPalavra("função") || this.ehPalavra("procedimento")) {
        saida.push(this.ehPalavra("função") ? this.declaracaoFuncao() : this.declaracaoProcedimento());
      }
      return saida;
    }

    assinatura(rotulo) {
      const t = this.atual();
      if (!this.ehNomeDeAlvo()) {
        this.erro("SINTESE_ESPERADO", "Esperado o nome da " + rotulo);
      }
      const nome = this.nomeDe(this.avancar());
      const parametros = [];
      if (this.ehOperador("(")) {
        this.avancar();
        // §25 — `;` separa o grupo por valor do grupo `var` (por referência).
        let porReferencia = false;
        while (!this.ehOperador(")")) {
          if (this.ehPalavra("var")) {
            this.avancar();
            porReferencia = true;
            continue;
          }
          // §23 — `funcao soma(a, b: inteiro)`: o tipo vale para o grupo inteiro
          // de nomes, não só para o último. Por isso os nomes são lidos todos
          // primeiro e o tipo é aplicado depois ao grupo.
          const grupo = [];
          while (true) {
            if (!this.ehNomeDeAlvo()) {
              this.erro("SINTESE_ESPERADO", "Esperado o nome de um parâmetro de " + rotulo);
            }
            const tokNome = this.avancar();
            grupo.push({ nome: this.nomeDe(tokNome), pos: this.posicao(tokNome) });
            if (this.ehOperador(",")) {
              this.avancar();
              continue;
            }
            break;
          }
          let tipo = null;
          let dimensoes = [];
          if (this.ehOperador(":")) {
            this.avancar();
            const tipoTok = this.atual();
            if (tipoTok.tipo !== T.PALAVRA_CHAVE) {
              this.erro("SINTESE_ESPERADO", "Esperado o tipo do parâmetro '" + grupo[0].nome + "'");
            }
            this.avancar();
            if (tipoTok.valor === "vetor" || tipoTok.valor === "matriz") {
              dimensoes = this.dimensoes();
              this.consumirPalavra("de", "de (antes do tipo do elemento)");
              const elem = this.avancar();
              tipo = dimensoes.length > 1 ? "matriz" : "vetor";
              if (!elem || !VG.Tokens.ehTipo(elem.valor)) {
                this.erro("SINTESE_ESPERADO", "Esperado o tipo do elemento do vetor/matriz");
              }
            } else if (VG.Tokens.ehTipo(tipoTok.valor)) {
              tipo = tipoTok.valor;
            } else {
              this.erro("SINTESE_ESPERADO", "Tipo inválido: '" + tipoTok.valor + "'", tipoTok);
            }
          }
          for (const g of grupo) {
            parametros.push(N.parametro(g.nome, tipo, dimensoes, porReferencia, g.pos));
          }
          if (this.ehOperador(";")) {
            this.avancar();
            porReferencia = false;
            continue;
          }
          break;
        }
        this.consumirOperador(")");
      }
      return { nome, parametros, pos: this.posicao(t) };
    }

    corpoDeSubprograma(terminador) {
      // O spec mostra `inicio` dentro de função e procedimento; o VisuAlg original
      // dispensa. Aceitar os dois evita quebrar programa copiado de uma ou outra.
      if (this.ehPalavra("início")) this.avancar();
      const corpo = this.blocos([terminador]);
      this.consumirPalavra(terminador, terminador);
      return corpo;
    }

    declaracaoFuncao() {
      const t = this.avancar();
      const { nome, parametros, pos } = this.assinatura("função");
      let retorno = null;
      if (this.ehOperador(":")) {
        this.avancar();
        const rt = this.atual();
        if (rt.tipo !== T.PALAVRA_CHAVE || !VG.Tokens.ehTipo(rt.valor)) {
          this.erro("SINTESE_ESPERADO", "Esperado o tipo de retorno da função '" + nome + "'");
        }
        this.avancar();
        retorno = rt.valor;
      }
      const corpo = this.corpoDeSubprograma("fimfunção");
      return N.funcao(nome, parametros, retorno, corpo, pos || this.posicao(t));
    }

    declaracaoProcedimento() {
      this.avancar();
      const { nome, parametros, pos } = this.assinatura("procedimento");
      const corpo = this.corpoDeSubprograma("fimprocedimento");
      return N.procedimento(nome, parametros, corpo, pos);
    }

    // ----------------------------------------------------------- expressões

    // Níveis da §13, do mais solto ao mais forte.
    expressao() { return this.nivelXou(); }
    nivelXou() {
      let e = this.nivelOu();
      while (this.ehPalavra("xou")) {
        const op = this.avancar();
        e = N.binario("xou", e, this.nivelOu(), this.posicao(op));
      }
      return e;
    }
    nivelOu() {
      let e = this.nivelE();
      while (this.ehPalavra("ou")) {
        const op = this.avancar();
        e = N.binario("ou", e, this.nivelE(), this.posicao(op));
      }
      return e;
    }
    nivelE() {
      let e = this.nivelNao();
      while (this.ehPalavra("e")) {
        const op = this.avancar();
        e = N.binario("e", e, this.nivelNao(), this.posicao(op));
      }
      return e;
    }
    nivelNao() {
      if (this.ehPalavra("não")) {
        const op = this.avancar();
        return N.unario("não", this.nivelNao(), this.posicao(op));
      }
      return this.nivelRelacional();
    }
    nivelRelacional() {
      let e = this.nivelAditivo();
      while (this.atual().tipo === T.OPERADOR && RELACIONAIS.indexOf(this.atual().valor) >= 0) {
        const op = this.avancar();
        e = N.binario(op.valor, e, this.nivelAditivo(), this.posicao(op));
      }
      return e;
    }
    nivelAditivo() {
      let e = this.nivelMultiplicativo();
      while (this.ehOperador("+") || this.ehOperador("-")) {
        const op = this.avancar();
        e = N.binario(op.valor, e, this.nivelMultiplicativo(), this.posicao(op));
      }
      return e;
    }
    nivelMultiplicativo() {
      let e = this.nivelPotencia();
      while (true) {
        const t = this.atual();
        let simbolo = null;
        if (t.tipo === T.OPERADOR && (t.valor === "*" || t.valor === "/" || t.valor === "%" || t.valor === "\\")) {
          simbolo = t.valor === "\\" ? "\\" : t.valor;
        } else if (t.tipo === T.PALAVRA_CHAVE && (t.valor === "div" || t.valor === "mod")) {
          simbolo = AGLUTINANTES[t.valor];
        }
        if (simbolo === null) break;
        const op = this.avancar();
        e = N.binario(simbolo, e, this.nivelPotencia(), this.posicao(op));
      }
      return e;
    }
    nivelPotencia() {
      const esq = this.nivelUnario();
      if (this.ehOperador("^")) {
        const op = this.avancar();
        // recursão à direita: 2^3^2 = 2^(3^2), e 2^-3 continua válido
        return N.binario("^", esq, this.nivelPotencia(), this.posicao(op));
      }
      return esq;
    }
    nivelUnario() {
      if (this.ehOperador("-") || this.ehOperador("+")) {
        const op = this.avancar();
        return N.unario(op.valor, this.nivelUnario(), this.posicao(op));
      }
      return this.primario();
    }

    /** Aplicar `[...]` a um alvo, se houver. */
    comIndices(alvo) {
      if (!this.ehOperador("[")) return alvo;
      this.avancar();
      const indices = [];
      while (true) {
        indices.push(this.expressao());
        if (this.ehOperador(",")) {
          this.avancar();
          continue;
        }
        break;
      }
      this.consumirOperador("]");
      return N.indice(alvo, indices, alvo);
    }

    chamada(nome, pos) {
      this.consumirOperador("(");
      const argumentos = [];
      if (!this.ehOperador(")")) {
        while (true) {
          argumentos.push(this.expressao());
          if (this.ehOperador(",")) {
            this.avancar();
            continue;
          }
          break;
        }
      }
      this.consumirOperador(")");
      return { tipo: "chamada", nome: nome, argumentos: argumentos, linha: pos.linha, coluna: pos.coluna };
    }

    primario() {
      const t = this.atual();

      if (t.tipo === T.NUMERO) {
        this.avancar();
        return N.literal(t.valor, t.inteiro ? "inteiro" : "real", this.posicao(t));
      }
      if (t.tipo === T.TEXTO) {
        this.avancar();
        return N.literal(t.valor, "literal", this.posicao(t));
      }
      if (t.tipo === T.PALAVRA_CHAVE) {
        if (t.valor === "verdadeiro" || t.valor === "falso") {
          this.avancar();
          return N.literal(t.valor === "verdadeiro", "lógico", this.posicao(t));
        }
        // Palavra-chave lida como variável. Só `verdadeiro`/`falso` começam
        // expressão de verdade, então qualquer outra aqui é nome — necessário
        // para `faccat/ex21.alg`, que usa `inicio` como variável. Erro de digitação
        // em palavra-chave não gera mais mensagem própria, mas a análise semântica
        // (onda 6) acusa nome não declarado.
        this.avancar();
        const rotulo = this.nomeDe(t);
        const nome = N.identificador(rotulo, this.posicao(t));
        if (this.ehOperador("(")) return this.chamada(rotulo, this.posicao(t));
        return this.comIndices(nome);
      }
      if (this.ehOperador("(")) {
        this.avancar();
        const e = this.expressao();
        this.consumirOperador(")");
        return e;
      }
      if (t.tipo === T.IDENTIFICADOR) {
        this.avancar();
        const nome = N.identificador(t.valor, this.posicao(t));
        if (this.ehOperador("(")) {
          return this.chamada(t.valor, this.posicao(t));
        }
        return this.comIndices(nome);
      }

      this.erro("SINTESE_TOKEN_INESPERADO", "Expressão inválida perto de '" + this.descrever(t) + "'", t);
    }
  }

  VG.Parser = Parser;
})(W.VG);
