Algoritmo "ex50_G"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar fatorial dos impares de 1 a 10.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   j: inteiro
   fatorial: inteiro

Inicio
   i <- 1
   repita
      se (i % 2 <> 0) entao
         fatorial <- 1
         j <- 1
         repita
            fatorial <- fatorial * j
            j <- j + 1
         ate (j > i)
         escreval(i, "! = ", fatorial)
      fimse
      i <- i + 1
   ate (i > 10)
Fimalgoritmo