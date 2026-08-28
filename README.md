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

A referência é uma peça editorial bem composta, não um aplicativo bancário:
fundo bege quente, cartões brancos com sombra suave (nunca borda dura), um
único bloco de cor — verde-escuro — que ancora cada tela, e botões em pílula.

**A regra de ouro é a tipografia, e ela é a coisa mais importante do sistema.**
A serifa (Fraunces) é reservada para DUAS coisas só: o valor em caixa — o
número que a tela existe para responder — e nomes de pessoa. Todo o resto
(estatística, total de dívida, parcela, rótulo) é Manrope em negrito. Não é
estética, é hierarquia: se tudo fosse serifado, nada seria especial.

O que este sistema não usa: cartão sobre fundo cinza corporativo, borda grossa
como ornamento, caixa alta em tudo, ícone decorativo, esquina reta, sombra
dura. Sobraram sete ícones no produto inteiro — voltar, avançar, buscar,
somar, subtrair, editar, apagar — nenhum decorativo.

**A lista principal do Início é de clientes, não de parcelas.** Cobrança se faz
por pessoa: um cliente com quatro parcelas vencidas ocupa um cartão, não
quatro linhas. `agruparPorCliente()` soma o que cada um deve agora, e
"atrasado" e "vence hoje" moram na mesma seção — "Cobrar agora" — porque são a
mesma tarefa.

Duas consequências práticas registradas no código:

- As classes de tom (`.tom-atraso` e companhia) ficam no fim do `style.css` de
  propósito: convivem com classes de componente que também definem cor, e com
  a mesma especificidade, vence quem vem por último — e quem precisa vencer é
  o tom.
- Um valor descritivo longo (o resumo de parcelas, a composição das parcelas
  na prévia) usa a variante `livre` de `linhaExtrato()`, que quebra em mais de
  uma linha em vez de forçar `nowrap` como toda quantia — a mesma regra que
  corrige o número dentro do bloco verde, onde o tamanho é fixado por seletor
  mais específico para nunca truncar.

As fontes (Fraunces e Manrope) são hospedadas em `fontes/`: o app abre offline
e fica idêntico em qualquer aparelho.

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

## Segurança

O app abre atrás de um código de acesso numérico (mínimo de 6 dígitos), criado
no primeiro uso de cada aparelho. Não é só uma tela de bloqueio: os quatro
dados do produto (`clientes`, `dividas`, `pagamentos`, `caixa`) ficam
**cifrados de verdade** dentro do `localStorage`, com AES-GCM de 256 bits. A
chave nunca é o código digitado — é derivada dele por PBKDF2 (210 mil
iterações, sal aleatório por aparelho), o mesmo desenho usado por gerenciadores
de senha para tornar um ataque por força bruta caro. `src/core/crypto.js` e
`src/core/lock.js` concentram toda essa camada; nenhum outro arquivo do
produto sabe que os dados estão cifrados.

Vale ser honesto sobre o que essa proteção cobre e o que não cobre:

- **Protege** contra alguém abrir o aparelho e simplesmente olhar os dados —
  seja folheando o app sem o código, seja inspecionando o `localStorage`
  diretamente. Sem o código certo, o que existe no disco é ruído.
- **Não protege** contra um atacante técnico determinado com acesso ao
  arquivo e tempo: um código curto, mesmo só numérico, tem um espaço de busca
  finito. O PBKDF2 encarece cada tentativa, mas não a torna impossível. Quanto
  maior o código, mais forte a proteção — vale usar mais que o mínimo de 6
  dígitos se o aparelho puder ser perdido ou roubado.
- **Cada aparelho tem seu próprio código**, exatamente como cada aparelho já
  tinha seus próprios dados: não é uma conta, não há servidor, não há "esqueci
  a senha" por e-mail. Errar o código não revela nada — nem um byte do dado
  real é tocado antes de bater. Mas esquecê-lo de vez também não tem volta: a
  única saída é apagar tudo daquele aparelho e recomeçar vazio ("Esqueci o
  código" na própria tela de trava faz isso, e avisa antes de agir).

## Costura para o futuro

Juntar uma dívida nova a uma existente será modelado como **substituição**: as
antigas apontam para a nova em `substituidaPorId`, a nova lista as origens em
`origemDividaIds`, e nenhum histórico é apagado. Os dois campos já existem no
modelo e sobrevivem à gravação; nenhuma regra os usa ainda. É por isso que
ligar essa funcionalidade depois não vai exigir migração de dados.

## Fora do escopo, de propósito

Sem conta de usuário nem sincronia entre sócios (o código de acesso trava o
aparelho, não substitui um login de verdade), sem relatórios, sem exportação,
sem notificações, sem catálogo de produtos, sem tela de configurações. A
primeira etapa é a fundação: modelo de dados, navegação e a primeira
experiência visual funcional.
