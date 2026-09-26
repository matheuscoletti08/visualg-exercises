Algoritmo "ex50_B"
// Professor   : Jailson Costa dos Santos
// Descricao   : Somatorio dos pares de 1 a 500.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   soma: inteiro

Inicio
   soma <- 0
   i <- 1
   repita
      se (i % 2 = 0) entao
         soma <- soma + i
      fimse
      i <- i + 1
   ate (i > 500)
   escreval("Somatorio dos pares 1-500: ", soma)
Fimalgoritmo