Algoritmo "ex46_A"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar os resultados de uma tabuada de multiplicar (de 1 ate 10) de um numero qualquer.
// Autor(a)    : Matheus Coletti
Var
   numero: inteiro
   i: inteiro

Inicio
   escreval("Digite um numero: ")
   leia(numero)
   i <- 1
   enquanto (i <= 10) faca
      escreval(numero, " x ", i, " = ", numero * i)
      i <- i + 1
   fimenquanto
Fimalgoritmo