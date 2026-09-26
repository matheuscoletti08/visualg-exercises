Algoritmo "ex46_B"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar o total da soma obtida dos cem primeiros numeros inteiros (1+2+3+...+100).
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   soma: inteiro

Inicio
   soma <- 0
   i <- 1
   enquanto (i <= 100) faca
      soma <- soma + i
      i <- i + 1
   fimenquanto
   escreval("Soma de 1 a 100: ", soma)
Fimalgoritmo