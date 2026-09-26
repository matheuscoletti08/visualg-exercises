Algoritmo "ex26_G"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler o peso e a altura de uma pessoa e apresentar o indice de massa corporal (IMC).
// Autor(a)    : Matheus Coletti
Var
   peso: real
   altura: real
   imc: real

Inicio
   escreval("Digite o peso (kg): ")
   leia(peso)
   escreval("Digite a altura (m): ")
   leia(altura)
   imc <- peso / (altura * altura)
   escreval("Indice de massa corporal: ", imc:4:2)
Fimalgoritmo
