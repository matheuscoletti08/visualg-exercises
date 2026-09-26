Algoritmo "ex25"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler salario fixo, vendas, debitos e creditos. Calcular saldo. Informar se positivo ou negativo.
// Autor(a)    : Matheus Coletti
Var
   salario_fixo: real
   vendas: real
   debitos: real
   creditos: real
   saldo: real

Inicio
   escreval("Informe o salario fixo: ")
   leia(salario_fixo)
   escreval("Informe o valor das vendas: ")
   leia(vendas)
   escreval("Informe o valor dos debitos: ")
   leia(debitos)
   escreval("Informe o valor dos creditos: ")
   leia(creditos)
   saldo <- salario_fixo - debitos + creditos
   se (saldo >= 0) entao
      escreval("Saldo positivo")
   senao
      escreval("Saldo negativo")
   fimse
Fimalgoritmo