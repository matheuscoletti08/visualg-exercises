Algoritmo "ex26_J"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler o custo de um produto e seu preco de venda e apresentar o lucro e o percentual de lucro.
// Autor(a)    : Matheus Coletti
Var
   custo: real
   preco_venda: real
   lucro: real
   perc_lucro: real

Inicio
   escreval("Digite o custo do produto: R$ ")
   leia(custo)
   escreval("Digite o preco de venda: R$ ")
   leia(preco_venda)
   lucro <- preco_venda - custo
   perc_lucro <- (lucro * 100) / custo
   escreval("Lucro obtido: R$", lucro:4:2)
   escreval("Percentual de lucro: ", perc_lucro:4:2, " %")
Fimalgoritmo
