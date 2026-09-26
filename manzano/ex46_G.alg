Algoritmo "ex46_G"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar a serie de Fibonacci ate o decimo quinto termo.
// Autor(a)    : Matheus Coletti
Var
   a: inteiro
   b: inteiro
   c: inteiro
   i: inteiro

Inicio
   a <- 1
   b <- 1
   escreval("Serie de Fibonacci:")
   escreval(a)
   escreval(b)
   i <- 3
   enquanto (i <= 15) faca
      c <- a + b
      escreval(c)
      a <- b
      b <- c
      i <- i + 1
   fimenquanto
Fimalgoritmo