Algoritmo "ex26_E"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler tres notas de um aluno e apresentar a media aritmetica delas.
// Autor(a)    : Matheus Coletti
Var
   nota1: real
   nota2: real
   nota3: real
   media: real

Inicio
   escreval("Digite a primeira nota: ")
   leia(nota1)
   escreval("Digite a segunda nota: ")
   leia(nota2)
   escreval("Digite a terceira nota: ")
   leia(nota3)
   media <- (nota1 + nota2 + nota3) / 3
   escreval("Media das notas: ", media:4:2)
Fimalgoritmo
