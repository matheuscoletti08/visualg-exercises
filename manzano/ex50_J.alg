Algoritmo "ex50_J"
// Professor   : Jailson Costa dos Santos
// Descricao   : Divisao inteira por subtracoes sucessivas (sem usar DIV).
// Autor(a)    : Matheus Coletti
Var
   dividendo: inteiro
   divisor: inteiro
   quociente: inteiro

Inicio
   escreval("Digite o dividendo: ")
   leia(dividendo)
   escreval("Digite o divisor: ")
   leia(divisor)
   quociente <- 0
   repita
      dividendo <- dividendo - divisor
      quociente <- quociente + 1
   ate (dividendo < divisor)
   escreval("Quociente: ", quociente)
   escreval("Resto: ", dividendo)
Fimalgoritmo