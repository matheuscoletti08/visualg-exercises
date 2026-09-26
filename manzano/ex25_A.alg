Algoritmo "ex25_A"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler uma temperatura em graus Celsius e apresenta-la convertida em graus Fahrenheit. Formula: F = (9 * C + 160) / 5.
// Autor(a)    : Matheus Coletti
Var
   celsius: real
   fahrenheit: real

Inicio
   escreval("Digite a temperatura em Celsius: ")
   leia(celsius)
   fahrenheit <- (9 * celsius + 160) / 5
   escreval("Temperatura em Fahrenheit: ", fahrenheit:4:2)
Fimalgoritmo