Algoritmo "ex50_D"
// Professor   : Jailson Costa dos Santos
// Descricao   : Somatorio de graos no tabuleiro de xadrez (64 casas, dobrando a cada casa).
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   total: real
   graos: real

Inicio
   total <- 0
   graos <- 1
   i <- 1
   repita
      total <- total + graos
      graos <- graos * 2
      i <- i + 1
   ate (i > 64)
   escreval("Total de graos: ", total)
Fimalgoritmo