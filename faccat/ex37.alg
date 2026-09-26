Algoritmo "ex37"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler kg de morangos e macas, precos diferentes ate 5kg e acima, se total >8kg ou >25 dar 10% desconto.
// Autor(a)    : Matheus Coletti
Var
   kg_morangos: real
   kg_macas: real
   preco_morango: real
   preco_maca: real
   total: real
   desconto: real

Inicio
   escreval("Kg de morangos: ")
   leia(kg_morangos)
   escreval("Kg de macas: ")
   leia(kg_macas)
   se (kg_morangos <= 5) entao
      preco_morango <- 2.50
   senao
      preco_morango <- 2.20
   fimse
   se (kg_macas <= 5) entao
      preco_maca <- 1.80
   senao
      preco_maca <- 1.50
   fimse
   total <- (kg_morangos * preco_morango) + (kg_macas * preco_maca)
   se ((kg_morangos + kg_macas > 8) ou (total > 25)) entao
      desconto <- total * 0.10
      total <- total - desconto
   fimse
   escreval("Total a pagar: ", total)
Fimalgoritmo