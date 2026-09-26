Algoritmo "ex26"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular estoque medio. Se estoque atual >= medio, nao efetuar compra. Senao, efetuar compra.
// Autor(a)    : Matheus Coletti
Var
   estoque_atual: real
   estoque_max: real
   estoque_min: real
   estoque_medio: real

Inicio
   escreval("Informe o estoque atual: ")
   leia(estoque_atual)
   escreval("Informe o estoque maximo: ")
   leia(estoque_max)
   escreval("Informe o estoque minimo: ")
   leia(estoque_min)
   estoque_medio <- (estoque_max + estoque_min) / 2
   se (estoque_atual >= estoque_medio) entao
      escreval("Nao efetuar compra")
   senao
      escreval("Efetuar compra")
   fimse
Fimalgoritmo