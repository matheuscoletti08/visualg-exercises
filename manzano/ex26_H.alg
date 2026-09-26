Algoritmo "ex26_H"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler o preco de um produto e o percentual de desconto e apresentar o desconto e o preco final.
// Autor(a)    : Matheus Coletti
Var
   preco_original: real
   percentual: real
   desconto: real
   preco_final: real

Inicio
   escreval("Digite o preco do produto: R$ ")
   leia(preco_original)
   escreval("Digite o percentual de desconto: ")
   leia(percentual)
   desconto <- preco_original * percentual / 100
   preco_final <- preco_original - desconto
   escreval("Valor do desconto: R$", desconto:4:2)
   escreval("Preco final: R$", preco_final:4:2)
Fimalgoritmo
