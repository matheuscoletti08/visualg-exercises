Algoritmo "ex33"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 2 valores, escrever se iguais, primeiro maior ou segundo maior.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real

Inicio
   escreval("Digite o primeiro valor: ")
   leia(a)
   escreval("Digite o segundo valor: ")
   leia(b)
   se (a = b) entao
      escreval("Numeros iguais")
   senao
      se (a > b) entao
         escreval("Primeiro maior")
      senao
         escreval("Segundo maior")
      fimse
   fimse
Fimalgoritmo