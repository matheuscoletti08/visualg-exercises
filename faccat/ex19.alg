Algoritmo "ex19"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler dois valores e apresentar o maior deles.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   maior: real

Inicio
   escreval("Informe o valor de A: ")
   leia(a)
   escreval("Informe o valor de B: ")
   leia(b)
   se (a > b) entao
      maior <- a
   senao
      maior <- b
   fimse
   escreval("O maior valor e: ", maior)
Fimalgoritmo