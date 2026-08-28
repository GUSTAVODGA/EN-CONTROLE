// Trava: quem sabe o código entra, quem não sabe não vê nem o verificador —
// e depois de errar demais, nem tentar de novo adianta por um tempo.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  temCodigo, criarCodigo, verificarCodigo, apagarTudo, codigoValido, zerarTentativas,
  statusBloqueio, formatarEspera, ErroDeAcesso,
} from '../src/core/lock.js';
import { cifrar, decifrar } from '../src/core/crypto.js';

/** localStorage mínimo, só para os testes — sem depender de um DOM. */
function armazenamentoFalso() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

test('validação do formato do código', () => {
  assert.equal(codigoValido('12345678'), true);
  assert.equal(codigoValido('1234567'), false, 'menos de 8 dígitos');
  assert.equal(codigoValido('1234567a'), false, 'letra não é permitida');
  assert.equal(codigoValido(''), false);
  assert.equal(codigoValido(null), false);
});

test('nenhum código configurado até criarCodigo ser chamado', async () => {
  const arm = armazenamentoFalso();
  assert.equal(temCodigo(arm), false);
  await criarCodigo('11223344', arm);
  assert.equal(temCodigo(arm), true);
});

test('criarCodigo recusa código no formato errado', async () => {
  const arm = armazenamentoFalso();
  await assert.rejects(() => criarCodigo('123'), ErroDeAcesso);
  await assert.rejects(() => criarCodigo('abcdefgh'), ErroDeAcesso);
  assert.equal(temCodigo(arm), false, 'tentativa inválida não deixa registro');
});

test('o código certo devolve uma chave utilizável', async () => {
  const arm = armazenamentoFalso();
  const chaveCriada = await criarCodigo('44556677', arm);
  const chaveVerificada = await verificarCodigo('44556677', arm);

  // As duas chaves são utilizáveis de forma equivalente: uma cifra, a outra decifra.
  const mensagem = await cifrar(chaveCriada, 'prova de vida');
  assert.equal(await decifrar(chaveVerificada, mensagem), 'prova de vida');
});

test('o código errado é recusado, e nenhum registro é alterado', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('99887766', arm);
  const registroAntes = arm.getItem('en-controle:seguranca');

  await assert.rejects(() => verificarCodigo('11111111', arm), ErroDeAcesso);
  assert.equal(arm.getItem('en-controle:seguranca'), registroAntes, 'uma tentativa errada não muda o registro');

  // E o código certo continua funcionando depois de uma tentativa errada, dentro do limite livre.
  await assert.doesNotReject(() => verificarCodigo('99887766', arm));
});

test('verificar sem nenhum código configurado falha, não trava', async () => {
  const arm = armazenamentoFalso();
  await assert.rejects(() => verificarCodigo('12345678', arm), ErroDeAcesso);
});

test('registro corrompido é recusado com erro claro, não com exceção genérica', async () => {
  const arm = armazenamentoFalso();
  arm.setItem('en-controle:seguranca', 'isto não é json');
  await assert.rejects(() => verificarCodigo('12345678', arm), ErroDeAcesso);
});

test('apagarTudo remove o código, os dados e as tentativas, deixando o aparelho como novo', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('12345678', arm);
  arm.setItem('en-controle:v1', '{"clientes":[{"nome":"não deveria sobreviver"}]}');

  apagarTudo('en-controle:v1', arm);

  assert.equal(temCodigo(arm), false);
  assert.equal(arm.getItem('en-controle:v1'), null);
  assert.equal(statusBloqueio(arm).bloqueado, false);
  await assert.rejects(() => verificarCodigo('12345678', arm), ErroDeAcesso);
});

test('dois aparelhos com o mesmo código produzem registros diferentes (sal aleatório)', async () => {
  const arm1 = armazenamentoFalso();
  const arm2 = armazenamentoFalso();
  await criarCodigo('12345678', arm1);
  await criarCodigo('12345678', arm2);

  assert.notEqual(arm1.getItem('en-controle:seguranca'), arm2.getItem('en-controle:seguranca'));
});

test('depois de tentativas erradas demais, o aparelho entra em espera — mesmo com o código certo', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('55667788', arm);

  // As primeiras tentativas erradas são livres (não travam ainda).
  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => verificarCodigo('00000000', arm), ErroDeAcesso);
    assert.equal(statusBloqueio(arm).bloqueado, false, `tentativa ${i + 1} não deveria travar ainda`);
  }

  // A próxima tentativa errada ultrapassa o limite livre e ativa a espera.
  await assert.rejects(() => verificarCodigo('00000000', arm), ErroDeAcesso);
  assert.equal(statusBloqueio(arm).bloqueado, true);

  // Mesmo o código CERTO é recusado enquanto durar a espera.
  await assert.rejects(() => verificarCodigo('55667788', arm), ErroDeAcesso);
});

test('zerarTentativas encerra a espera imediatamente', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('66778899', arm);
  for (let i = 0; i < 4; i++) {
    await assert.rejects(() => verificarCodigo('00000000', arm), ErroDeAcesso);
  }
  assert.equal(statusBloqueio(arm).bloqueado, true);

  zerarTentativas(arm);
  assert.equal(statusBloqueio(arm).bloqueado, false);
  await assert.doesNotReject(() => verificarCodigo('66778899', arm));
});

test('o código certo, dentro do limite livre, zera o contador de erros', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('77889900', arm);
  await assert.rejects(() => verificarCodigo('00000000', arm), ErroDeAcesso);
  await assert.doesNotReject(() => verificarCodigo('77889900', arm));

  // O contador zerou: mais três erradas seguidas ainda não travam.
  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => verificarCodigo('00000000', arm), ErroDeAcesso);
  }
  assert.equal(statusBloqueio(arm).bloqueado, false);
});

test('formatarEspera escreve segundos e minutos por extenso', () => {
  assert.equal(formatarEspera(1), '1 segundo');
  assert.equal(formatarEspera(30), '30 segundos');
  assert.equal(formatarEspera(60), '1 minuto');
  assert.equal(formatarEspera(120), '2 minutos');
});
