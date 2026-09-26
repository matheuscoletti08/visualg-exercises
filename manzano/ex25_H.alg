Algoritmo "ex25_H"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular e apresentar o volume de uma caixa retangular: VOLUME = COMPRIMENTO * LARGURA * ALTURA.
// Autor(a)    : Matheus Coletti
Var
   comprimento: real
   largura: real
   altura: real
   volume: real

Inicio
   escreval("-- Volume da Caixa Retangular --")
   escreval("Digite o comprimento: ")
   leia(comprimento)
   escreval("Digite a largura: ")
   leia(largura)
   escreval("Digite a altura: ")
   leia(altura)
   volume <- comprimento * largura * altura
   escreval("Volume da caixa retangular: ", volume:6:2)
Fimalgoritmo