Algoritmo "ex25_B"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler uma temperatura em graus Fahrenheit e apresenta-la convertida em graus Celsius. Formula: C = (F - 32) * (5/9).
// Autor(a)    : Matheus Coletti
Var
   fahrenheit: real
   celsius: real

Inicio
   escreval("Digite a temperatura em Fahrenheit: ")
   leia(fahrenheit)
   celsius <- (fahrenheit - 32) * 5 / 9
   escreval("Temperatura em Celsius: ", celsius:4:2)
Fimalgoritmo