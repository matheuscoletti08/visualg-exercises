// Harness de teste extraído de `tools/testar.mjs`.
//
// Antes, `testar.mjs` rodava a suíte como efeito colateral e não exportava nada
// (`process.exitCode = 1` no fim), o que impedia qualquer outro arquivo de
// reaproveitar as asserções ou de registrar testes próprios. Agora as asserções
// e o coletor de resultados vivem aqui; `testar.mjs` é só o entrypoint.

const REGUA = "-".repeat(66);
const BARRA = "=".repeat(66);

/** Serializa um valor para mensagem de erro, tolerando ciclo e BigInt. */
export function ver(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Erro de teste marcado, para distinguir falha de assert de bug no harness. */
export function falhaDeTeste(msg, obtido) {
  const e = new Error(obtido === undefined ? msg : msg + "  [obtido: " + ver(obtido) + "]");
  e.falhaDeTeste = true;
  return e;
}

export function eIgual(obtido, esperado, msg) {
  if (ver(obtido) !== ver(esperado)) {
    throw falhaDeTeste(msg + " (esperado " + ver(esperado) + ")", obtido);
  }
}

export function eVerdadeiro(cond, msg, obtido) {
  if (!cond) throw falhaDeTeste(msg, obtido);
}

export function eFalso(cond, msg, obtido) {
  if (cond) throw falhaDeTeste(msg, obtido);
}

/**
 * Coletor de resultados.
 *
 * `categoria(nome, qtd)` é só contabilidade de relatório: existe porque a
 * contagem agregada de "117 testes" era enganosa. São 1 asserção de varredura
 * de parse + 95 execuções smoke + 21 casos unitários, e o smoke reaproveita os
 * mesmos 95 arquivos já parseados na fase 1. O número agregado escondia isso.
 */
export class Suite {
  constructor({ aoLog = console.log } = {}) {
    this.aoLog = aoLog;
    this.total = 0;
    this.pass = 0;
    this.fail = 0;
    this.categorias = [];
    this.testes = [];
  }

  /** Abre um bloco de relatório. */
  secao(titulo) {
    this.aoLog("");
    this.aoLog(titulo);
    this.aoLog(REGUA);
  }

  /** Registra um resultado já decidido. */
  registrar(nome, erro) {
    this.total++;
    if (erro) {
      this.fail++;
      this.aoLog("  ❌ " + nome);
      this.aoLog("       → " + (erro.message || String(erro)));
    } else {
      this.pass++;
      this.aoLog("  ✅ " + nome);
    }
  }

  /** Registra um caso que passou, com o motivo exibido à parte. */
  registrarComNota(nome, nota) {
    this.registrar(nome, null);
    if (nota) this.aoLog("       ℹ️  " + nota);
  }

  /** Declara quantos testes uma fase contribuiu, para o resumo ser honesto. */
  categoria(nome, qtd) {
    this.categorias.push({ nome, qtd });
  }

  /** Declara um teste para rodar depois. */
  teste(nome, fn) {
    this.testes.push({ nome, fn });
  }

  /**
   * Executa todos os testes registrados via `teste()` e LIMPA a fila.
   *
   * A limpeza não é cosmética: sem ela, uma suíte com duas fases chamaria
   * `executar()` duas vezes e a segunda recontaria a primeira. Foi exatamente o
   * que aconteceu na suíte de compatibilidade, que inflou 111 em 206 sem que
   * nenhum teste falhasse — a pior forma de bug de contagem.
   *
   * Cada teste tem `timeoutMs`. Um teste que TRAVA é um teste que falhou, e
   * reportar isso é infinitamente mais útil do que deixar a suíte pendurada:
   * uma espera que nunca resolve não distingue "lento" de "preso", e o
   * `process.exit` do Node fica em 13 ("unsettled top-level await") sem dizer
   * qual dos testes foi o culpado.
   */
  async executar(timeoutMs) {
    const fila = this.testes;
    this.testes = [];
    const limite = timeoutMs || 30000;
    for (const t of fila) {
      let correndo = true;
      let relogio = null;
      try {
        await Promise.race([
          Promise.resolve().then(() => t.fn()),
          new Promise((_, reject) => {
            // SEM `unref`: um timer não referenciado deixa o Node sair assim que
            // nada mais segura o event loop, que é exatamente o caso de um teste
            // pendurado — o processo morreria com código 13 antes do timeout
            // reclamar, e o culpado continuaria desconhecido.
            relogio = setTimeout(() => {
              if (correndo) {
                reject(
                  new Error(
                    "TRAVOU: não resolveu em " + limite + "ms. " +
                    "Se o programa pausa e ninguém retoma, o `await` do `executar()` não resolve."
                  )
                );
              }
            }, limite);
          }),
        ]);
        correndo = false;
        // O relógio tem de ser DESARMADO nos dois caminhos. Pendente, ele segura
        // o event loop do Node até o timeout final: a suíte aparece terminada na
        // tela e o processo só sai 30s depois, com `testar-tudo` esperando por ele.
        clearTimeout(relogio);
        this.registrar(t.nome, null);
      } catch (e) {
        correndo = false;
        clearTimeout(relogio);
        this.registrar(t.nome, e);
      }
    }
  }

  /** Resumo agregado mais a decomposição por fase. */
  resumo() {
    const status = this.fail === 0 ? "✅" : "❌";
    const linhas = [status + " RESUMO: " + this.total + " testes | " + this.pass + " pass | " + this.fail + " fail"];
    if (this.categorias.length > 0) {
      linhas.push("        composição: " + this.categorias.map((c) => c.qtd + " " + c.nome).join(" + "));
    }
    return linhas;
  }

  /** Imprime o resumo e devolve o exit code apropriado. */
  imprimirResumo() {
    this.aoLog("");
    this.aoLog(BARRA);
    for (const l of this.resumo()) this.aoLog(l);
    this.aoLog(BARRA);
    return this.fail > 0 ? 1 : 0;
  }
}
