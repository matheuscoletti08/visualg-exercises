Algoritmo "ex28"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 3 valores e escrever o maior deles.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   c: real
   maior: real

Inicio
   escreval("Digite o primeiro valor: ")
   leia(a)
   escreval("Digite o segundo valor: ")
   leia(b)
   escreval("Digite o terceiro valor: ")
   leia(c)
   maior <- a
   se (b > maior) entao
      maior <- b
   fimse
   se (c > maior) entao
      maior <- c
   fimse
   escreval("O maior valor e: ", maior)
Fimalgoritmo