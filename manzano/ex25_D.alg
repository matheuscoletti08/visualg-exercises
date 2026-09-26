Algoritmo "ex25_D"
// Professor   : Jailson Costa dos Santos
// Descricao   : Calcular a quantidade de litros de combustivel gasta em uma viagem. Carro faz 12 km/l. Ler tempo e velocidade. Distancia = Tempo * Velocidade. Litros = Distancia / 12.
// Autor(a)    : Matheus Coletti
Var
   tempo: real
   velocidade: real
   distancia: real
   litros_usados: real

Inicio
   escreval("Digite o tempo gasto (horas): ")
   leia(tempo)
   escreval("Digite a velocidade media (km/h): ")
   leia(velocidade)
   distancia <- tempo * velocidade
   litros_usados <- distancia / 12
   escreval("Velocidade media: ", velocidade)
   escreval("Tempo gasto: ", tempo)
   escreval("Distancia percorrida: ", distancia)
   escreval("Litros usados: ", litros_usados:4:2)
Fimalgoritmo