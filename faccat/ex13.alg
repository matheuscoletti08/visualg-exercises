Algoritmo "ex13"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler tres notas de um aluno e calcular a media final, que e ponderada e tem os pesos 2, 3 e 5.
// Autor(a)    : Matheus Coletti
Var
   n1: real
   n2: real
   n3: real
   media_final: real

Inicio
   escreval("Nota 1: ")
   leia(n1)
   escreval("Nota 2: ")
   leia(n2)
   escreval("Nota 3: ")
   leia(n3)

   media_final <- (n1 * 2 + n2 * 3 + n3 * 5) / 10

   escreval("Media final: ", media_final:4:2)
Fimalgoritmo
