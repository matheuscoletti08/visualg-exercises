Algoritmo "ex25_J"
// Professor   : Jailson Costa dos Santos
// Descricao   : Converter valor em dolar para real. Ler cotacao do dolar e quantidade de dolares. Reais = cotacao * dolares.
// Autor(a)    : Matheus Coletti
Var
   cotacao: real
   dolares: real
   reais: real

Inicio
   escreval("Digite a cotacao do dolar: ")
   leia(cotacao)
   escreval("Digite a quantidade de dolares: ")
   leia(dolares)
   reais <- cotacao * dolares
   escreval("Valor em reais: R$", reais:4:2)
Fimalgoritmo