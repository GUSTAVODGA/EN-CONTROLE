# EN Controle

Controle de valores a receber, para uso privado de dois sócios. Substitui a
anotação manual de dívidas parceladas: quem deve, quanto falta, o que venceu e
onde está o dinheiro.

A cadeia do produto é curta e é toda a sua ambição:

```
cliente → dívida → parcelas → pagamentos → caixa
```

O que foi vendido, ou por que o dinheiro foi emprestado, não interessa ao
sistema. Não há produto, estoque, catálogo nem relatório gerencial.

## Como abrir

São arquivos estáticos, sem empacotamento e sem dependência de execução. Basta
servir a raiz do repositório:

```bash
python3 -m http.server 4180
# abrir http://localhost:4180/
```

Abrir por `file://` não funciona: o app é feito de módulos ES, que exigem HTTP.

## Como rodar os testes

```bash
npm test        # motores financeiros, sem browser, em ~0,5s
```

Roda com Node puro (`node:test`), sem `npm install` e sem dependência alguma.
O mesmo comando é o gate de CI.

## Publicação

O GitHub Pages publica a raiz do repositório a cada push na `main`, pelo
workflow `.github/workflows/pages.yml`. Não há etapa de build: o que está
versionado é exatamente o que é servido.

## Direção visual

A referência é **painel de controle impresso**, não aplicativo: fundo branco,
blocos fechados por traço preto, número grande e pesado, rótulo em caixa alta.

Três decisões definem o resto:

1. **Borda, não sombra.** Cada bloco é fechado por um traço de 1,5px na cor da
   tinta. Não existe uma única `box-shadow` no produto.
2. **Peso.** Números em 800, nomes em 700, rótulos em 700 e caixa alta. A
   hierarquia se lê de longe, com o celular na mão e sol na tela.
3. **Inversão.** O número mais importante da tela vive num bloco preto sólido
   com texto branco — um por tela, no máximo. É o que ancora a página.

Tipografia: **Archivo**, grotesca de traço industrial, hospedada em `fontes/`
e com algarismos de largura fixa. Cor é informação, não decoração: a paleta é
tinta, papel e dois tons — atraso e recebido.

**A lista principal do Início é de clientes, não de parcelas.** Cobrança se faz
por pessoa: um cliente com quatro parcelas vencidas é uma ligação, não quatro
linhas. `agruparPorCliente()` soma o que cada um deve agora, e "atrasado" e
"vence hoje" moram na mesma seção porque são a mesma tarefa.

Uma consequência prática está no fim do `style.css`: as classes de tom
(`.tom-atraso` e companhia) ficam no final do arquivo de propósito, porque
convivem com classes de componente que também definem cor. Com a mesma
especificidade, vence quem vem por último — e quem precisa vencer é o tom.

## Os quatro conceitos financeiros

Eles não são sinônimos, e o sistema nunca os deriva um do outro por atalho:

| Conceito | O que é | Como se calcula |
|---|---|---|
| **Em caixa** | dinheiro que está com os sócios agora | aportes − retiradas − emprestado + recebido |
| **Na rua** | capital vinculado às dívidas abertas — **só principal**, sem juro | base das dívidas − principal já recuperado |
| **A receber** | saldo que ainda deve entrar — principal **e** juros | total das dívidas − o que já foi recebido |
| **Atrasado** | a fatia de *a receber* cujo vencimento já passou | soma do restante das parcelas vencidas |

Duas relações valem sempre, e há testes para elas: `em caixa + na rua` é o
patrimônio da operação (aportes − retiradas + juro já realizado), e `atrasado`
é sempre um subconjunto de `a receber`, nunca uma quinta grandeza somável.

**O caixa pode nascer negativo.** Se há capital na rua e nenhum aporte
registrado, o sistema mostra o caixa negativo — porque o dinheiro saiu e a
origem dele não foi informada. Quem está migrando da anotação de papel deve
registrar um aporte com o capital inicial da operação. Isso é verdade
contábil, não defeito.

## As regras de cálculo

