Algoritmo "ex27"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler um valor e escrever se e positivo, negativo ou zero.
// Autor(a)    : Matheus Coletti
Var
   valor: real

Inicio
   escreval("Digite um valor: ")
   leia(valor)
   se (valor > 0) entao
      escreval("POSITIVO")
   senao
      se (valor < 0) entao
         escreval("NEGATIVO")
      senao
         escreval("ZERO")
      fimse
   fimse
Fimalgoritmo