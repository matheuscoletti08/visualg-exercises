Algoritmo "ex32"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 2 times e gols, escrever vencedor ou EMPATE.
// Autor(a)    : Matheus Coletti
Var
   time1: literal
   time2: literal
   gols1: inteiro
   gols2: inteiro

Inicio
   escreval("Digite o nome do primeiro time: ")
   leia(time1)
   escreval("Digite o nome do segundo time: ")
   leia(time2)
   escreval("Digite os gols do ", time1, ": ")
   leia(gols1)
   escreval("Digite os gols do ", time2, ": ")
   leia(gols2)
   se (gols1 > gols2) entao
      escreval("Vencedor: ", time1)
   senao
      se (gols2 > gols1) entao
         escreval("Vencedor: ", time2)
      senao
         escreval("EMPATE")
      fimse
   fimse
Fimalgoritmo