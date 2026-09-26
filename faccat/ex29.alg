Algoritmo "ex29"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 3 valores e escrever a soma dos 2 maiores.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   c: real
   maior1: real
   maior2: real
   soma: real

Inicio
   escreval("Digite o primeiro valor: ")
   leia(a)
   escreval("Digite o segundo valor: ")
   leia(b)
   escreval("Digite o terceiro valor: ")
   leia(c)
   se (a >= b) e (a >= c) entao
      maior1 <- a
      se (b >= c) entao
         maior2 <- b
      senao
         maior2 <- c
      fimse
   senao
      se (b >= a) e (b >= c) entao
         maior1 <- b
         se (a >= c) entao
            maior2 <- a
         senao
            maior2 <- c
         fimse
      senao
         maior1 <- c
         se (a >= b) entao
            maior2 <- a
         senao
            maior2 <- b
         fimse
      fimse
   fimse
   soma <- maior1 + maior2
   escreval("A soma dos dois maiores e: ", soma)
Fimalgoritmo