Algoritmo "ex20"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler dois valores e ordena-los em ordem crescente.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   temp: real

Inicio
   escreval("Informe o valor de A: ")
   leia(a)
   escreval("Informe o valor de B: ")
   leia(b)
   se (a > b) entao
      temp <- a
      a <- b
      b <- temp
   fimse
   escreval("Valores em ordem crescente: ", a, " ", b)
Fimalgoritmo