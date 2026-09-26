Algoritmo "ex66_K"
// Professor   : Jailson Costa dos Santos
// Descricao   : Fatorial dos impares de 1 a 10 (usando PARA).
// Autor(a)    : Matheus Coletti
Var
   i: inteiro
   j: inteiro
   fatorial: inteiro

Inicio
   para i de 1 ate 10 faca
      se (i % 2 <> 0) entao
         fatorial <- 1
         para j de 1 ate i faca
            fatorial <- fatorial * j
         fimpara
         escreval(i, "! = ", fatorial)
      fimse
   fimpara
Fimalgoritmo