Algoritmo "ex26_K"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler capital, taxa de juros e tempo e apresentar os juros simples e o montante.
// Autor(a)    : Matheus Coletti
Var
   capital: real
   taxa: real
   tempo: inteiro
   juros: real
   montante: real

Inicio
   escreval("Digite o capital: R$ ")
   leia(capital)
   escreval("Digite a taxa de juros (% ao mes): ")
   leia(taxa)
   escreval("Digite o tempo (meses): ")
   leia(tempo)
   juros <- capital * taxa / 100 * tempo
   montante <- capital + juros
   escreval("Juros: R$", juros:4:2)
   escreval("Montante: R$", montante:4:2)
Fimalgoritmo
