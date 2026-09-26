Algoritmo "ex26_A"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler quatro valores inteiros A, B, C e D. Apresentar o produto do primeiro pelo terceiro e a soma do segundo com o quarto.
// Autor(a)    : Matheus Coletti
Var
   a: inteiro
   b: inteiro
   c: inteiro
   d: inteiro
   p: inteiro
   s: inteiro

Inicio
   escreval("Valor A: ")
   leia(a)
   escreval("Valor B: ")
   leia(b)
   escreval("Valor C: ")
   leia(c)
   escreval("Valor D: ")
   leia(d)

   p <- a * c
   s <- b + d

   escreval("Produto (A * C): ", p)
   escreval("Soma (B + D): ", s)
Fimalgoritmo
