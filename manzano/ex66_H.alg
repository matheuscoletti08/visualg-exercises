Algoritmo "ex66_H"
// Professor   : Jailson Costa dos Santos
// Descricao   : Potencia de base qualquer elevada a expoente qualquer (PARA).
// Autor(a)    : Matheus Coletti
Var
   base: real
   expoente: inteiro
   resultado: real
   i: inteiro

Inicio
   escreval("Digite a base: ")
   leia(base)
   escreval("Digite o expoente: ")
   leia(expoente)
   resultado <- 1
   para i de 1 ate expoente faca
      resultado <- resultado * base
   fimpara
   escreval(base, " ^ ", expoente, " = ", resultado)
Fimalgoritmo