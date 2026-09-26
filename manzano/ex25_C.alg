Algoritmo "ex25_C"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular e apresentar o volume de uma lata de oleo, utilizando a formula: Volume = pi * Raio^2 * Altura.
// Autor(a)    : Matheus Coletti
Var
   raio: real
   altura: real
   volume: real

Inicio
   escreval("Digite o raio da lata: ")
   leia(raio)
   escreval("Digite a altura da lata: ")
   leia(altura)
   volume <- 3.14159 * (raio ^ 2) * altura
   escreval("Volume da lata: ", volume:4:2)
Fimalgoritmo