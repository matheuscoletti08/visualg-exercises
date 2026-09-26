Algoritmo "ex11"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler salário fixo, total de vendas e valor por carro, calcular salário final (fixo + carros*valor + 5% vendas)
// Autor(a)    : Matheus Coletti
Var
   salario_fixo: real
   total_vendas: real
   valor_por_carro: real
   salario_final: real

Inicio
   escreval("Salario fixo: ")
   leia(salario_fixo)
   escreval("Total de vendas: ")
   leia(total_vendas)
   escreval("Valor por carro vendido: ")
   leia(valor_por_carro)
   
   salario_final <- salario_fixo + (valor_por_carro * 5) + (total_vendas * 0.05)
   
   escreval("Salario final: ", salario_final)
Fimalgoritmo