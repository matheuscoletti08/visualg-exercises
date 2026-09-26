Algoritmo "ex17"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler duas notas, calcular media. Se media >= 6, APROVADO. Senao, REPROVADO.
// Autor(a)    : Matheus Coletti
Var
   n1: real
   n2: real
   media: real

Inicio
   escreval("Informe a primeira nota: ")
   leia(n1)
   escreval("Informe a segunda nota: ")
   leia(n2)
   media <- (n1 + n2) / 2
   se (media >= 6) entao
      escreval("APROVADO")
   senao
      escreval("REPROVADO")
   fimse
Fimalgoritmo