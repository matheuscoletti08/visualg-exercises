Algoritmo "ex50_C"
// Professor   : Jailson Costa dos Santos
// Descricao   : Apresentar numeros divisiveis por 4 menores que 200.
// Autor(a)    : Matheus Coletti
Var
   i: inteiro

Inicio
   i <- 1
   repita
      se (i % 4 = 0) entao
         escreval(i)
      fimse
      i <- i + 1
   ate (i > 200)
Fimalgoritmo