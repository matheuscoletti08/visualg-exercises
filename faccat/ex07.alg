Algoritmo "ex07"
// Professor   : Jailson Costa dos Santos
// Descrição   : Ler anos, meses e dias de idade e calcular o total em dias (anos*365 + meses*30 + dias)
// Autor(a)    : Matheus Coletti
Var
   anos: real
   meses: real
   dias: real
   total_dias: real

Inicio
   escreval("Informe anos: ")
   leia(anos)
   escreval("Informe meses: ")
   leia(meses)
   escreval("Informe dias: ")
   leia(dias)
   
   total_dias <- (anos * 365) + (meses * 30) + dias
   
   escreval("Idade em dias: ", total_dias)
Fimalgoritmo