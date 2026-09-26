Algoritmo "ex22"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular salario com hora extra. Se horas > 160, extras com 50% de acrescimo.
// Autor(a)    : Matheus Coletti
Var
   horas_mes: real
   salario_hora: real
   horas_extra: real
   valor_extra: real
   salario_total: real

Inicio
   escreval("Informe as horas trabalhadas no mes: ")
   leia(horas_mes)
   escreval("Informe o salario por hora: ")
   leia(salario_hora)
   se (horas_mes > 160) entao
      horas_extra <- horas_mes - 160
      valor_extra <- horas_extra * salario_hora * 1.5
      salario_total <- 160 * salario_hora + valor_extra
   senao
      salario_total <- horas_mes * salario_hora
   fimse
   escreval("Salario total: ", salario_total)
Fimalgoritmo