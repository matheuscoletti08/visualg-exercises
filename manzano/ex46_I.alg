Algoritmo "ex46_I"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 10 valores e apresentar somatorio e media aritmetica.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   valor: real
   soma: real
   media: real

Inicio
   soma <- 0
   i <- 1
   enquanto (i <= 10) faca
      escreval("Digite o valor ", i, ": ")
      leia(valor)
      soma <- soma + valor
      i <- i + 1
   fimenquanto
   media <- soma / 10
   escreval("Somatorio: ", soma)
   escreval("Media aritmetica: ", media)
Fimalgoritmo