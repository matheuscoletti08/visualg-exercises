Algoritmo "ex26_D"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler a largura e a altura de um retangulo e apresentar a area e o perimetro.
// Autor(a)    : Matheus Coletti
Var
   largura: real
   altura: real
   area: real
   perimetro: real

Inicio
   escreval("Digite a largura do retangulo: ")
   leia(largura)
   escreval("Digite a altura do retangulo: ")
   leia(altura)
   area <- largura * altura
   perimetro <- 2 * (largura + altura)
   escreval("Area do retangulo: ", area:4:2)
   escreval("Perimetro do retangulo: ", perimetro:4:2)
Fimalgoritmo
