Algoritmo "ex25_F"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler dois valores para as variaveis A e B, efetuar a troca dos valores e apresentar os valores trocados.
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   auxiliar: real

Inicio
   escreval("-- Troca de Valores --")
   escreval("Digite o valor de A: ")
   leia(a)
   escreval("Digite o valor de B: ")
   leia(b)
   auxiliar <- a
   a <- b
   b <- auxiliar
   escreval("A = ", a, " | B = ", b)
Fimalgoritmo