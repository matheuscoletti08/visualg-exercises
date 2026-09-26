Algoritmo "ex23"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler nome, altura e sexo (M ou F) de uma pessoa e calcular o peso ideal. Para sexo masculino: 72.7 * altura - 58. Para sexo feminino: 62.1 * altura - 44.7.
// Autor(a)    : Matheus Coletti
Var
   nome: caractere
   altura: real
   sexo: caractere
   peso_ideal: real

Inicio
   escreval("Nome: ")
   leia(nome)
   escreval("Altura (m): ")
   leia(altura)
   escreval("Sexo (M ou F): ")
   leia(sexo)

   se (sexo = "M") ou (sexo = "m") entao
      peso_ideal <- 72.7 * altura - 58
   senao
      peso_ideal <- 62.1 * altura - 44.7
   fimse

   escreval("Peso ideal de ", nome, ": ", peso_ideal:6:2, " kg")
Fimalgoritmo
