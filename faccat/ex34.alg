Algoritmo "ex34"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler x e y, z = (x*y)+5, se z<=0 escrever A, se z<=100 escrever B, senao C.
// Autor(a)    : Matheus Coletti
Var
   x: real
   y: real
   z: real
   resposta: literal

Inicio
   escreval("Digite o valor de x: ")
   leia(x)
   escreval("Digite o valor de y: ")
   leia(y)
   z <- (x * y) + 5
   se (z <= 0) entao
      resposta <- "A"
   senao
      se (z <= 100) entao
         resposta <- "B"
      senao
         resposta <- "C"
      fimse
   fimse
   escreval("z = ", z, ", Resposta = ", resposta)
Fimalgoritmo