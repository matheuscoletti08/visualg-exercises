Algoritmo "ex50_F"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler valores positivos, mostrar soma, media e total. Parar com valor negativo.
// Autor(a)    : Matheus Coletti
Var
   valor: real
   soma: real
   cont: inteiro
   media: real

Inicio
   soma <- 0
   cont <- 0
   repita
      escreval("Digite um valor (negativo para terminar): ")
      leia(valor)
      se (valor >= 0) entao
         soma <- soma + valor
         cont <- cont + 1
      fimse
   ate (valor < 0)
   se (cont > 0) entao
      media <- soma / cont
      escreval("Somatorio: ", soma)
      escreval("Media: ", media)
      escreval("Total de valores: ", cont)
   senao
      escreval("Nenhum valor positivo informado.")
   fimse
Fimalgoritmo