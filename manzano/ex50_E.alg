Algoritmo "ex50_E"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 15 valores e apresentar somatorio do fatorial de cada um.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   valor: inteiro
   j: inteiro
   fatorial: inteiro
   soma: inteiro

Inicio
   soma <- 0
   i <- 1
   repita
      escreval("Digite o valor ", i, ": ")
      leia(valor)
      fatorial <- 1
      j <- 1
      repita
         fatorial <- fatorial * j
         j <- j + 1
      ate (j > valor)
      soma <- soma + fatorial
      i <- i + 1
   ate (i > 15)
   escreval("Somatorio dos fatoriais: ", soma)
Fimalgoritmo