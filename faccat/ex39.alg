Algoritmo "ex39"
// Professor   : Jailson Costa dos Santos
// Descricao   : Para A=V, B=V, C=F, avaliar expressoes logicas: a) (A e B) ou (A xou B), b) (A ou B) e (A e C), c) A ou C e B xou A e nao B.
// Autor(a)    : Matheus Coletti
Var
   a: logico
   b: logico
   c: logico
   res_a: logico
   res_b: logico
   res_c: logico

Inicio
   a <- verdadeiro
   b <- verdadeiro
   c <- falso
   res_a <- (a e b) ou (a <> b)
   res_b <- (a ou b) e (a e c)
   res_c <- a ou c e b <> a e (nao b)
   escreval("a) (A e B) ou (A xou B) = ", res_a)
   escreval("b) (A ou B) e (A e C) = ", res_b)
   escreval("c) A ou C e B xou A e nao B = ", res_c)
Fimalgoritmo