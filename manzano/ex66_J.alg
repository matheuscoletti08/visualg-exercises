Algoritmo "ex66_J"
// Professor   : Jailson Costa dos Santos
// Descricao   : Conversao Celsius para Fahrenheit (10 a 100, passo 10) - PARA.
// Autor(a)    : Matheus Coletti
Var
   celsius: real
   fahrenheit: real

Inicio
   para celsius de 10 ate 100 passo 10 faca
      fahrenheit <- (9 * celsius + 160) / 5
      escreval(celsius, " C = ", fahrenheit:4:2, " F")
   fimpara
Fimalgoritmo