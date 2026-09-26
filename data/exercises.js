// GERADO por tools/gerar-exercicios.mjs — não edite à mão. Rode: node tools/gerar-exercicios.mjs
window.GRUPOS = [
  { id: "manzano-p25", livro: "Manzano", rotulo: "Manzano — Pág. 25 (sequencial)", ordem: 1 },
  { id: "manzano-p26", livro: "Manzano", rotulo: "Manzano — Pág. 26 (extras)", ordem: 2 },
  { id: "manzano-p46", livro: "Manzano", rotulo: "Manzano — Pág. 46 (enquanto/faça)", ordem: 3 },
  { id: "manzano-p50", livro: "Manzano", rotulo: "Manzano — Pág. 50 (repita/até)", ordem: 4 },
  { id: "manzano-p66", livro: "Manzano", rotulo: "Manzano — Pág. 66 (para)", ordem: 5 },
  { id: "faccat-p4", livro: "Faccat", rotulo: "Faccat — Pág. 4 (operadores aritméticos)", ordem: 6 },
  { id: "faccat-p5", livro: "Faccat", rotulo: "Faccat — Pág. 5 (horizontalização)", ordem: 7 },
  { id: "faccat-p5-6", livro: "Faccat", rotulo: "Faccat — Pág. 5-6 (seleção)", ordem: 8 },
  { id: "faccat-p6-8", livro: "Faccat", rotulo: "Faccat — Pág. 6-8 (seleção aninhada)", ordem: 9 },
  { id: "faccat-p8", livro: "Faccat", rotulo: "Faccat — Pág. 8+ (operadores lógicos / seleção)", ordem: 10 }
];
window.EXERCICIOS = [
  {
    id: "manzano/ex25_A",
    grupo: "manzano-p25",
    titulo: "ex25_A",
    descricao: "Ler uma temperatura em graus Celsius e apresenta-la convertida em graus Fahrenheit. Formula: F = (9 * C + 160) / 5.",
    codigo: "Algoritmo \"ex25_A\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler uma temperatura em graus Celsius e apresenta-la convertida em graus Fahrenheit. Formula: F = (9 * C + 160) / 5.\n// Autor(a)    : Matheus Coletti\nVar\n   celsius: real\n   fahrenheit: real\n\nInicio\n   escreval(\"Digite a temperatura em Celsius: \")\n   leia(celsius)\n   fahrenheit <- (9 * celsius + 160) / 5\n   escreval(\"Temperatura em Fahrenheit: \", fahrenheit:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_B",
    grupo: "manzano-p25",
    titulo: "ex25_B",
    descricao: "Ler uma temperatura em graus Fahrenheit e apresenta-la convertida em graus Celsius. Formula: C = (F - 32) * (5/9).",
    codigo: "Algoritmo \"ex25_B\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler uma temperatura em graus Fahrenheit e apresenta-la convertida em graus Celsius. Formula: C = (F - 32) * (5/9).\n// Autor(a)    : Matheus Coletti\nVar\n   fahrenheit: real\n   celsius: real\n\nInicio\n   escreval(\"Digite a temperatura em Fahrenheit: \")\n   leia(fahrenheit)\n   celsius <- (fahrenheit - 32) * 5 / 9\n   escreval(\"Temperatura em Celsius: \", celsius:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_C",
    grupo: "manzano-p25",
    titulo: "ex25_C",
    descricao: "Calcular e apresentar o volume de uma lata de oleo, utilizando a formula: Volume = pi * Raio^2 * Altura.",
    codigo: "Algoritmo \"ex25_C\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular e apresentar o volume de uma lata de oleo, utilizando a formula: Volume = pi * Raio^2 * Altura.\n// Autor(a)    : Matheus Coletti\nVar\n   raio: real\n   altura: real\n   volume: real\n\nInicio\n   escreval(\"Digite o raio da lata: \")\n   leia(raio)\n   escreval(\"Digite a altura da lata: \")\n   leia(altura)\n   volume <- 3.14159 * (raio ^ 2) * altura\n   escreval(\"Volume da lata: \", volume:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_D",
    grupo: "manzano-p25",
    titulo: "ex25_D",
    descricao: "Calcular a quantidade de litros de combustivel gasta em uma viagem. Carro faz 12 km/l. Ler tempo e velocidade. Distancia = Tempo * Velocidade. Litros = Distancia / 12.",
    codigo: "Algoritmo \"ex25_D\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular a quantidade de litros de combustivel gasta em uma viagem. Carro faz 12 km/l. Ler tempo e velocidade. Distancia = Tempo * Velocidade. Litros = Distancia / 12.\n// Autor(a)    : Matheus Coletti\nVar\n   tempo: real\n   velocidade: real\n   distancia: real\n   litros_usados: real\n\nInicio\n   escreval(\"Digite o tempo gasto (horas): \")\n   leia(tempo)\n   escreval(\"Digite a velocidade media (km/h): \")\n   leia(velocidade)\n   distancia <- tempo * velocidade\n   litros_usados <- distancia / 12\n   escreval(\"Velocidade media: \", velocidade)\n   escreval(\"Tempo gasto: \", tempo)\n   escreval(\"Distancia percorrida: \", distancia)\n   escreval(\"Litros usados: \", litros_usados:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_E",
    grupo: "manzano-p25",
    titulo: "ex25_E",
    descricao: "Calcular e apresentar o valor de uma prestacao em atraso. Formula: PRESTACAO = VALOR + (VALOR * TAXA/100) * TEMPO.",
    codigo: "Algoritmo \"ex25_E\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular e apresentar o valor de uma prestacao em atraso. Formula: PRESTACAO = VALOR + (VALOR * TAXA/100) * TEMPO.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: real\n   taxa: real\n   tempo: inteiro\n   prestacao: real\n   juros: real\n\nInicio\n   escreval(\"-- Prestacao em Atraso --\")\n   escreval(\"Digite o valor da prestacao: R$ \")\n   leia(valor)\n   escreval(\"Digite a taxa (%): \")\n   leia(taxa)\n   escreval(\"Digite o tempo de atraso (meses): \")\n   leia(tempo)\n   prestacao <- valor + (valor * taxa / 100) * tempo\n   juros <- prestacao - valor\n   escreval(\"Valor da prestacao com atraso: R$\", prestacao:6:2)\n   escreval(\"Valor dos juros: R$\", juros:6:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_F",
    grupo: "manzano-p25",
    titulo: "ex25_F",
    descricao: "Ler dois valores para as variaveis A e B, efetuar a troca dos valores e apresentar os valores trocados.",
    codigo: "Algoritmo \"ex25_F\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler dois valores para as variaveis A e B, efetuar a troca dos valores e apresentar os valores trocados.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   auxiliar: real\n\nInicio\n   escreval(\"-- Troca de Valores --\")\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   auxiliar <- a\n   a <- b\n   b <- auxiliar\n   escreval(\"A = \", a, \" | B = \", b)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_G",
    grupo: "manzano-p25",
    titulo: "ex25_G",
    descricao: "Ler quatro numeros inteiros e apresentar o resultado da adicao e multiplicacao de cada par (A com B, A com C, A com D, B com C, B com D, C com D). 6 adicoes e 6 multiplicacoes.",
    codigo: "Algoritmo \"ex25_G\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler quatro numeros inteiros e apresentar o resultado da adicao e multiplicacao de cada par (A com B, A com C, A com D, B com C, B com D, C com D). 6 adicoes e 6 multiplicacoes.\n// Autor(a)    : Matheus Coletti\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\n   d: inteiro\n   soma_ab: inteiro\n   soma_ac: inteiro\n   soma_ad: inteiro\n   soma_bc: inteiro\n   soma_bd: inteiro\n   soma_cd: inteiro\n   mult_ab: inteiro\n   mult_ac: inteiro\n   mult_ad: inteiro\n   mult_bc: inteiro\n   mult_bd: inteiro\n   mult_cd: inteiro\n\nInicio\n   escreval(\"-- Propriedade Distributiva --\")\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   escreval(\"Digite o valor de C: \")\n   leia(c)\n   escreval(\"Digite o valor de D: \")\n   leia(d)\n   soma_ab <- a + b\n   soma_ac <- a + c\n   soma_ad <- a + d\n   soma_bc <- b + c\n   soma_bd <- b + d\n   soma_cd <- c + d\n   mult_ab <- a * b\n   mult_ac <- a * c\n   mult_ad <- a * d\n   mult_bc <- b * c\n   mult_bd <- b * d\n   mult_cd <- c * d\n   escreval(\"A + B = \", soma_ab, \" | A * B = \", mult_ab)\n   escreval(\"A + C = \", soma_ac, \" | A * C = \", mult_ac)\n   escreval(\"A + D = \", soma_ad, \" | A * D = \", mult_ad)\n   escreval(\"B + C = \", soma_bc, \" | B * C = \", mult_bc)\n   escreval(\"B + D = \", soma_bd, \" | B * D = \", mult_bd)\n   escreval(\"C + D = \", soma_cd, \" | C * D = \", mult_cd)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_H",
    grupo: "manzano-p25",
    titulo: "ex25_H",
    descricao: "Calcular e apresentar o volume de uma caixa retangular: VOLUME = COMPRIMENTO * LARGURA * ALTURA.",
    codigo: "Algoritmo \"ex25_H\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular e apresentar o volume de uma caixa retangular: VOLUME = COMPRIMENTO * LARGURA * ALTURA.\n// Autor(a)    : Matheus Coletti\nVar\n   comprimento: real\n   largura: real\n   altura: real\n   volume: real\n\nInicio\n   escreval(\"-- Volume da Caixa Retangular --\")\n   escreval(\"Digite o comprimento: \")\n   leia(comprimento)\n   escreval(\"Digite a largura: \")\n   leia(largura)\n   escreval(\"Digite a altura: \")\n   leia(altura)\n   volume <- comprimento * largura * altura\n   escreval(\"Volume da caixa retangular: \", volume:6:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_I",
    grupo: "manzano-p25",
    titulo: "ex25_I",
    descricao: "Ler dois inteiros A e B e imprimir o quadrado da diferenca do primeiro pelo segundo.",
    codigo: "Algoritmo \"ex25_I\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler dois inteiros A e B e imprimir o quadrado da diferenca do primeiro pelo segundo.\n// Autor(a)    : Matheus Coletti\nVar\n   a: inteiro\n   b: inteiro\n\nInicio\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   escreval(\"Quadrado da diferenca (A - B)^2 = \", (a - b) ^ 2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_J",
    grupo: "manzano-p25",
    titulo: "ex25_J",
    descricao: "Converter valor em dolar para real. Ler cotacao do dolar e quantidade de dolares. Reais = cotacao * dolares.",
    codigo: "Algoritmo \"ex25_J\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Converter valor em dolar para real. Ler cotacao do dolar e quantidade de dolares. Reais = cotacao * dolares.\n// Autor(a)    : Matheus Coletti\nVar\n   cotacao: real\n   dolares: real\n   reais: real\n\nInicio\n   escreval(\"Digite a cotacao do dolar: \")\n   leia(cotacao)\n   escreval(\"Digite a quantidade de dolares: \")\n   leia(dolares)\n   reais <- cotacao * dolares\n   escreval(\"Valor em reais: R$\", reais:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_K",
    grupo: "manzano-p25",
    titulo: "ex25_K",
    descricao: "Converter valor em real para dolar. Ler cotacao do dolar e quantidade de reais. Dolares = reais / cotacao.",
    codigo: "Algoritmo \"ex25_K\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Converter valor em real para dolar. Ler cotacao do dolar e quantidade de reais. Dolares = reais / cotacao.\n// Autor(a)    : Matheus Coletti\nVar\n   cotacao: real\n   reais: real\n   dolares: real\n\nInicio\n   escreval(\"Digite a cotacao do dolar: \")\n   leia(cotacao)\n   escreval(\"Digite a quantidade de reais: \")\n   leia(reais)\n   dolares <- reais / cotacao\n   escreval(\"Valor em dolares: US$\", dolares:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_L",
    grupo: "manzano-p25",
    titulo: "ex25_L",
    descricao: "Ler tres valores A, B e C e apresentar a soma dos quadrados dos tres valores.",
    codigo: "Algoritmo \"ex25_L\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler tres valores A, B e C e apresentar a soma dos quadrados dos tres valores.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n\nInicio\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   escreval(\"Digite o valor de C: \")\n   leia(c)\n   escreval(\"Soma dos quadrados: \", (a ^ 2) + (b ^ 2) + (c ^ 2))\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex25_M",
    grupo: "manzano-p25",
    titulo: "ex25_M",
    descricao: "Ler tres valores A, B e C e apresentar o quadrado da soma dos tres valores.",
    codigo: "Algoritmo \"ex25_M\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler tres valores A, B e C e apresentar o quadrado da soma dos tres valores.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n\nInicio\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   escreval(\"Digite o valor de C: \")\n   leia(c)\n   escreval(\"Quadrado da soma: \", (a + b + c) ^ 2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_A",
    grupo: "manzano-p26",
    titulo: "ex26_A",
    descricao: "Ler quatro valores inteiros A, B, C e D. Apresentar o produto do primeiro pelo terceiro e a soma do segundo com o quarto.",
    codigo: "Algoritmo \"ex26_A\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler quatro valores inteiros A, B, C e D. Apresentar o produto do primeiro pelo terceiro e a soma do segundo com o quarto.\n// Autor(a)    : Matheus Coletti\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\n   d: inteiro\n   p: inteiro\n   s: inteiro\n\nInicio\n   escreval(\"Valor A: \")\n   leia(a)\n   escreval(\"Valor B: \")\n   leia(b)\n   escreval(\"Valor C: \")\n   leia(c)\n   escreval(\"Valor D: \")\n   leia(d)\n\n   p <- a * c\n   s <- b + d\n\n   escreval(\"Produto (A * C): \", p)\n   escreval(\"Soma (B + D): \", s)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_B",
    grupo: "manzano-p26",
    titulo: "ex26_B",
    descricao: "Ler salario mensal e percentual de reajuste. Apresentar novo salario.",
    codigo: "Algoritmo \"ex26_B\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler salario mensal e percentual de reajuste. Apresentar novo salario.\n// Autor(a)    : Matheus Coletti\nVar\n   salario: real\n   percentual: real\n   novo_salario: real\n\nInicio\n   escreval(\"Digite o salario mensal: \")\n   leia(salario)\n   escreval(\"Digite o percentual de reajuste: \")\n   leia(percentual)\n   novo_salario <- salario + (salario * percentual / 100)\n   escreval(\"Novo salario: \", novo_salario:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_C",
    grupo: "manzano-p26",
    titulo: "ex26_C",
    descricao: "Ler votos de 3 candidatos, nulos e brancos. Calcular total de eleitores e percentuais.",
    codigo: "Algoritmo \"ex26_C\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler votos de 3 candidatos, nulos e brancos. Calcular total de eleitores e percentuais.\n// Autor(a)    : Matheus Coletti\nVar\n   votos_a: inteiro\n   votos_b: inteiro\n   votos_c: inteiro\n   votos_nulos: inteiro\n   votos_brancos: inteiro\n   total_eleitores: inteiro\n   perc_a: real\n   perc_b: real\n   perc_c: real\n   perc_nulos: real\n   perc_brancos: real\n\nInicio\n   escreval(\"Votos do candidato A: \")\n   leia(votos_a)\n   escreval(\"Votos do candidato B: \")\n   leia(votos_b)\n   escreval(\"Votos do candidato C: \")\n   leia(votos_c)\n   escreval(\"Votos nulos: \")\n   leia(votos_nulos)\n   escreval(\"Votos brancos: \")\n   leia(votos_brancos)\n   total_eleitores <- votos_a + votos_b + votos_c + votos_nulos + votos_brancos\n   perc_a <- (votos_a * 100) / total_eleitores\n   perc_b <- (votos_b * 100) / total_eleitores\n   perc_c <- (votos_c * 100) / total_eleitores\n   perc_nulos <- (votos_nulos * 100) / total_eleitores\n   perc_brancos <- (votos_brancos * 100) / total_eleitores\n   escreval(\"Total de eleitores: \", total_eleitores)\n   escreval(\"Percentual A: \", perc_a:4:2, \" %\")\n   escreval(\"Percentual B: \", perc_b:4:2, \" %\")\n   escreval(\"Percentual C: \", perc_c:4:2, \" %\")\n   escreval(\"Percentual nulos: \", perc_nulos:4:2, \" %\")\n   escreval(\"Percentual brancos: \", perc_brancos:4:2, \" %\")\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_D",
    grupo: "manzano-p26",
    titulo: "ex26_D",
    descricao: "Ler a largura e a altura de um retangulo e apresentar a area e o perimetro.",
    codigo: "Algoritmo \"ex26_D\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler a largura e a altura de um retangulo e apresentar a area e o perimetro.\n// Autor(a)    : Matheus Coletti\nVar\n   largura: real\n   altura: real\n   area: real\n   perimetro: real\n\nInicio\n   escreval(\"Digite a largura do retangulo: \")\n   leia(largura)\n   escreval(\"Digite a altura do retangulo: \")\n   leia(altura)\n   area <- largura * altura\n   perimetro <- 2 * (largura + altura)\n   escreval(\"Area do retangulo: \", area:4:2)\n   escreval(\"Perimetro do retangulo: \", perimetro:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_E",
    grupo: "manzano-p26",
    titulo: "ex26_E",
    descricao: "Ler tres notas de um aluno e apresentar a media aritmetica delas.",
    codigo: "Algoritmo \"ex26_E\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler tres notas de um aluno e apresentar a media aritmetica delas.\n// Autor(a)    : Matheus Coletti\nVar\n   nota1: real\n   nota2: real\n   nota3: real\n   media: real\n\nInicio\n   escreval(\"Digite a primeira nota: \")\n   leia(nota1)\n   escreval(\"Digite a segunda nota: \")\n   leia(nota2)\n   escreval(\"Digite a terceira nota: \")\n   leia(nota3)\n   media <- (nota1 + nota2 + nota3) / 3\n   escreval(\"Media das notas: \", media:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_F",
    grupo: "manzano-p26",
    titulo: "ex26_F",
    descricao: "Ler horas, minutos e segundos de um intervalo de tempo e apresentar o total de segundos.",
    codigo: "Algoritmo \"ex26_F\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler horas, minutos e segundos de um intervalo de tempo e apresentar o total de segundos.\n// Autor(a)    : Matheus Coletti\nVar\n   horas: inteiro\n   minutos: inteiro\n   segundos: inteiro\n   total_segundos: inteiro\n\nInicio\n   escreval(\"Digite a quantidade de horas: \")\n   leia(horas)\n   escreval(\"Digite a quantidade de minutos: \")\n   leia(minutos)\n   escreval(\"Digite a quantidade de segundos: \")\n   leia(segundos)\n   total_segundos <- (horas * 3600) + (minutos * 60) + segundos\n   escreval(\"Total de segundos: \", total_segundos)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_G",
    grupo: "manzano-p26",
    titulo: "ex26_G",
    descricao: "Ler o peso e a altura de uma pessoa e apresentar o indice de massa corporal (IMC).",
    codigo: "Algoritmo \"ex26_G\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler o peso e a altura de uma pessoa e apresentar o indice de massa corporal (IMC).\n// Autor(a)    : Matheus Coletti\nVar\n   peso: real\n   altura: real\n   imc: real\n\nInicio\n   escreval(\"Digite o peso (kg): \")\n   leia(peso)\n   escreval(\"Digite a altura (m): \")\n   leia(altura)\n   imc <- peso / (altura * altura)\n   escreval(\"Indice de massa corporal: \", imc:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_H",
    grupo: "manzano-p26",
    titulo: "ex26_H",
    descricao: "Ler o preco de um produto e o percentual de desconto e apresentar o desconto e o preco final.",
    codigo: "Algoritmo \"ex26_H\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler o preco de um produto e o percentual de desconto e apresentar o desconto e o preco final.\n// Autor(a)    : Matheus Coletti\nVar\n   preco_original: real\n   percentual: real\n   desconto: real\n   preco_final: real\n\nInicio\n   escreval(\"Digite o preco do produto: R$ \")\n   leia(preco_original)\n   escreval(\"Digite o percentual de desconto: \")\n   leia(percentual)\n   desconto <- preco_original * percentual / 100\n   preco_final <- preco_original - desconto\n   escreval(\"Valor do desconto: R$\", desconto:4:2)\n   escreval(\"Preco final: R$\", preco_final:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_I",
    grupo: "manzano-p26",
    titulo: "ex26_I",
    descricao: "Ler o valor de uma compra e o valor pago pelo cliente e apresentar o troco.",
    codigo: "Algoritmo \"ex26_I\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler o valor de uma compra e o valor pago pelo cliente e apresentar o troco.\n// Autor(a)    : Matheus Coletti\nVar\n   valor_compra: real\n   valor_pago: real\n   troco: real\n\nInicio\n   escreval(\"Digite o valor da compra: R$ \")\n   leia(valor_compra)\n   escreval(\"Digite o valor pago: R$ \")\n   leia(valor_pago)\n   troco <- valor_pago - valor_compra\n   escreval(\"Valor da compra: R$\", valor_compra:4:2)\n   escreval(\"Valor pago: R$\", valor_pago:4:2)\n   escreval(\"Troco: R$\", troco:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_J",
    grupo: "manzano-p26",
    titulo: "ex26_J",
    descricao: "Ler o custo de um produto e seu preco de venda e apresentar o lucro e o percentual de lucro.",
    codigo: "Algoritmo \"ex26_J\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler o custo de um produto e seu preco de venda e apresentar o lucro e o percentual de lucro.\n// Autor(a)    : Matheus Coletti\nVar\n   custo: real\n   preco_venda: real\n   lucro: real\n   perc_lucro: real\n\nInicio\n   escreval(\"Digite o custo do produto: R$ \")\n   leia(custo)\n   escreval(\"Digite o preco de venda: R$ \")\n   leia(preco_venda)\n   lucro <- preco_venda - custo\n   perc_lucro <- (lucro * 100) / custo\n   escreval(\"Lucro obtido: R$\", lucro:4:2)\n   escreval(\"Percentual de lucro: \", perc_lucro:4:2, \" %\")\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_K",
    grupo: "manzano-p26",
    titulo: "ex26_K",
    descricao: "Ler capital, taxa de juros e tempo e apresentar os juros simples e o montante.",
    codigo: "Algoritmo \"ex26_K\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler capital, taxa de juros e tempo e apresentar os juros simples e o montante.\n// Autor(a)    : Matheus Coletti\nVar\n   capital: real\n   taxa: real\n   tempo: inteiro\n   juros: real\n   montante: real\n\nInicio\n   escreval(\"Digite o capital: R$ \")\n   leia(capital)\n   escreval(\"Digite a taxa de juros (% ao mes): \")\n   leia(taxa)\n   escreval(\"Digite o tempo (meses): \")\n   leia(tempo)\n   juros <- capital * taxa / 100 * tempo\n   montante <- capital + juros\n   escreval(\"Juros: R$\", juros:4:2)\n   escreval(\"Montante: R$\", montante:4:2)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_L",
    grupo: "manzano-p26",
    titulo: "ex26_L",
    descricao: "Ler a populacao e a area de um pais e apresentar a densidade demografica.",
    codigo: "Algoritmo \"ex26_L\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler a populacao e a area de um pais e apresentar a densidade demografica.\n// Autor(a)    : Matheus Coletti\nVar\n   populacao: inteiro\n   area: real\n   densidade: real\n\nInicio\n   escreval(\"Digite a populacao: \")\n   leia(populacao)\n   escreval(\"Digite a area (km2): \")\n   leia(area)\n   densidade <- populacao / area\n   escreval(\"Densidade demografica: \", densidade:4:2, \" habitantes por km2\")\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex26_M",
    grupo: "manzano-p26",
    titulo: "ex26_M",
    descricao: "Ler dois valores A e B, apresentar o produto (A*B) e a soma (A+B).",
    codigo: "Algoritmo \"ex26_M\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler dois valores A e B, apresentar o produto (A*B) e a soma (A+B).\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n\nInicio\n   escreval(\"Digite o valor de A: \")\n   leia(a)\n   escreval(\"Digite o valor de B: \")\n   leia(b)\n   escreval(\"Produto (A * B): \", a * b)\n   escreval(\"Soma (A + B): \", a + b)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_A",
    grupo: "manzano-p46",
    titulo: "ex46_A",
    descricao: "Apresentar os resultados de uma tabuada de multiplicar (de 1 ate 10) de um numero qualquer.",
    codigo: "Algoritmo \"ex46_A\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar os resultados de uma tabuada de multiplicar (de 1 ate 10) de um numero qualquer.\n// Autor(a)    : Matheus Coletti\nVar\n   numero: inteiro\n   i: inteiro\n\nInicio\n   escreval(\"Digite um numero: \")\n   leia(numero)\n   i <- 1\n   enquanto (i <= 10) faca\n      escreval(numero, \" x \", i, \" = \", numero * i)\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_B",
    grupo: "manzano-p46",
    titulo: "ex46_B",
    descricao: "Apresentar o total da soma obtida dos cem primeiros numeros inteiros (1+2+3+...+100).",
    codigo: "Algoritmo \"ex46_B\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar o total da soma obtida dos cem primeiros numeros inteiros (1+2+3+...+100).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   i <- 1\n   enquanto (i <= 100) faca\n      soma <- soma + i\n      i <- i + 1\n   fimenquanto\n   escreval(\"Soma de 1 a 100: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_C",
    grupo: "manzano-p46",
    titulo: "ex46_C",
    descricao: "Apresentar o somatorio dos valores pares de 1 a 500.",
    codigo: "Algoritmo \"ex46_C\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar o somatorio dos valores pares de 1 a 500.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   i <- 1\n   enquanto (i <= 500) faca\n      se (i % 2 = 0) entao\n         soma <- soma + i\n      fimse\n      i <- i + 1\n   fimenquanto\n   escreval(\"Soma dos pares de 1 a 500: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_D",
    grupo: "manzano-p46",
    titulo: "ex46_D",
    descricao: "Apresentar todos os valores inteiros impares de 0 a 20.",
    codigo: "Algoritmo \"ex46_D\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar todos os valores inteiros impares de 0 a 20.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   i <- 0\n   enquanto (i <= 20) faca\n      se (i % 2 <> 0) entao\n         escreval(i)\n      fimse\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_E",
    grupo: "manzano-p46",
    titulo: "ex46_E",
    descricao: "Apresentar as potencias de 3 (expoente 0 a 15).",
    codigo: "Algoritmo \"ex46_E\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar as potencias de 3 (expoente 0 a 15).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   resultado: inteiro\n\nInicio\n   i <- 0\n   enquanto (i <= 15) faca\n      resultado <- 3 ^ i\n      escreval(\"3 ^ \", i, \" = \", resultado)\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_F",
    grupo: "manzano-p46",
    titulo: "ex46_F",
    descricao: "Apresentar o valor de uma potencia de base qualquer elevada a expoente qualquer.",
    codigo: "Algoritmo \"ex46_F\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar o valor de uma potencia de base qualquer elevada a expoente qualquer.\n// Autor(a)    : Matheus Coletti\nVar\n   base: real\n   expoente: inteiro\n   resultado: real\n\nInicio\n   escreval(\"Digite a base: \")\n   leia(base)\n   escreval(\"Digite o expoente: \")\n   leia(expoente)\n   resultado <- base ^ expoente\n   escreval(base, \" ^ \", expoente, \" = \", resultado)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_G",
    grupo: "manzano-p46",
    titulo: "ex46_G",
    descricao: "Apresentar a serie de Fibonacci ate o decimo quinto termo.",
    codigo: "Algoritmo \"ex46_G\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar a serie de Fibonacci ate o decimo quinto termo.\n// Autor(a)    : Matheus Coletti\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\n   i: inteiro\n\nInicio\n   a <- 1\n   b <- 1\n   escreval(\"Serie de Fibonacci:\")\n   escreval(a)\n   escreval(b)\n   i <- 3\n   enquanto (i <= 15) faca\n      c <- a + b\n      escreval(c)\n      a <- b\n      b <- c\n      i <- i + 1\n   fimenquanto\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_H",
    grupo: "manzano-p46",
    titulo: "ex46_H",
    descricao: "Apresentar conversao Celsius para Fahrenheit (de 10 em 10, de 10 a 100).",
    codigo: "Algoritmo \"ex46_H\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar conversao Celsius para Fahrenheit (de 10 em 10, de 10 a 100).\n// Autor(a)    : Matheus Coletti\nVar\n   celsius: real\n   fahrenheit: real\n\nInicio\n   celsius <- 10\n   enquanto (celsius <= 100) faca\n      fahrenheit <- (9 * celsius + 160) / 5\n      escreval(celsius, \" C = \", fahrenheit:4:2, \" F\")\n      celsius <- celsius + 10\n   fimenquanto\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_I",
    grupo: "manzano-p46",
    titulo: "ex46_I",
    descricao: "Ler 10 valores e apresentar somatorio e media aritmetica.",
    codigo: "Algoritmo \"ex46_I\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 10 valores e apresentar somatorio e media aritmetica.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   valor: real\n   soma: real\n   media: real\n\nInicio\n   soma <- 0\n   i <- 1\n   enquanto (i <= 10) faca\n      escreval(\"Digite o valor \", i, \": \")\n      leia(valor)\n      soma <- soma + valor\n      i <- i + 1\n   fimenquanto\n   media <- soma / 10\n   escreval(\"Somatorio: \", soma)\n   escreval(\"Media aritmetica: \", media)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_J",
    grupo: "manzano-p46",
    titulo: "ex46_J",
    descricao: "Apresentar soma e media dos pares de 50 a 70.",
    codigo: "Algoritmo \"ex46_J\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar soma e media dos pares de 50 a 70.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n   cont: inteiro\n   media: real\n\nInicio\n   soma <- 0\n   cont <- 0\n   i <- 50\n   enquanto (i <= 70) faca\n      se (i % 2 = 0) entao\n         soma <- soma + i\n         cont <- cont + 1\n      fimse\n      i <- i + 1\n   fimenquanto\n   media <- soma / cont\n   escreval(\"Soma dos pares 50-70: \", soma)\n   escreval(\"Media aritmetica: \", media)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_K",
    grupo: "manzano-p46",
    titulo: "ex46_K",
    descricao: "Calcular area total de uma residencia. Ler nome, largura, comprimento. Repetir ate NAO.",
    codigo: "Algoritmo \"ex46_K\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular area total de uma residencia. Ler nome, largura, comprimento. Repetir ate NAO.\n// Autor(a)    : Matheus Coletti\nVar\n   nome: literal\n   largura: real\n   comprimento: real\n   area_comodo: real\n   area_total: real\n\nInicio\n   area_total <- 0\n   repita\n      escreval(\"Nome do comodo (ou NAO para terminar): \")\n      leia(nome)\n      se (nome <> \"NAO\") entao\n         escreval(\"Largura: \")\n         leia(largura)\n         escreval(\"Comprimento: \")\n         leia(comprimento)\n         area_comodo <- largura * comprimento\n         area_total <- area_total + area_comodo\n         escreval(\"Area do \", nome, \": \", area_comodo)\n      fimse\n   ate (nome = \"NAO\")\n   escreval(\"Area total residencial: \", area_total)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex46_L",
    grupo: "manzano-p46",
    titulo: "ex46_L",
    descricao: "Ler valores positivos ate valor negativo. Apresentar maior e menor.",
    codigo: "Algoritmo \"ex46_L\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler valores positivos ate valor negativo. Apresentar maior e menor.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: inteiro\n   maior: inteiro\n   menor: inteiro\n   primeiro: logico\n\nInicio\n   primeiro <- verdadeiro\n   repita\n      escreval(\"Digite um valor inteiro (negativo para terminar): \")\n      leia(valor)\n      se (valor >= 0) entao\n         se (primeiro) entao\n            maior <- valor\n            menor <- valor\n            primeiro <- falso\n         senao\n            se (valor > maior) entao\n               maior <- valor\n            fimse\n            se (valor < menor) entao\n               menor <- valor\n            fimse\n         fimse\n      fimse\n   ate (valor < 0)\n   se (nao primeiro) entao\n      escreval(\"Maior valor: \", maior)\n      escreval(\"Menor valor: \", menor)\n   senao\n      escreval(\"Nenhum valor positivo informado.\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_A",
    grupo: "manzano-p50",
    titulo: "ex50_A",
    descricao: "Apresentar quadrados dos numeros de 15 a 200.",
    codigo: "Algoritmo \"ex50_A\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar quadrados dos numeros de 15 a 200.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   i <- 15\n   repita\n      escreval(i, \" ^ 2 = \", i * i)\n      i <- i + 1\n   ate (i > 200)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_B",
    grupo: "manzano-p50",
    titulo: "ex50_B",
    descricao: "Somatorio dos pares de 1 a 500.",
    codigo: "Algoritmo \"ex50_B\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Somatorio dos pares de 1 a 500.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   i <- 1\n   repita\n      se (i % 2 = 0) entao\n         soma <- soma + i\n      fimse\n      i <- i + 1\n   ate (i > 500)\n   escreval(\"Somatorio dos pares 1-500: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_C",
    grupo: "manzano-p50",
    titulo: "ex50_C",
    descricao: "Apresentar numeros divisiveis por 4 menores que 200.",
    codigo: "Algoritmo \"ex50_C\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar numeros divisiveis por 4 menores que 200.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   i <- 1\n   repita\n      se (i % 4 = 0) entao\n         escreval(i)\n      fimse\n      i <- i + 1\n   ate (i > 200)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_D",
    grupo: "manzano-p50",
    titulo: "ex50_D",
    descricao: "Somatorio de graos no tabuleiro de xadrez (64 casas, dobrando a cada casa).",
    codigo: "Algoritmo \"ex50_D\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Somatorio de graos no tabuleiro de xadrez (64 casas, dobrando a cada casa).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   total: real\n   graos: real\n\nInicio\n   total <- 0\n   graos <- 1\n   i <- 1\n   repita\n      total <- total + graos\n      graos <- graos * 2\n      i <- i + 1\n   ate (i > 64)\n   escreval(\"Total de graos: \", total)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_E",
    grupo: "manzano-p50",
    titulo: "ex50_E",
    descricao: "Ler 15 valores e apresentar somatorio do fatorial de cada um.",
    codigo: "Algoritmo \"ex50_E\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 15 valores e apresentar somatorio do fatorial de cada um.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   valor: inteiro\n   j: inteiro\n   fatorial: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   i <- 1\n   repita\n      escreval(\"Digite o valor \", i, \": \")\n      leia(valor)\n      fatorial <- 1\n      j <- 1\n      repita\n         fatorial <- fatorial * j\n         j <- j + 1\n      ate (j > valor)\n      soma <- soma + fatorial\n      i <- i + 1\n   ate (i > 15)\n   escreval(\"Somatorio dos fatoriais: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_F",
    grupo: "manzano-p50",
    titulo: "ex50_F",
    descricao: "Ler valores positivos, mostrar soma, media e total. Parar com valor negativo.",
    codigo: "Algoritmo \"ex50_F\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler valores positivos, mostrar soma, media e total. Parar com valor negativo.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: real\n   soma: real\n   cont: inteiro\n   media: real\n\nInicio\n   soma <- 0\n   cont <- 0\n   repita\n      escreval(\"Digite um valor (negativo para terminar): \")\n      leia(valor)\n      se (valor >= 0) entao\n         soma <- soma + valor\n         cont <- cont + 1\n      fimse\n   ate (valor < 0)\n   se (cont > 0) entao\n      media <- soma / cont\n      escreval(\"Somatorio: \", soma)\n      escreval(\"Media: \", media)\n      escreval(\"Total de valores: \", cont)\n   senao\n      escreval(\"Nenhum valor positivo informado.\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_G",
    grupo: "manzano-p50",
    titulo: "ex50_G",
    descricao: "Apresentar fatorial dos impares de 1 a 10.",
    codigo: "Algoritmo \"ex50_G\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar fatorial dos impares de 1 a 10.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   j: inteiro\n   fatorial: inteiro\n\nInicio\n   i <- 1\n   repita\n      se (i % 2 <> 0) entao\n         fatorial <- 1\n         j <- 1\n         repita\n            fatorial <- fatorial * j\n            j <- j + 1\n         ate (j > i)\n         escreval(i, \"! = \", fatorial)\n      fimse\n      i <- i + 1\n   ate (i > 10)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_H",
    grupo: "manzano-p50",
    titulo: "ex50_H",
    descricao: "Area total de residencia. Ler comodos ate digitar NAO.",
    codigo: "Algoritmo \"ex50_H\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Area total de residencia. Ler comodos ate digitar NAO.\n// Autor(a)    : Matheus Coletti\nVar\n   nome: literal\n   largura: real\n   comprimento: real\n   area_comodo: real\n   area_total: real\n\nInicio\n   area_total <- 0\n   repita\n      escreval(\"Nome do comodo (ou NAO para terminar): \")\n      leia(nome)\n      se (nome <> \"NAO\") entao\n         escreval(\"Largura: \")\n         leia(largura)\n         escreval(\"Comprimento: \")\n         leia(comprimento)\n         area_comodo <- largura * comprimento\n         area_total <- area_total + area_comodo\n         escreval(\"Area do \", nome, \": \", area_comodo)\n      fimse\n   ate (nome = \"NAO\")\n   escreval(\"Area total: \", area_total)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_I",
    grupo: "manzano-p50",
    titulo: "ex50_I",
    descricao: "Ler valores positivos ate negativo. Mostrar maior e menor.",
    codigo: "Algoritmo \"ex50_I\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler valores positivos ate negativo. Mostrar maior e menor.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: inteiro\n   maior: inteiro\n   menor: inteiro\n   primeiro: logico\n\nInicio\n   primeiro <- verdadeiro\n   repita\n      escreval(\"Digite um valor (negativo para terminar): \")\n      leia(valor)\n      se (valor >= 0) entao\n         se (primeiro) entao\n            maior <- valor\n            menor <- valor\n            primeiro <- falso\n         senao\n            se (valor > maior) entao\n               maior <- valor\n            fimse\n            se (valor < menor) entao\n               menor <- valor\n            fimse\n         fimse\n      fimse\n   ate (valor < 0)\n   se (nao primeiro) entao\n      escreval(\"Maior: \", maior)\n      escreval(\"Menor: \", menor)\n   senao\n      escreval(\"Nenhum valor positivo informado.\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex50_J",
    grupo: "manzano-p50",
    titulo: "ex50_J",
    descricao: "Divisao inteira por subtracoes sucessivas (sem usar DIV).",
    codigo: "Algoritmo \"ex50_J\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Divisao inteira por subtracoes sucessivas (sem usar DIV).\n// Autor(a)    : Matheus Coletti\nVar\n   dividendo: inteiro\n   divisor: inteiro\n   quociente: inteiro\n\nInicio\n   escreval(\"Digite o dividendo: \")\n   leia(dividendo)\n   escreval(\"Digite o divisor: \")\n   leia(divisor)\n   quociente <- 0\n   repita\n      dividendo <- dividendo - divisor\n      quociente <- quociente + 1\n   ate (dividendo < divisor)\n   escreval(\"Quociente: \", quociente)\n   escreval(\"Resto: \", dividendo)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_A",
    grupo: "manzano-p66",
    titulo: "ex66_A",
    descricao: "Apresentar quadrados dos numeros de 15 a 200 (usando PARA).",
    codigo: "Algoritmo \"ex66_A\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Apresentar quadrados dos numeros de 15 a 200 (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   para i de 15 ate 200 faca\n      escreval(i, \" ^ 2 = \", i * i)\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_B",
    grupo: "manzano-p66",
    titulo: "ex66_B",
    descricao: "Tabuada de 1 a 10 de um numero qualquer (usando PARA).",
    codigo: "Algoritmo \"ex66_B\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Tabuada de 1 a 10 de um numero qualquer (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   numero: inteiro\n   i: inteiro\n\nInicio\n   escreval(\"Digite um numero: \")\n   leia(numero)\n   para i de 1 ate 10 faca\n      escreval(numero, \" x \", i, \" = \", numero * i)\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_C",
    grupo: "manzano-p66",
    titulo: "ex66_C",
    descricao: "Soma dos 100 primeiros numeros inteiros (1 a 100) - PARA.",
    codigo: "Algoritmo \"ex66_C\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Soma dos 100 primeiros numeros inteiros (1 a 100) - PARA.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   para i de 1 ate 100 faca\n      soma <- soma + i\n   fimpara\n   escreval(\"Soma de 1 a 100: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_D",
    grupo: "manzano-p66",
    titulo: "ex66_D",
    descricao: "Somatorio dos pares de 1 a 500 (usando PARA).",
    codigo: "Algoritmo \"ex66_D\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Somatorio dos pares de 1 a 500 (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   soma: inteiro\n\nInicio\n   soma <- 0\n   para i de 1 ate 500 faca\n      se (i % 2 = 0) entao\n         soma <- soma + i\n      fimse\n   fimpara\n   escreval(\"Somatorio dos pares 1-500: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_E",
    grupo: "manzano-p66",
    titulo: "ex66_E",
    descricao: "Impares de 0 a 20 (usando PARA).",
    codigo: "Algoritmo \"ex66_E\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Impares de 0 a 20 (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   para i de 0 ate 20 faca\n      se (i % 2 <> 0) entao\n         escreval(i)\n      fimse\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_F",
    grupo: "manzano-p66",
    titulo: "ex66_F",
    descricao: "Numeros divisiveis por 4 menores que 200 (usando PARA).",
    codigo: "Algoritmo \"ex66_F\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Numeros divisiveis por 4 menores que 200 (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n\nInicio\n   para i de 1 ate 200 faca\n      se (i % 4 = 0) entao\n         escreval(i)\n      fimse\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_G",
    grupo: "manzano-p66",
    titulo: "ex66_G",
    descricao: "Potencias de 3 (expoente 0 a 15) - PARA.",
    codigo: "Algoritmo \"ex66_G\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Potencias de 3 (expoente 0 a 15) - PARA.\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   resultado: inteiro\n\nInicio\n   para i de 0 ate 15 faca\n      resultado <- 3 ^ i\n      escreval(\"3 ^ \", i, \" = \", resultado)\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_H",
    grupo: "manzano-p66",
    titulo: "ex66_H",
    descricao: "Potencia de base qualquer elevada a expoente qualquer (PARA).",
    codigo: "Algoritmo \"ex66_H\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Potencia de base qualquer elevada a expoente qualquer (PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   base: real\n   expoente: inteiro\n   resultado: real\n   i: inteiro\n\nInicio\n   escreval(\"Digite a base: \")\n   leia(base)\n   escreval(\"Digite o expoente: \")\n   leia(expoente)\n   resultado <- 1\n   para i de 1 ate expoente faca\n      resultado <- resultado * base\n   fimpara\n   escreval(base, \" ^ \", expoente, \" = \", resultado)\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_I",
    grupo: "manzano-p66",
    titulo: "ex66_I",
    descricao: "Serie de Fibonacci ate 15o termo (usando PARA).",
    codigo: "Algoritmo \"ex66_I\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Serie de Fibonacci ate 15o termo (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   a: inteiro\n   b: inteiro\n   c: inteiro\n   i: inteiro\n\nInicio\n   a <- 1\n   b <- 1\n   escreval(\"Serie de Fibonacci:\")\n   escreval(a)\n   escreval(b)\n   para i de 3 ate 15 faca\n      c <- a + b\n      escreval(c)\n      a <- b\n      b <- c\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_J",
    grupo: "manzano-p66",
    titulo: "ex66_J",
    descricao: "Conversao Celsius para Fahrenheit (10 a 100, passo 10) - PARA.",
    codigo: "Algoritmo \"ex66_J\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Conversao Celsius para Fahrenheit (10 a 100, passo 10) - PARA.\n// Autor(a)    : Matheus Coletti\nVar\n   celsius: real\n   fahrenheit: real\n\nInicio\n   para celsius de 10 ate 100 passo 10 faca\n      fahrenheit <- (9 * celsius + 160) / 5\n      escreval(celsius, \" C = \", fahrenheit:4:2, \" F\")\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "manzano/ex66_K",
    grupo: "manzano-p66",
    titulo: "ex66_K",
    descricao: "Fatorial dos impares de 1 a 10 (usando PARA).",
    codigo: "Algoritmo \"ex66_K\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Fatorial dos impares de 1 a 10 (usando PARA).\n// Autor(a)    : Matheus Coletti\nVar\n   i: inteiro\n   j: inteiro\n   fatorial: inteiro\n\nInicio\n   para i de 1 ate 10 faca\n      se (i % 2 <> 0) entao\n         fatorial <- 1\n         para j de 1 ate i faca\n            fatorial <- fatorial * j\n         fimpara\n         escreval(i, \"! = \", fatorial)\n      fimse\n   fimpara\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex05",
    grupo: "faccat-p4",
    titulo: "ex05",
    descricao: "Ler um valor e escrever o seu antecessor (valor - 1)",
    codigo: "Algoritmo \"ex05\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler um valor e escrever o seu antecessor (valor - 1)\n// Autor(a)    : Matheus Coletti\nVar\n   numero: real\n\nInicio\n   escreval(\"Informe um numero: \")\n   leia(numero)\n   \n   escreval(\"O antecessor e: \", numero - 1)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex06",
    grupo: "faccat-p4",
    titulo: "ex06",
    descricao: "Ler a base e a altura de um retângulo e calcular a área (base * altura)",
    codigo: "Algoritmo \"ex06\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler a base e a altura de um retângulo e calcular a área (base * altura)\n// Autor(a)    : Matheus Coletti\nVar\n   base: real\n   altura: real\n   area: real\n\nInicio\n   escreval(\"Informe a base: \")\n   leia(base)\n   escreval(\"Informe a altura: \")\n   leia(altura)\n   \n   area <- base * altura\n   \n   escreval(\"Area do retangulo: \", area)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex07",
    grupo: "faccat-p4",
    titulo: "ex07",
    descricao: "Ler anos, meses e dias de idade e calcular o total em dias (anos*365 + meses*30 + dias)",
    codigo: "Algoritmo \"ex07\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler anos, meses e dias de idade e calcular o total em dias (anos*365 + meses*30 + dias)\n// Autor(a)    : Matheus Coletti\nVar\n   anos: real\n   meses: real\n   dias: real\n   total_dias: real\n\nInicio\n   escreval(\"Informe anos: \")\n   leia(anos)\n   escreval(\"Informe meses: \")\n   leia(meses)\n   escreval(\"Informe dias: \")\n   leia(dias)\n   \n   total_dias <- (anos * 365) + (meses * 30) + dias\n   \n   escreval(\"Idade em dias: \", total_dias)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex08",
    grupo: "faccat-p4",
    titulo: "ex08",
    descricao: "Ler total de eleitores, brancos, nulos e válidos, calcular percentual de cada",
    codigo: "Algoritmo \"ex08\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler total de eleitores, brancos, nulos e válidos, calcular percentual de cada\n// Autor(a)    : Matheus Coletti\nVar\n   total_eleitores: real\n   brancos: real\n   nulos: real\n   validos: real\n   perc_brancos: real\n   perc_nulos: real\n   perc_validos: real\n\nInicio\n   escreval(\"Total de eleitores: \")\n   leia(total_eleitores)\n   escreval(\"Brancos: \")\n   leia(brancos)\n   escreval(\"Nulos: \")\n   leia(nulos)\n   escreval(\"Validos: \")\n   leia(validos)\n   \n   perc_brancos <- (brancos / total_eleitores) * 100\n   perc_nulos <- (nulos / total_eleitores) * 100\n   perc_validos <- (validos / total_eleitores) * 100\n   \n   escreval(\"Percentual brancos: \", perc_brancos, \" %\")\n   escreval(\"Percentual nulos: \", perc_nulos, \" %\")\n   escreval(\"Percentual validos: \", perc_validos, \" %\")\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex09",
    grupo: "faccat-p4",
    titulo: "ex09",
    descricao: "Ler salário e percentual de reajuste, calcular novo salário",
    codigo: "Algoritmo \"ex09\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler salário e percentual de reajuste, calcular novo salário\n// Autor(a)    : Matheus Coletti\nVar\n   salario: real\n   percentual: real\n   novo_salario: real\n\nInicio\n   escreval(\"Salario atual: \")\n   leia(salario)\n   escreval(\"Percentual de reajuste: \")\n   leia(percentual)\n   \n   novo_salario <- salario + (salario * percentual / 100)\n   \n   escreval(\"Novo salario: \", novo_salario)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex10",
    grupo: "faccat-p4",
    titulo: "ex10",
    descricao: "Ler custo de fábrica, calcular custo final com 28% distribuidor + 45% impostos",
    codigo: "Algoritmo \"ex10\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler custo de fábrica, calcular custo final com 28% distribuidor + 45% impostos\n// Autor(a)    : Matheus Coletti\nVar\n   custo_fabrica: real\n   custo_final: real\n\nInicio\n   escreval(\"Custo de fabrica: \")\n   leia(custo_fabrica)\n   \n   custo_final <- custo_fabrica + (custo_fabrica * 0.28) + (custo_fabrica * 0.45)\n   \n   escreval(\"Custo final ao consumidor: \", custo_final)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex11",
    grupo: "faccat-p4",
    titulo: "ex11",
    descricao: "Ler salário fixo, total de vendas e valor por carro, calcular salário final (fixo + carros*valor + 5% vendas)",
    codigo: "Algoritmo \"ex11\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler salário fixo, total de vendas e valor por carro, calcular salário final (fixo + carros*valor + 5% vendas)\n// Autor(a)    : Matheus Coletti\nVar\n   salario_fixo: real\n   total_vendas: real\n   valor_por_carro: real\n   salario_final: real\n\nInicio\n   escreval(\"Salario fixo: \")\n   leia(salario_fixo)\n   escreval(\"Total de vendas: \")\n   leia(total_vendas)\n   escreval(\"Valor por carro vendido: \")\n   leia(valor_por_carro)\n   \n   salario_final <- salario_fixo + (valor_por_carro * 5) + (total_vendas * 0.05)\n   \n   escreval(\"Salario final: \", salario_final)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex12",
    grupo: "faccat-p5",
    titulo: "ex12",
    descricao: "Ler temperatura em Fahrenheit, calcular Celsius ((f-32)*5/9)",
    codigo: "Algoritmo \"ex12\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler temperatura em Fahrenheit, calcular Celsius ((f-32)*5/9)\n// Autor(a)    : Matheus Coletti\nVar\n   fahrenheit: real\n   celsius: real\n\nInicio\n   escreval(\"Informe temperatura Fahrenheit: \")\n   leia(fahrenheit)\n   \n   celsius <- (fahrenheit - 32) * 5 / 9\n   \n   escreval(\"Em Celsius: \", celsius)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex13",
    grupo: "faccat-p5",
    titulo: "ex13",
    descricao: "Ler tres notas de um aluno e calcular a media final, que e ponderada e tem os pesos 2, 3 e 5.",
    codigo: "Algoritmo \"ex13\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler tres notas de um aluno e calcular a media final, que e ponderada e tem os pesos 2, 3 e 5.\n// Autor(a)    : Matheus Coletti\nVar\n   n1: real\n   n2: real\n   n3: real\n   media_final: real\n\nInicio\n   escreval(\"Nota 1: \")\n   leia(n1)\n   escreval(\"Nota 2: \")\n   leia(n2)\n   escreval(\"Nota 3: \")\n   leia(n3)\n\n   media_final <- (n1 * 2 + n2 * 3 + n3 * 5) / 10\n\n   escreval(\"Media final: \", media_final:4:2)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex14",
    grupo: "faccat-p5-6",
    titulo: "ex14",
    descricao: "Ler um valor e informar se e maior que 10.",
    codigo: "Algoritmo \"ex14\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler um valor e informar se e maior que 10.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: real\n\nInicio\n   escreval(\"Informe um valor: \")\n   leia(valor)\n   se (valor > 10) entao\n      escreval(\"E MAIOR QUE 10!\")\n   senao\n      escreval(\"NAO E MAIOR QUE 10!\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex15",
    grupo: "faccat-p5-6",
    titulo: "ex15",
    descricao: "Ler um valor e informar se e positivo ou negativo.",
    codigo: "Algoritmo \"ex15\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler um valor e informar se e positivo ou negativo.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: real\n\nInicio\n   escreval(\"Informe um valor: \")\n   leia(valor)\n   se (valor >= 0) entao\n      escreval(\"POSITIVO\")\n   senao\n      escreval(\"NEGATIVO\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex16",
    grupo: "faccat-p5-6",
    titulo: "ex16",
    descricao: "Ler quantidade de macas. Se menor que 12, preco R$ 1,30. Senao, preco R$ 1,00. Calcular total.",
    codigo: "Algoritmo \"ex16\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler quantidade de macas. Se menor que 12, preco R$ 1,30. Senao, preco R$ 1,00. Calcular total.\n// Autor(a)    : Matheus Coletti\nVar\n   qtd: inteiro\n   preco: real\n   total: real\n\nInicio\n   escreval(\"Informe a quantidade de macas: \")\n   leia(qtd)\n   se (qtd < 12) entao\n      preco <- 1.30\n   senao\n      preco <- 1.00\n   fimse\n   total <- qtd * preco\n   escreval(\"Total a pagar: \", total)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex17",
    grupo: "faccat-p5-6",
    titulo: "ex17",
    descricao: "Ler duas notas, calcular media. Se media >= 6, APROVADO. Senao, REPROVADO.",
    codigo: "Algoritmo \"ex17\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler duas notas, calcular media. Se media >= 6, APROVADO. Senao, REPROVADO.\n// Autor(a)    : Matheus Coletti\nVar\n   n1: real\n   n2: real\n   media: real\n\nInicio\n   escreval(\"Informe a primeira nota: \")\n   leia(n1)\n   escreval(\"Informe a segunda nota: \")\n   leia(n2)\n   media <- (n1 + n2) / 2\n   se (media >= 6) entao\n      escreval(\"APROVADO\")\n   senao\n      escreval(\"REPROVADO\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex18",
    grupo: "faccat-p5-6",
    titulo: "ex18",
    descricao: "Ler ano atual e ano de nascimento. Calcular idade. Se >= 16, pode votar.",
    codigo: "Algoritmo \"ex18\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler ano atual e ano de nascimento. Calcular idade. Se >= 16, pode votar.\n// Autor(a)    : Matheus Coletti\nVar\n   ano_atual: inteiro\n   ano_nasc: inteiro\n   idade: inteiro\n\nInicio\n   escreval(\"Informe o ano atual: \")\n   leia(ano_atual)\n   escreval(\"Informe o ano de nascimento: \")\n   leia(ano_nasc)\n   idade <- ano_atual - ano_nasc\n   se (idade >= 16) entao\n      escreval(\"Pode votar!\")\n   senao\n      escreval(\"Nao pode votar!\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex19",
    grupo: "faccat-p5-6",
    titulo: "ex19",
    descricao: "Ler dois valores e apresentar o maior deles.",
    codigo: "Algoritmo \"ex19\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler dois valores e apresentar o maior deles.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   maior: real\n\nInicio\n   escreval(\"Informe o valor de A: \")\n   leia(a)\n   escreval(\"Informe o valor de B: \")\n   leia(b)\n   se (a > b) entao\n      maior <- a\n   senao\n      maior <- b\n   fimse\n   escreval(\"O maior valor e: \", maior)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex20",
    grupo: "faccat-p5-6",
    titulo: "ex20",
    descricao: "Ler dois valores e ordena-los em ordem crescente.",
    codigo: "Algoritmo \"ex20\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler dois valores e ordena-los em ordem crescente.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   temp: real\n\nInicio\n   escreval(\"Informe o valor de A: \")\n   leia(a)\n   escreval(\"Informe o valor de B: \")\n   leia(b)\n   se (a > b) entao\n      temp <- a\n      a <- b\n      b <- temp\n   fimse\n   escreval(\"Valores em ordem crescente: \", a, \" \", b)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex21",
    grupo: "faccat-p5-6",
    titulo: "ex21",
    descricao: "Ler hora inicio e hora fim de um evento. Calcular duracao.",
    codigo: "Algoritmo \"ex21\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler hora inicio e hora fim de um evento. Calcular duracao.\n// Autor(a)    : Matheus Coletti\nVar\n   inicio: inteiro\n   fim: inteiro\n   duracao: inteiro\n\nInicio\n   escreval(\"Informe a hora de inicio: \")\n   leia(inicio)\n   escreval(\"Informe a hora de fim: \")\n   leia(fim)\n   se (fim >= inicio) entao\n      duracao <- fim - inicio\n   senao\n      duracao <- 24 - inicio + fim\n   fimse\n   escreval(\"Duracao: \", duracao, \" horas\")\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex22",
    grupo: "faccat-p5-6",
    titulo: "ex22",
    descricao: "Calcular salario com hora extra. Se horas > 160, extras com 50% de acrescimo.",
    codigo: "Algoritmo \"ex22\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular salario com hora extra. Se horas > 160, extras com 50% de acrescimo.\n// Autor(a)    : Matheus Coletti\nVar\n   horas_mes: real\n   salario_hora: real\n   horas_extra: real\n   valor_extra: real\n   salario_total: real\n\nInicio\n   escreval(\"Informe as horas trabalhadas no mes: \")\n   leia(horas_mes)\n   escreval(\"Informe o salario por hora: \")\n   leia(salario_hora)\n   se (horas_mes > 160) entao\n      horas_extra <- horas_mes - 160\n      valor_extra <- horas_extra * salario_hora * 1.5\n      salario_total <- 160 * salario_hora + valor_extra\n   senao\n      salario_total <- horas_mes * salario_hora\n   fimse\n   escreval(\"Salario total: \", salario_total)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex23",
    grupo: "faccat-p5-6",
    titulo: "ex23",
    descricao: "Ler nome, altura e sexo (M ou F) de uma pessoa e calcular o peso ideal. Para sexo masculino: 72.7 * altura - 58. Para sexo feminino: 62.1 * altura - 44.7.",
    codigo: "Algoritmo \"ex23\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler nome, altura e sexo (M ou F) de uma pessoa e calcular o peso ideal. Para sexo masculino: 72.7 * altura - 58. Para sexo feminino: 62.1 * altura - 44.7.\n// Autor(a)    : Matheus Coletti\nVar\n   nome: caractere\n   altura: real\n   sexo: caractere\n   peso_ideal: real\n\nInicio\n   escreval(\"Nome: \")\n   leia(nome)\n   escreval(\"Altura (m): \")\n   leia(altura)\n   escreval(\"Sexo (M ou F): \")\n   leia(sexo)\n\n   se (sexo = \"M\") ou (sexo = \"m\") entao\n      peso_ideal <- 72.7 * altura - 58\n   senao\n      peso_ideal <- 62.1 * altura - 44.7\n   fimse\n\n   escreval(\"Peso ideal de \", nome, \": \", peso_ideal:6:2, \" kg\")\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex24",
    grupo: "faccat-p5-6",
    titulo: "ex24",
    descricao: "Calcular salario fixo + comissao. Comissao: 3% ate R$ 1500, 5% acima de R$ 1500.",
    codigo: "Algoritmo \"ex24\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular salario fixo + comissao. Comissao: 3% ate R$ 1500, 5% acima de R$ 1500.\n// Autor(a)    : Matheus Coletti\nVar\n   salario_fixo: real\n   valor_vendas: real\n   comissao: real\n   total: real\n\nInicio\n   escreval(\"Informe o salario fixo: \")\n   leia(salario_fixo)\n   escreval(\"Informe o valor das vendas: \")\n   leia(valor_vendas)\n   se (valor_vendas <= 1500) entao\n      comissao <- valor_vendas * 0.03\n   senao\n      comissao <- 1500 * 0.03 + (valor_vendas - 1500) * 0.05\n   fimse\n   total <- salario_fixo + comissao\n   escreval(\"Total a receber: \", total)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex25",
    grupo: "faccat-p5-6",
    titulo: "ex25",
    descricao: "Ler salario fixo, vendas, debitos e creditos. Calcular saldo. Informar se positivo ou negativo.",
    codigo: "Algoritmo \"ex25\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler salario fixo, vendas, debitos e creditos. Calcular saldo. Informar se positivo ou negativo.\n// Autor(a)    : Matheus Coletti\nVar\n   salario_fixo: real\n   vendas: real\n   debitos: real\n   creditos: real\n   saldo: real\n\nInicio\n   escreval(\"Informe o salario fixo: \")\n   leia(salario_fixo)\n   escreval(\"Informe o valor das vendas: \")\n   leia(vendas)\n   escreval(\"Informe o valor dos debitos: \")\n   leia(debitos)\n   escreval(\"Informe o valor dos creditos: \")\n   leia(creditos)\n   saldo <- salario_fixo - debitos + creditos\n   se (saldo >= 0) entao\n      escreval(\"Saldo positivo\")\n   senao\n      escreval(\"Saldo negativo\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex26",
    grupo: "faccat-p5-6",
    titulo: "ex26",
    descricao: "Calcular estoque medio. Se estoque atual >= medio, nao efetuar compra. Senao, efetuar compra.",
    codigo: "Algoritmo \"ex26\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular estoque medio. Se estoque atual >= medio, nao efetuar compra. Senao, efetuar compra.\n// Autor(a)    : Matheus Coletti\nVar\n   estoque_atual: real\n   estoque_max: real\n   estoque_min: real\n   estoque_medio: real\n\nInicio\n   escreval(\"Informe o estoque atual: \")\n   leia(estoque_atual)\n   escreval(\"Informe o estoque maximo: \")\n   leia(estoque_max)\n   escreval(\"Informe o estoque minimo: \")\n   leia(estoque_min)\n   estoque_medio <- (estoque_max + estoque_min) / 2\n   se (estoque_atual >= estoque_medio) entao\n      escreval(\"Nao efetuar compra\")\n   senao\n      escreval(\"Efetuar compra\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex27",
    grupo: "faccat-p6-8",
    titulo: "ex27",
    descricao: "Ler um valor e escrever se e positivo, negativo ou zero.",
    codigo: "Algoritmo \"ex27\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler um valor e escrever se e positivo, negativo ou zero.\n// Autor(a)    : Matheus Coletti\nVar\n   valor: real\n\nInicio\n   escreval(\"Digite um valor: \")\n   leia(valor)\n   se (valor > 0) entao\n      escreval(\"POSITIVO\")\n   senao\n      se (valor < 0) entao\n         escreval(\"NEGATIVO\")\n      senao\n         escreval(\"ZERO\")\n      fimse\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex28",
    grupo: "faccat-p6-8",
    titulo: "ex28",
    descricao: "Ler 3 valores e escrever o maior deles.",
    codigo: "Algoritmo \"ex28\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 3 valores e escrever o maior deles.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n   maior: real\n\nInicio\n   escreval(\"Digite o primeiro valor: \")\n   leia(a)\n   escreval(\"Digite o segundo valor: \")\n   leia(b)\n   escreval(\"Digite o terceiro valor: \")\n   leia(c)\n   maior <- a\n   se (b > maior) entao\n      maior <- b\n   fimse\n   se (c > maior) entao\n      maior <- c\n   fimse\n   escreval(\"O maior valor e: \", maior)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex29",
    grupo: "faccat-p6-8",
    titulo: "ex29",
    descricao: "Ler 3 valores e escrever a soma dos 2 maiores.",
    codigo: "Algoritmo \"ex29\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 3 valores e escrever a soma dos 2 maiores.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n   maior1: real\n   maior2: real\n   soma: real\n\nInicio\n   escreval(\"Digite o primeiro valor: \")\n   leia(a)\n   escreval(\"Digite o segundo valor: \")\n   leia(b)\n   escreval(\"Digite o terceiro valor: \")\n   leia(c)\n   se (a >= b) e (a >= c) entao\n      maior1 <- a\n      se (b >= c) entao\n         maior2 <- b\n      senao\n         maior2 <- c\n      fimse\n   senao\n      se (b >= a) e (b >= c) entao\n         maior1 <- b\n         se (a >= c) entao\n            maior2 <- a\n         senao\n            maior2 <- c\n         fimse\n      senao\n         maior1 <- c\n         se (a >= b) entao\n            maior2 <- a\n         senao\n            maior2 <- b\n         fimse\n      fimse\n   fimse\n   soma <- maior1 + maior2\n   escreval(\"A soma dos dois maiores e: \", soma)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex30",
    grupo: "faccat-p6-8",
    titulo: "ex30",
    descricao: "Ler 3 valores e escrever eles em ordem crescente.",
    codigo: "Algoritmo \"ex30\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 3 valores e escrever eles em ordem crescente.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n   temp: real\n\nInicio\n   escreval(\"Digite o primeiro valor: \")\n   leia(a)\n   escreval(\"Digite o segundo valor: \")\n   leia(b)\n   escreval(\"Digite o terceiro valor: \")\n   leia(c)\n   se (a > b) entao\n      temp <- a\n      a <- b\n      b <- temp\n   fimse\n   se (b > c) entao\n      temp <- b\n      b <- c\n      c <- temp\n   fimse\n   se (a > b) entao\n      temp <- a\n      a <- b\n      b <- temp\n   fimse\n   escreval(\"Valores em ordem crescente: \", a, \", \", b, \", \", c)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex31",
    grupo: "faccat-p6-8",
    titulo: "ex31",
    descricao: "Ler 3 lados de um triangulo e escrever se formam triangulo e qual tipo (equilatero, isosceles, escaleno).",
    codigo: "Algoritmo \"ex31\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 3 lados de um triangulo e escrever se formam triangulo e qual tipo (equilatero, isosceles, escaleno).\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n   c: real\n   forma_triangulo: logico\n\nInicio\n   escreval(\"Digite o lado A: \")\n   leia(a)\n   escreval(\"Digite o lado B: \")\n   leia(b)\n   escreval(\"Digite o lado C: \")\n   leia(c)\n   forma_triangulo <- (a < b + c) e (b < a + c) e (c < a + b)\n   se (forma_triangulo) entao\n      se (a = b) e (b = c) entao\n         escreval(\"Triangulo Equilatero\")\n      senao\n         se (a = b) ou (b = c) ou (a = c) entao\n            escreval(\"Triangulo Isosceles\")\n         senao\n            escreval(\"Triangulo Escaleno\")\n         fimse\n      fimse\n   senao\n      escreval(\"Nao formam um triangulo\")\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex32",
    grupo: "faccat-p6-8",
    titulo: "ex32",
    descricao: "Ler 2 times e gols, escrever vencedor ou EMPATE.",
    codigo: "Algoritmo \"ex32\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 2 times e gols, escrever vencedor ou EMPATE.\n// Autor(a)    : Matheus Coletti\nVar\n   time1: literal\n   time2: literal\n   gols1: inteiro\n   gols2: inteiro\n\nInicio\n   escreval(\"Digite o nome do primeiro time: \")\n   leia(time1)\n   escreval(\"Digite o nome do segundo time: \")\n   leia(time2)\n   escreval(\"Digite os gols do \", time1, \": \")\n   leia(gols1)\n   escreval(\"Digite os gols do \", time2, \": \")\n   leia(gols2)\n   se (gols1 > gols2) entao\n      escreval(\"Vencedor: \", time1)\n   senao\n      se (gols2 > gols1) entao\n         escreval(\"Vencedor: \", time2)\n      senao\n         escreval(\"EMPATE\")\n      fimse\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex33",
    grupo: "faccat-p6-8",
    titulo: "ex33",
    descricao: "Ler 2 valores, escrever se iguais, primeiro maior ou segundo maior.",
    codigo: "Algoritmo \"ex33\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler 2 valores, escrever se iguais, primeiro maior ou segundo maior.\n// Autor(a)    : Matheus Coletti\nVar\n   a: real\n   b: real\n\nInicio\n   escreval(\"Digite o primeiro valor: \")\n   leia(a)\n   escreval(\"Digite o segundo valor: \")\n   leia(b)\n   se (a = b) entao\n      escreval(\"Numeros iguais\")\n   senao\n      se (a > b) entao\n         escreval(\"Primeiro maior\")\n      senao\n         escreval(\"Segundo maior\")\n      fimse\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex34",
    grupo: "faccat-p6-8",
    titulo: "ex34",
    descricao: "Ler x e y, z = (x*y)+5, se z<=0 escrever A, se z<=100 escrever B, senao C.",
    codigo: "Algoritmo \"ex34\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler x e y, z = (x*y)+5, se z<=0 escrever A, se z<=100 escrever B, senao C.\n// Autor(a)    : Matheus Coletti\nVar\n   x: real\n   y: real\n   z: real\n   resposta: literal\n\nInicio\n   escreval(\"Digite o valor de x: \")\n   leia(x)\n   escreval(\"Digite o valor de y: \")\n   leia(y)\n   z <- (x * y) + 5\n   se (z <= 0) entao\n      resposta <- \"A\"\n   senao\n      se (z <= 100) entao\n         resposta <- \"B\"\n      senao\n         resposta <- \"C\"\n      fimse\n   fimse\n   escreval(\"z = \", z, \", Resposta = \", resposta)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex35",
    grupo: "faccat-p6-8",
    titulo: "ex35",
    descricao: "Calcular valor do combustivel com desconto. Ler litros e tipo (A-alcool, G-gasolina).",
    codigo: "Algoritmo \"ex35\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Calcular valor do combustivel com desconto. Ler litros e tipo (A-alcool, G-gasolina).\n// Autor(a)    : Matheus Coletti\nVar\n   litros: real\n   tipo: literal\n   preco_alcool: real\n   preco_gasolina: real\n   desconto: real\n   total_pagar: real\n\nInicio\n   escreval(\"Litros vendidos: \")\n   leia(litros)\n   escreval(\"Tipo (A-alcool, G-gasolina): \")\n   leia(tipo)\n   preco_alcool <- 2.90\n   preco_gasolina <- 3.30\n   se (tipo = 'A') entao\n      total_pagar <- litros * preco_alcool\n   senao\n      se (tipo = 'G') entao\n         total_pagar <- litros * preco_gasolina\n      fimse\n   fimse\n   se (litros <= 20) entao\n      desconto <- total_pagar * 0.03\n   senao\n      desconto <- total_pagar * 0.05\n   fimse\n   total_pagar <- total_pagar - desconto\n   escreval(\"Total a pagar: \", total_pagar:4:2)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex36",
    grupo: "faccat-p6-8",
    titulo: "ex36",
    descricao: "Ler idades de 2 homens e 2 mulheres, soma do homem mais velho com mulher mais nova, produto do homem mais novo com mulher mais velha.",
    codigo: "Algoritmo \"ex36\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler idades de 2 homens e 2 mulheres, soma do homem mais velho com mulher mais nova, produto do homem mais novo com mulher mais velha.\n// Autor(a)    : Matheus Coletti\nVar\n   h1: inteiro\n   h2: inteiro\n   m1: inteiro\n   m2: inteiro\n   homem_velho: inteiro\n   homem_novo: inteiro\n   mulher_velha: inteiro\n   mulher_nova: inteiro\n   soma: inteiro\n   produto: inteiro\n\nInicio\n   escreval(\"Idade homem 1: \")\n   leia(h1)\n   escreval(\"Idade homem 2: \")\n   leia(h2)\n   escreval(\"Idade mulher 1: \")\n   leia(m1)\n   escreval(\"Idade mulher 2: \")\n   leia(m2)\n   se (h1 > h2) entao\n      homem_velho <- h1\n      homem_novo <- h2\n   senao\n      homem_velho <- h2\n      homem_novo <- h1\n   fimse\n   se (m1 > m2) entao\n      mulher_velha <- m1\n      mulher_nova <- m2\n   senao\n      mulher_velha <- m2\n      mulher_nova <- m1\n   fimse\n   soma <- homem_velho + mulher_nova\n   produto <- homem_novo * mulher_velha\n   escreval(\"Soma (homem velho + mulher nova): \", soma)\n   escreval(\"Produto (homem novo * mulher velha): \", produto)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex37",
    grupo: "faccat-p6-8",
    titulo: "ex37",
    descricao: "Ler kg de morangos e macas, precos diferentes ate 5kg e acima, se total >8kg ou >25 dar 10% desconto.",
    codigo: "Algoritmo \"ex37\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler kg de morangos e macas, precos diferentes ate 5kg e acima, se total >8kg ou >25 dar 10% desconto.\n// Autor(a)    : Matheus Coletti\nVar\n   kg_morangos: real\n   kg_macas: real\n   preco_morango: real\n   preco_maca: real\n   total: real\n   desconto: real\n\nInicio\n   escreval(\"Kg de morangos: \")\n   leia(kg_morangos)\n   escreval(\"Kg de macas: \")\n   leia(kg_macas)\n   se (kg_morangos <= 5) entao\n      preco_morango <- 2.50\n   senao\n      preco_morango <- 2.20\n   fimse\n   se (kg_macas <= 5) entao\n      preco_maca <- 1.80\n   senao\n      preco_maca <- 1.50\n   fimse\n   total <- (kg_morangos * preco_morango) + (kg_macas * preco_maca)\n   se ((kg_morangos + kg_macas > 8) ou (total > 25)) entao\n      desconto <- total * 0.10\n      total <- total - desconto\n   fimse\n   escreval(\"Total a pagar: \", total)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex38",
    grupo: "faccat-p6-8",
    titulo: "ex38",
    descricao: "Ler codigo, se diferente de 1234 \"Usuario invalido\", senha se diferente de 9999 \"Senha incorreta\" senao \"Acesso permitido\".",
    codigo: "Algoritmo \"ex38\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Ler codigo, se diferente de 1234 \"Usuario invalido\", senha se diferente de 9999 \"Senha incorreta\" senao \"Acesso permitido\".\n// Autor(a)    : Matheus Coletti\nVar\n   codigo: inteiro\n   senha: inteiro\n\nInicio\n   escreval(\"Digite o codigo: \")\n   leia(codigo)\n   se (codigo <> 1234) entao\n      escreval(\"Usuario invalido!\")\n   senao\n      escreval(\"Digite a senha: \")\n      leia(senha)\n      se (senha <> 9999) entao\n         escreval(\"Senha incorreta!\")\n      senao\n         escreval(\"Acesso permitido!\")\n      fimse\n   fimse\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex39",
    grupo: "faccat-p8",
    titulo: "ex39",
    descricao: "Para A=V, B=V, C=F, avaliar expressoes logicas: a) (A e B) ou (A xou B), b) (A ou B) e (A e C), c) A ou C e B xou A e nao B.",
    codigo: "Algoritmo \"ex39\"\n// Professor   : Jailson Costa dos Santos\n// Descricao   : Para A=V, B=V, C=F, avaliar expressoes logicas: a) (A e B) ou (A xou B), b) (A ou B) e (A e C), c) A ou C e B xou A e nao B.\n// Autor(a)    : Matheus Coletti\nVar\n   a: logico\n   b: logico\n   c: logico\n   res_a: logico\n   res_b: logico\n   res_c: logico\n\nInicio\n   a <- verdadeiro\n   b <- verdadeiro\n   c <- falso\n   res_a <- (a e b) ou (a <> b)\n   res_b <- (a ou b) e (a e c)\n   res_c <- a ou c e b <> a e (nao b)\n   escreval(\"a) (A e B) ou (A xou B) = \", res_a)\n   escreval(\"b) (A ou B) e (A e C) = \", res_b)\n   escreval(\"c) A ou C e B xou A e nao B = \", res_c)\nFimalgoritmo\n"
  },
  {
    id: "faccat/ex41",
    grupo: "faccat-p8",
    titulo: "ex41",
    descricao: "Ler 3 notas e média dos exercícios, calcular média de aproveitamento ((n1 + n2*2 + n3*3 + media_ex)/7)",
    codigo: "Algoritmo \"ex41\"\n// Professor   : Jailson Costa dos Santos\n// Descrição   : Ler 3 notas e média dos exercícios, calcular média de aproveitamento ((n1 + n2*2 + n3*3 + media_ex)/7)\n// Autor(a)    : Matheus Coletti\nVar\n   n1: real\n   n2: real\n   n3: real\n   media_exercicios: real\n   media_aproveitamento: real\n\nInicio\n   escreval(\"Nota 1: \")\n   leia(n1)\n   escreval(\"Nota 2: \")\n   leia(n2)\n   escreval(\"Nota 3: \")\n   leia(n3)\n   escreval(\"Media dos exercicios: \")\n   leia(media_exercicios)\n   \n   media_aproveitamento <- (n1 + n2 * 2 + n3 * 3 + media_exercicios) / 7\n   \n   escreval(\"Media de aproveitamento: \", media_aproveitamento)\nFimalgoritmo\n"
  }
];
