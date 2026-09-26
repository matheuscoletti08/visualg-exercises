Algoritmo "ex46_K"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular area total de uma residencia. Ler nome, largura, comprimento. Repetir ate NAO.
// Autor(a)    : Matheus Coletti
Var
   nome: literal
   largura: real
   comprimento: real
   area_comodo: real
   area_total: real

Inicio
   area_total <- 0
   repita
      escreval("Nome do comodo (ou NAO para terminar): ")
      leia(nome)
      se (nome <> "NAO") entao
         escreval("Largura: ")
         leia(largura)
         escreval("Comprimento: ")
         leia(comprimento)
         area_comodo <- largura * comprimento
         area_total <- area_total + area_comodo
         escreval("Area do ", nome, ": ", area_comodo)
      fimse
   ate (nome = "NAO")
   escreval("Area total residencial: ", area_total)
Fimalgoritmo