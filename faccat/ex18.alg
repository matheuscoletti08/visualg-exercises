Algoritmo "ex18"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler ano atual e ano de nascimento. Calcular idade. Se >= 16, pode votar.
// Autor(a)    : Matheus Coletti
Var
   ano_atual: inteiro
   ano_nasc: inteiro
   idade: inteiro

Inicio
   escreval("Informe o ano atual: ")
   leia(ano_atual)
   escreval("Informe o ano de nascimento: ")
   leia(ano_nasc)
   idade <- ano_atual - ano_nasc
   se (idade >= 16) entao
      escreval("Pode votar!")
   senao
      escreval("Nao pode votar!")
   fimse
Fimalgoritmo