Algoritmo "ex46_J"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar soma e media dos pares de 50 a 70.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   soma: inteiro
   cont: inteiro
   media: real

Inicio
   soma <- 0
   cont <- 0
   i <- 50
   enquanto (i <= 70) faca
      se (i % 2 = 0) entao
         soma <- soma + i
         cont <- cont + 1
      fimse
      i <- i + 1
   fimenquanto
   media <- soma / cont
   escreval("Soma dos pares 50-70: ", soma)
   escreval("Media aritmetica: ", media)
Fimalgoritmo