**Juros.** Simples e aplicados uma única vez sobre o valor base:
`total = base × (1 + percentual/100)`, arredondado ao centavo. Não há
capitalização por período.

**Parcelas.** A soma das parcelas fecha **exatamente** com o total. A diferença
de arredondamento (de 0 a n−1 centavos) vai inteira para a última parcela, de
modo que as parcelas correntes sejam todas iguais.

**Datas.** Toda data é `AAAA-MM-DD` e toda conta de calendário é feita sobre
inteiros — nunca somando milissegundos a um `Date`, que erraria no horário de
verão e mudaria de dia conforme o fuso do aparelho.

| Periodicidade | Avanço |
|---|---|
| Semanal | 7 dias corridos |
| Quinzenal | 14 dias corridos (intervalo real, não "dia 1 e dia 15") |
| Mensal | mês de calendário; se o dia não existe no mês de destino, cai no último dia |

**Cada vencimento é derivado do primeiro, nunca do anterior.** É isso que faz
uma série mensal iniciada em 31/01 ser 31/01 → 28/02 → **31/03**, e não
31/01 → 28/02 → 28/03. Derivação em cadeia perderia o dia 31 no primeiro
fevereiro e nunca mais o recuperaria.

**Alocação de pagamentos.** Pagamentos são aplicados em ordem cronológica. Um
pagamento dirigido a uma parcela começa nela e transborda para as seguintes,
nunca para as anteriores; um pagamento sem parcela indicada preenche da mais
antiga em aberto para a frente. O que sobra depois da última parcela vira
crédito do cliente.

**Capital e juro são recuperados proporcionalmente.** Não há regra de "primeiro
o juro": cada real recebido amortiza principal e juro na mesma proporção em que
eles compõem a dívida. É o que mantém *na rua* coerente em qualquer momento.

## Arquitetura

```
src/core/     regra financeira pura — sem DOM, sem armazenamento, testável
  money.js       centavos inteiros, juros, repartição de parcelas
  dates.js       calendário civil sem fuso
  schedule.js    termos da dívida → parcelas datadas
  debt.js        estado derivado de uma dívida
  portfolio.js   os quatro números e a agenda
  model.js       entidades, validação e saneamento na leitura
  store.js       mutações e persistência (adaptador injetável)
  sample.js      dados de exemplo (nenhum dado real)

src/ui/       telas e componentes; nenhuma regra de negócio mora aqui
```

**Nada de derivado é gravado.** Saldo, parcelas pagas, atraso e capital na rua
são sempre recalculados a partir dos termos da dívida, dos pagamentos e da data
de hoje. Não existe coleção de parcelas: elas são função dos termos. Guardar um
saldo obrigaria a mantê-lo em dia a cada pagamento, edição e exclusão — e é
exatamente aí que sistemas de cobrança começam a mentir. Derivando, apagar um
pagamento corrige o saldo sozinho.

O que se grava são quatro coleções, só de fatos: `clientes`, `dividas`,
`pagamentos`, `caixa`.

## Persistência

Hoje os dados ficam no `localStorage` do aparelho, atrás de um adaptador
(`store.js`). **Não há sincronia entre os dois sócios ainda**: cada aparelho tem
os seus dados.

Trocar por Firestore é trocar o adaptador — nenhuma regra financeira muda,
porque toda a camada de cálculo é pura e derivada. É o próximo passo natural.

## Costura para o futuro

Juntar uma dívida nova a uma existente será modelado como **substituição**: as
antigas apontam para a nova em `substituidaPorId`, a nova lista as origens em
`origemDividaIds`, e nenhum histórico é apagado. Os dois campos já existem no
modelo e sobrevivem à gravação; nenhuma regra os usa ainda. É por isso que
ligar essa funcionalidade depois não vai exigir migração de dados.

## Fora do escopo, de propósito

Sem login, sem relatórios, sem exportação, sem notificações, sem catálogo de
produtos, sem tela de configurações. A primeira etapa é a fundação: modelo de
dados, navegação e a primeira experiência visual funcional.
