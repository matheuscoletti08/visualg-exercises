Algoritmo "ex66_I"
// Professor   : Jailson Costa dos Santos
// Descricao   : Serie de Fibonacci ate 15o termo (usando PARA).
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
   para i de 3 ate 15 faca
      c <- a + b
      escreval(c)
      a <- b
      b <- c
   fimpara
Fimalgoritmo