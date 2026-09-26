Algoritmo "ex25_K"
// Professor   : Jailson Costa dos Santos
// Descricao   : Converter valor em real para dolar. Ler cotacao do dolar e quantidade de reais. Dolares = reais / cotacao.
// Autor(a)    : Matheus Coletti
Var
   cotacao: real
   reais: real
   dolares: real

Inicio
   escreval("Digite a cotacao do dolar: ")
   leia(cotacao)
   escreval("Digite a quantidade de reais: ")
   leia(reais)
   dolares <- reais / cotacao
   escreval("Valor em dolares: US$", dolares:4:2)
Fimalgoritmo