Algoritmo "ex08"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler total de eleitores, brancos, nulos e válidos, calcular percentual de cada
// Autor(a)    : Matheus Coletti
Var
   total_eleitores: real
   brancos: real
   nulos: real
   validos: real
   perc_brancos: real
   perc_nulos: real
   perc_validos: real

Inicio
   escreval("Total de eleitores: ")
   leia(total_eleitores)
   escreval("Brancos: ")
   leia(brancos)
   escreval("Nulos: ")
   leia(nulos)
   escreval("Validos: ")
   leia(validos)
   
   perc_brancos <- (brancos / total_eleitores) * 100
   perc_nulos <- (nulos / total_eleitores) * 100
   perc_validos <- (validos / total_eleitores) * 100
   
   escreval("Percentual brancos: ", perc_brancos, " %")
   escreval("Percentual nulos: ", perc_nulos, " %")
   escreval("Percentual validos: ", perc_validos, " %")
Fimalgoritmo