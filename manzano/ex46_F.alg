Algoritmo "ex46_F"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar o valor de uma potencia de base qualquer elevada a expoente qualquer.
// Autor(a)    : Matheus Coletti
Var
   base: real
   expoente: inteiro
   resultado: real

Inicio
   escreval("Digite a base: ")
   leia(base)
   escreval("Digite o expoente: ")
   leia(expoente)
   resultado <- base ^ expoente
   escreval(base, " ^ ", expoente, " = ", resultado)
Fimalgoritmo