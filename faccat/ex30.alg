Algoritmo "ex30"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 3 valores e escrever eles em ordem crescente.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   c: real
   temp: real

Inicio
   escreval("Digite o primeiro valor: ")
   leia(a)
   escreval("Digite o segundo valor: ")
   leia(b)
   escreval("Digite o terceiro valor: ")
   leia(c)
   se (a > b) entao
      temp <- a
      a <- b
      b <- temp
   fimse
   se (b > c) entao
      temp <- b
      b <- c
      c <- temp
   fimse
   se (a > b) entao
      temp <- a
      a <- b
      b <- temp
   fimse
   escreval("Valores em ordem crescente: ", a, ", ", b, ", ", c)
Fimalgoritmo