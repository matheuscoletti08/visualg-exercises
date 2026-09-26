Algoritmo "ex46_E"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar as potencias de 3 (expoente 0 a 15).
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   resultado: inteiro

Inicio
   i <- 0
   enquanto (i <= 15) faca
      resultado <- 3 ^ i
      escreval("3 ^ ", i, " = ", resultado)
      i <- i + 1
   fimenquanto
Fimalgoritmo