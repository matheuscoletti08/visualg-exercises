Algoritmo "ex41"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler 3 notas e média dos exercícios, calcular média de aproveitamento ((n1 + n2*2 + n3*3 + media_ex)/7)
// Autor(a)    : Matheus Coletti
Var
   n1: real
   n2: real
   n3: real
   media_exercicios: real
   media_aproveitamento: real

Inicio
   escreval("Nota 1: ")
   leia(n1)
   escreval("Nota 2: ")
   leia(n2)
   escreval("Nota 3: ")
   leia(n3)
   escreval("Media dos exercicios: ")
   leia(media_exercicios)
   
   media_aproveitamento <- (n1 + n2 * 2 + n3 * 3 + media_exercicios) / 7
   
   escreval("Media de aproveitamento: ", media_aproveitamento)
Fimalgoritmo