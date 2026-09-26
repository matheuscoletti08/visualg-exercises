Algoritmo "ex66_D"
// Professor   : Jailson Costa dos Santos
// Descricao   : Somatorio dos pares de 1 a 500 (usando PARA).
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   soma: inteiro

Inicio
   soma <- 0
   para i de 1 ate 500 faca
      se (i % 2 = 0) entao
         soma <- soma + i
      fimse
   fimpara
   escreval("Somatorio dos pares 1-500: ", soma)
Fimalgoritmo