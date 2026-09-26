Algoritmo "ex10"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler custo de fábrica, calcular custo final com 28% distribuidor + 45% impostos
// Autor(a)    : Matheus Coletti
Var
   custo_fabrica: real
   custo_final: real

Inicio
   escreval("Custo de fabrica: ")
   leia(custo_fabrica)
   
   custo_final <- custo_fabrica + (custo_fabrica * 0.28) + (custo_fabrica * 0.45)
   
   escreval("Custo final ao consumidor: ", custo_final)
Fimalgoritmo