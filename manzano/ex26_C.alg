Algoritmo "ex26_C"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler votos de 3 candidatos, nulos e brancos. Calcular total de eleitores e percentuais.
// Autor(a)    : Matheus Coletti
Var
   votos_a: inteiro
   votos_b: inteiro
   votos_c: inteiro
   votos_nulos: inteiro
   votos_brancos: inteiro
   total_eleitores: inteiro
   perc_a: real
   perc_b: real
   perc_c: real
   perc_nulos: real
   perc_brancos: real

Inicio
   escreval("Votos do candidato A: ")
   leia(votos_a)
   escreval("Votos do candidato B: ")
   leia(votos_b)
   escreval("Votos do candidato C: ")
   leia(votos_c)
   escreval("Votos nulos: ")
   leia(votos_nulos)
   escreval("Votos brancos: ")
   leia(votos_brancos)
   total_eleitores <- votos_a + votos_b + votos_c + votos_nulos + votos_brancos
   perc_a <- (votos_a * 100) / total_eleitores
   perc_b <- (votos_b * 100) / total_eleitores
   perc_c <- (votos_c * 100) / total_eleitores
   perc_nulos <- (votos_nulos * 100) / total_eleitores
   perc_brancos <- (votos_brancos * 100) / total_eleitores
   escreval("Total de eleitores: ", total_eleitores)
   escreval("Percentual A: ", perc_a:4:2, " %")
   escreval("Percentual B: ", perc_b:4:2, " %")
   escreval("Percentual C: ", perc_c:4:2, " %")
   escreval("Percentual nulos: ", perc_nulos:4:2, " %")
   escreval("Percentual brancos: ", perc_brancos:4:2, " %")
Fimalgoritmo