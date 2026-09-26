Algoritmo "ex35"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular valor do combustivel com desconto. Ler litros e tipo (A-alcool, G-gasolina).
// Autor(a)    : Matheus Coletti
Var
   litros: real
   tipo: literal
   preco_alcool: real
   preco_gasolina: real
   desconto: real
   total_pagar: real

Inicio
   escreval("Litros vendidos: ")
   leia(litros)
   escreval("Tipo (A-alcool, G-gasolina): ")
   leia(tipo)
   preco_alcool <- 2.90
   preco_gasolina <- 3.30
   se (tipo = 'A') entao
      total_pagar <- litros * preco_alcool
   senao
      se (tipo = 'G') entao
         total_pagar <- litros * preco_gasolina
      fimse
   fimse
   se (litros <= 20) entao
      desconto <- total_pagar * 0.03
   senao
      desconto <- total_pagar * 0.05
   fimse
   total_pagar <- total_pagar - desconto
   escreval("Total a pagar: ", total_pagar:4:2)
Fimalgoritmo