Algoritmo "ex50_H"
// Professor   : Jailson Costa dos Santos
// Descricao   : Area total de residencia. Ler comodos ate digitar NAO.
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
   escreval("Area total: ", area_total)
Fimalgoritmo