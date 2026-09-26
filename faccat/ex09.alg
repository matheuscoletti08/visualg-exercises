Algoritmo "ex09"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler salário e percentual de reajuste, calcular novo salário
// Autor(a)    : Matheus Coletti
Var
   salario: real
   percentual: real
   novo_salario: real

Inicio
   escreval("Salario atual: ")
   leia(salario)
   escreval("Percentual de reajuste: ")
   leia(percentual)
   
   novo_salario <- salario + (salario * percentual / 100)
   
   escreval("Novo salario: ", novo_salario)
Fimalgoritmo