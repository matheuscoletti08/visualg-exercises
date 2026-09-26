Algoritmo "ex36"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler idades de 2 homens e 2 mulheres, soma do homem mais velho com mulher mais nova, produto do homem mais novo com mulher mais velha.
// Autor(a)    : Matheus Coletti
Var
   h1: inteiro
   h2: inteiro
   m1: inteiro
   m2: inteiro
   homem_velho: inteiro
   homem_novo: inteiro
   mulher_velha: inteiro
   mulher_nova: inteiro
   soma: inteiro
   produto: inteiro

Inicio
   escreval("Idade homem 1: ")
   leia(h1)
   escreval("Idade homem 2: ")
   leia(h2)
   escreval("Idade mulher 1: ")
   leia(m1)
   escreval("Idade mulher 2: ")
   leia(m2)
   se (h1 > h2) entao
      homem_velho <- h1
      homem_novo <- h2
   senao
      homem_velho <- h2
      homem_novo <- h1
   fimse
   se (m1 > m2) entao
      mulher_velha <- m1
      mulher_nova <- m2
   senao
      mulher_velha <- m2
      mulher_nova <- m1
   fimse
   soma <- homem_velho + mulher_nova
   produto <- homem_novo * mulher_velha
   escreval("Soma (homem velho + mulher nova): ", soma)
   escreval("Produto (homem novo * mulher velha): ", produto)
Fimalgoritmo