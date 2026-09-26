Algoritmo "ex26_I"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler o valor de uma compra e o valor pago pelo cliente e apresentar o troco.
// Autor(a)    : Matheus Coletti
Var
   valor_compra: real
   valor_pago: real
   troco: real

Inicio
   escreval("Digite o valor da compra: R$ ")
   leia(valor_compra)
   escreval("Digite o valor pago: R$ ")
   leia(valor_pago)
   troco <- valor_pago - valor_compra
   escreval("Valor da compra: R$", valor_compra:4:2)
   escreval("Valor pago: R$", valor_pago:4:2)
   escreval("Troco: R$", troco:4:2)
Fimalgoritmo
