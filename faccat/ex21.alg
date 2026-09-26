Algoritmo "ex21"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler hora inicio e hora fim de um evento. Calcular duracao.
// Autor(a)    : Matheus Coletti
Var
   inicio: inteiro
   fim: inteiro
   duracao: inteiro

Inicio
   escreval("Informe a hora de inicio: ")
   leia(inicio)
   escreval("Informe a hora de fim: ")
   leia(fim)
   se (fim >= inicio) entao
      duracao <- fim - inicio
   senao
      duracao <- 24 - inicio + fim
   fimse
   escreval("Duracao: ", duracao, " horas")
Fimalgoritmo