Algoritmo "ex26_F"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler horas, minutos e segundos de um intervalo de tempo e apresentar o total de segundos.
// Autor(a)    : Matheus Coletti
Var
   horas: inteiro
   minutos: inteiro
   segundos: inteiro
   total_segundos: inteiro

Inicio
   escreval("Digite a quantidade de horas: ")
   leia(horas)
   escreval("Digite a quantidade de minutos: ")
   leia(minutos)
   escreval("Digite a quantidade de segundos: ")
   leia(segundos)
   total_segundos <- (horas * 3600) + (minutos * 60) + segundos
   escreval("Total de segundos: ", total_segundos)
Fimalgoritmo
