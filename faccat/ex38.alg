Algoritmo "ex38"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler codigo, se diferente de 1234 "Usuario invalido", senha se diferente de 9999 "Senha incorreta" senao "Acesso permitido".
// Autor(a)    : Matheus Coletti
Var
   codigo: inteiro
   senha: inteiro

Inicio
   escreval("Digite o codigo: ")
   leia(codigo)
   se (codigo <> 1234) entao
      escreval("Usuario invalido!")
   senao
      escreval("Digite a senha: ")
      leia(senha)
      se (senha <> 9999) entao
         escreval("Senha incorreta!")
      senao
         escreval("Acesso permitido!")
      fimse
   fimse
Fimalgoritmo