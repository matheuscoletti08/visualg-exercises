Algoritmo "ex26_L"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler a populacao e a area de um pais e apresentar a densidade demografica.
// Autor(a)    : Matheus Coletti
Var
   populacao: inteiro
   area: real
   densidade: real

Inicio
   escreval("Digite a populacao: ")
   leia(populacao)
   escreval("Digite a area (km2): ")
   leia(area)
   densidade <- populacao / area
   escreval("Densidade demografica: ", densidade:4:2, " habitantes por km2")
Fimalgoritmo
