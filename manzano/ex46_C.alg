Algoritmo "ex46_C"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar o somatorio dos valores pares de 1 a 500.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   soma: inteiro

Inicio
   soma <- 0
   i <- 1
   enquanto (i <= 500) faca
      se (i % 2 = 0) entao
         soma <- soma + i
      fimse
      i <- i + 1
   fimenquanto
   escreval("Soma dos pares de 1 a 500: ", soma)
Fimalgoritmo