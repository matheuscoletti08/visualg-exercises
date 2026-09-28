// Agregador da engine — `W.Vg`.
//
// Este é o ÚNICO ponto que a UI conhece. Todo o resto se registra em `W.VG`, e
// este arquivo decide o que é público. Assim, renomear algo internamente não
// quebra o `script.js`, e o `tools/verificar-carga.mjs` garante que este arquivo
// seja sempre o último da engine antes da UI.
//
// Compatibilidade: `W.Vg.executar(codigo, opcoes)` mantém a assinatura que o
// `script.js` e o `tools/testar.mjs` já usavam, agora servida pela engine nova.
var W = typeof window !== "undefined" ? window : globalThis;

// `W.Vg` precisa existir antes de qualquer escrita. Quem criava esse objeto era o
// `interpreter/interpreter.js` antigo, que saiu do contrato de carga na onda 5.
W.Vg = W.Vg || {};

(function (VG) {
  "use strict";

  const publico = {
    // §58 — pipeline
    analisar: VG.Api.analisar,
    parse: VG.Api.analisar,
    criarRuntime: VG.Api.criarRuntime,
    criarExecucao: VG.Api.criarExecucao,
    executar: VG.Api.executar,
    run: VG.Api.executar,

    // §35 — estados
    ESTADO: VG.Scheduler.ESTADO,
    ErroDeUso: VG.Api.ErroDeUso,

    // §46 — diagnóstico (o playground formata a mensagem a partir daqui)
    Diagnostics: VG.Diagnostics,
    ErroVisualG: VG.Diagnostics.ErroVisualG,
    ErroLexico: VG.Diagnostics.ErroLexico,
    ErroSintaxe: VG.Diagnostics.ErroSintaxe,
    ErroTipo: VG.Diagnostics.ErroTipo,
    ErroRuntime: VG.Diagnostics.ErroRuntime,
    ErroTempo: VG.Diagnostics.ErroTempo,

    // Úteis para UI, testes e profiler
    Lexer: VG.Lexer,
    Parser: VG.Parser,
    Tokens: VG.Tokens,
    Ast: VG.Ast,
    Values: VG.Values,
    Environment: VG.Environment,
    Runtime: VG.Runtime,
    Scheduler: VG.Scheduler,

    // Registrados em onda por onda conforme os módulos entram na carga
    Semantica: VG.Semantica,
    Math: VG.StdlibMath,
    String: VG.StdlibString,
    Extensoes: VG.Extensoes,
  };

  // Só publica o que existe de fato, para não prometer módulo que ainda não veio.
  for (const chave of Object.keys(publico)) {
    if (publico[chave] !== undefined) {
      W.Vg[chave] = publico[chave];
    }
  }

  W.Vg.registros = W.Vg.registros || {};

  /**
   * Reúne os builtins num registro único.
   *
   * §29.4 torna os nomes reservados, e o runtime procura por `nome.toLowerCase()`.
   * A ordem de mesclagem importa: se dois módulos registrassem o mesmo nome, o
   * último venceria silenciosamente. Com a checagem abaixo, a colisão vira erro
   * de carga visível em vez de comportamento dependente de ordem.
   *
   * Precisa rodar DEPOIS de `W.Vg.registros` existir — daí estar aqui e não
   * junto da declaração de `publico`.
   */
  const REGISTROS = [];
  for (const mod of [VG.StdlibMath, VG.StdlibString, VG.Extensoes]) {
    if (mod && mod.registro) REGISTROS.push(mod);
  }
  for (const mod of REGISTROS) {
    for (const nome of Object.keys(mod.registro)) {
      if (W.Vg.registros[nome] !== undefined) {
        console.error("⚠️  builtin duplicado no registro: '" + nome + "'");
      }
      W.Vg.registros[nome] = mod.registro[nome];
    }
  }
  W.Vg.builtins = REGISTROS.map((m) => m.nomes || []);

  /** Versão do engine, útil para o painel de diagnóstico da UI. */
  W.Vg.versao = "2.0";
})(W.VG);
