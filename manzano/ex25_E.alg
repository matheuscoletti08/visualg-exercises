Algoritmo "ex25_E"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular e apresentar o valor de uma prestacao em atraso. Formula: PRESTACAO = VALOR + (VALOR * TAXA/100) * TEMPO.
// Autor(a)    : Matheus Coletti
Var
   valor: real
   taxa: real
   tempo: inteiro
   prestacao: real
   juros: real

Inicio
   escreval("-- Prestacao em Atraso --")
   escreval("Digite o valor da prestacao: R$ ")
   leia(valor)
   escreval("Digite a taxa (%): ")
   leia(taxa)
   escreval("Digite o tempo de atraso (meses): ")
   leia(tempo)
   prestacao <- valor + (valor * taxa / 100) * tempo
   juros <- prestacao - valor
   escreval("Valor da prestacao com atraso: R$", prestacao:6:2)
   escreval("Valor dos juros: R$", juros:6:2)
Fimalgoritmo