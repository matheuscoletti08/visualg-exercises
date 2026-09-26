Algoritmo "ex31"
// Professor   : Jailson Costa dos Santos
// Descricao   : Ler 3 lados de um triangulo e escrever se formam triangulo e qual tipo (equilatero, isosceles, escaleno).
// Autor(a)    : Matheus Coletti
Var
   a: real
   b: real
   c: real
   forma_triangulo: logico

Inicio
   escreval("Digite o lado A: ")
   leia(a)
   escreval("Digite o lado B: ")
   leia(b)
   escreval("Digite o lado C: ")
   leia(c)
   forma_triangulo <- (a < b + c) e (b < a + c) e (c < a + b)
   se (forma_triangulo) entao
      se (a = b) e (b = c) entao
         escreval("Triangulo Equilatero")
      senao
         se (a = b) ou (b = c) ou (a = c) entao
            escreval("Triangulo Isosceles")
         senao
            escreval("Triangulo Escaleno")
         fimse
      fimse
   senao
      escreval("Nao formam um triangulo")
   fimse
Fimalgoritmo