// Trava: quem sabe o código entra, quem não sabe não vê nem o verificador.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  temCodigo, criarCodigo, verificarCodigo, apagarTudo, codigoValido, ErroDeAcesso,
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
  assert.equal(codigoValido('123456'), true);
  assert.equal(codigoValido('12345'), false, 'menos de 6 dígitos');
  assert.equal(codigoValido('12345a'), false, 'letra não é permitida');
  assert.equal(codigoValido(''), false);
  assert.equal(codigoValido(null), false);
});

test('nenhum código configurado até criarCodigo ser chamado', async () => {
  const arm = armazenamentoFalso();
  assert.equal(temCodigo(arm), false);
  await criarCodigo('112233', arm);
  assert.equal(temCodigo(arm), true);
});

test('criarCodigo recusa código no formato errado', async () => {
  const arm = armazenamentoFalso();
  await assert.rejects(() => criarCodigo('123'), ErroDeAcesso);
  await assert.rejects(() => criarCodigo('abcdef'), ErroDeAcesso);
  assert.equal(temCodigo(arm), false, 'tentativa inválida não deixa registro');
});

test('o código certo devolve uma chave utilizável', async () => {
  const arm = armazenamentoFalso();
  const chaveCriada = await criarCodigo('445566', arm);
  const chaveVerificada = await verificarCodigo('445566', arm);

  // As duas chaves são utilizáveis de forma equivalente: uma cifra, a outra decifra.
  const mensagem = await cifrar(chaveCriada, 'prova de vida');
  assert.equal(await decifrar(chaveVerificada, mensagem), 'prova de vida');
});

test('o código errado é recusado, e nenhum registro é alterado', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('998877', arm);
  const registroAntes = arm.getItem('en-controle:seguranca');

  await assert.rejects(() => verificarCodigo('111111', arm), ErroDeAcesso);
  assert.equal(arm.getItem('en-controle:seguranca'), registroAntes, 'uma tentativa errada não muda o registro');

  // E o código certo continua funcionando depois de uma tentativa errada.
  await assert.doesNotReject(() => verificarCodigo('998877', arm));
});

test('verificar sem nenhum código configurado falha, não trava', async () => {
  const arm = armazenamentoFalso();
  await assert.rejects(() => verificarCodigo('123456', arm), ErroDeAcesso);
});

test('registro corrompido é recusado com erro claro, não com exceção genérica', async () => {
  const arm = armazenamentoFalso();
  arm.setItem('en-controle:seguranca', 'isto não é json');
  await assert.rejects(() => verificarCodigo('123456', arm), ErroDeAcesso);
});

test('apagarTudo remove o código e os dados, deixando o aparelho como novo', async () => {
  const arm = armazenamentoFalso();
  await criarCodigo('123456', arm);
  arm.setItem('en-controle:v1', '{"clientes":[{"nome":"não deveria sobreviver"}]}');

  apagarTudo('en-controle:v1', arm);

  assert.equal(temCodigo(arm), false);
  assert.equal(arm.getItem('en-controle:v1'), null);
  await assert.rejects(() => verificarCodigo('123456', arm), ErroDeAcesso);
});

test('dois aparelhos com o mesmo código produzem registros diferentes (sal aleatório)', async () => {
  const arm1 = armazenamentoFalso();
  const arm2 = armazenamentoFalso();
  await criarCodigo('123456', arm1);
  await criarCodigo('123456', arm2);

  assert.notEqual(arm1.getItem('en-controle:seguranca'), arm2.getItem('en-controle:seguranca'));
});
