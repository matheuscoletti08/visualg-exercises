Algoritmo "ex26_B"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler salario mensal e percentual de reajuste. Apresentar novo salario.
// Autor(a)    : Matheus Coletti
Var
   salario: real
   percentual: real
   novo_salario: real

Inicio
   escreval("Digite o salario mensal: ")
   leia(salario)
   escreval("Digite o percentual de reajuste: ")
   leia(percentual)
   novo_salario <- salario + (salario * percentual / 100)
   escreval("Novo salario: ", novo_salario:4:2)
Fimalgoritmo