Algoritmo "ex16"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler quantidade de macas. Se menor que 12, preco R$ 1,30. Senao, preco R$ 1,00. Calcular total.
// Autor(a)    : Matheus Coletti
Var
   qtd: inteiro
   preco: real
   total: real

Inicio
   escreval("Informe a quantidade de macas: ")
   leia(qtd)
   se (qtd < 12) entao
      preco <- 1.30
   senao
      preco <- 1.00
   fimse
   total <- qtd * preco
   escreval("Total a pagar: ", total)
Fimalgoritmo