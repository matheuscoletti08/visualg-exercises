Algoritmo "ex46_H"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar conversao Celsius para Fahrenheit (de 10 em 10, de 10 a 100).
// Autor(a)    : Matheus Coletti
Var
   celsius: real
   fahrenheit: real

Inicio
   celsius <- 10
   enquanto (celsius <= 100) faca
      fahrenheit <- (9 * celsius + 160) / 5
      escreval(celsius, " C = ", fahrenheit:4:2, " F")
      celsius <- celsius + 10
   fimenquanto
Fimalgoritmo
