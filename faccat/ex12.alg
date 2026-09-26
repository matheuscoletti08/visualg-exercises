Algoritmo "ex12"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler temperatura em Fahrenheit, calcular Celsius ((f-32)*5/9)
// Autor(a)    : Matheus Coletti
Var
   fahrenheit: real
   celsius: real

Inicio
   escreval("Informe temperatura Fahrenheit: ")
   leia(fahrenheit)
   
   celsius <- (fahrenheit - 32) * 5 / 9
   
   escreval("Em Celsius: ", celsius)
Fimalgoritmo