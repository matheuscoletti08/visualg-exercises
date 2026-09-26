Algoritmo "ex25_G"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler quatro numeros inteiros e apresentar o resultado da adicao e multiplicacao de cada par (A com B, A com C, A com D, B com C, B com D, C com D). 6 adicoes e 6 multiplicacoes.
// Autor(a)    : Matheus Coletti
Var
   a: inteiro
   b: inteiro
   c: inteiro
   d: inteiro
   soma_ab: inteiro
   soma_ac: inteiro
   soma_ad: inteiro
   soma_bc: inteiro
   soma_bd: inteiro
   soma_cd: inteiro
   mult_ab: inteiro
   mult_ac: inteiro
   mult_ad: inteiro
   mult_bc: inteiro
   mult_bd: inteiro
   mult_cd: inteiro

Inicio
   escreval("-- Propriedade Distributiva --")
   escreval("Digite o valor de A: ")
   leia(a)
   escreval("Digite o valor de B: ")
   leia(b)
   escreval("Digite o valor de C: ")
   leia(c)
   escreval("Digite o valor de D: ")
   leia(d)
   soma_ab <- a + b
   soma_ac <- a + c
   soma_ad <- a + d
   soma_bc <- b + c
   soma_bd <- b + d
   soma_cd <- c + d
   mult_ab <- a * b
   mult_ac <- a * c
   mult_ad <- a * d
   mult_bc <- b * c
   mult_bd <- b * d
   mult_cd <- c * d
   escreval("A + B = ", soma_ab, " | A * B = ", mult_ab)
   escreval("A + C = ", soma_ac, " | A * C = ", mult_ac)
   escreval("A + D = ", soma_ad, " | A * D = ", mult_ad)
   escreval("B + C = ", soma_bc, " | B * C = ", mult_bc)
   escreval("B + D = ", soma_bd, " | B * D = ", mult_bd)
   escreval("C + D = ", soma_cd, " | C * D = ", mult_cd)
Fimalgoritmo