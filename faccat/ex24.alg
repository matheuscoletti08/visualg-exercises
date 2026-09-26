Algoritmo "ex24"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular salario fixo + comissao. Comissao: 3% ate R$ 1500, 5% acima de R$ 1500.
// Autor(a)    : Matheus Coletti
Var
   salario_fixo: real
   valor_vendas: real
   comissao: real
   total: real

Inicio
   escreval("Informe o salario fixo: ")
   leia(salario_fixo)
   escreval("Informe o valor das vendas: ")
   leia(valor_vendas)
   se (valor_vendas <= 1500) entao
      comissao <- valor_vendas * 0.03
   senao
      comissao <- 1500 * 0.03 + (valor_vendas - 1500) * 0.05
   fimse
   total <- salario_fixo + comissao
   escreval("Total a receber: ", total)
Fimalgoritmo