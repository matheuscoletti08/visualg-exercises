Algoritmo "ex46_L"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler valores positivos ate valor negativo. Apresentar maior e menor.
// Autor(a)    : Matheus Coletti
Var
   valor: inteiro
   maior: inteiro
   menor: inteiro
   primeiro: logico

Inicio
   primeiro <- verdadeiro
   repita
      escreval("Digite um valor inteiro (negativo para terminar): ")
      leia(valor)
      se (valor >= 0) entao
         se (primeiro) entao
            maior <- valor
            menor <- valor
            primeiro <- falso
         senao
            se (valor > maior) entao
               maior <- valor
            fimse
            se (valor < menor) entao
               menor <- valor
            fimse
         fimse
      fimse
   ate (valor < 0)
   se (nao primeiro) entao
      escreval("Maior valor: ", maior)
      escreval("Menor valor: ", menor)
   senao
      escreval("Nenhum valor positivo informado.")
   fimse
Fimalgoritmo