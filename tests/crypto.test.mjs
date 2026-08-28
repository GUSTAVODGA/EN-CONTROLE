// Criptografia: a garantia central é que a chave certa recupera o texto, e
// qualquer outra coisa — chave errada, dado adulterado — falha alto, nunca em
// silêncio.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  derivarChave, novoSal, cifrar, decifrar, bytesAleatorios,
  paraBase64, deBase64, ErroDeAcesso,
} from '../src/core/crypto.js';

test('a mesma senha e o mesmo sal sempre derivam a mesma chave', async () => {
  const sal = bytesAleatorios(16);
  const a = await derivarChave('123456', sal);
  const b = await derivarChave('123456', sal);

  const mensagem = await cifrar(a, 'conteúdo secreto');
  const lido = await decifrar(b, mensagem);
  assert.equal(lido, 'conteúdo secreto', 'chaves derivadas iguais decifram uma da outra');
});

test('senhas diferentes derivam chaves diferentes', async () => {
  const sal = bytesAleatorios(16);
  const a = await derivarChave('123456', sal);
  const b = await derivarChave('654321', sal);

  const mensagem = await cifrar(a, 'segredo');
  await assert.rejects(() => decifrar(b, mensagem), ErroDeAcesso);
});

test('o mesmo código com sal diferente também deriva chaves diferentes', async () => {
  const a = await derivarChave('123456', bytesAleatorios(16));
  const b = await derivarChave('123456', bytesAleatorios(16));

  const mensagem = await cifrar(a, 'segredo');
  await assert.rejects(() => decifrar(b, mensagem), ErroDeAcesso);
});

test('cifrar e decifrar recuperam exatamente o texto original', async () => {
  const chave = await derivarChave('987654', bytesAleatorios(16));
  const textos = ['', 'a', '{"clientes":[{"nome":"Ana"}]}', 'á é í ó ú ç ã õ — texto com acento'];

  for (const original of textos) {
    const cifrado = await cifrar(chave, original);
    const decifrado = await decifrar(chave, cifrado);
    assert.equal(decifrado, original);
  }
});

test('cada chamada de cifrar usa um IV diferente, mesmo para o mesmo texto', async () => {
  const chave = await derivarChave('123456', bytesAleatorios(16));
  const um = await cifrar(chave, 'mesma mensagem');
  const dois = await cifrar(chave, 'mesma mensagem');

  assert.notEqual(um.iv, dois.iv, 'reusar IV com a mesma chave quebraria AES-GCM');
  assert.notEqual(um.dados, dois.dados, 'o texto cifrado também muda, mesmo com o texto claro igual');
});

test('dado adulterado é rejeitado — AES-GCM autentica o conteúdo', async () => {
  const chave = await derivarChave('123456', bytesAleatorios(16));
  const cifrado = await cifrar(chave, 'não mexer');

  const adulterado = { ...cifrado, dados: paraBase64(deBase64(cifrado.dados).map((b, i) => (i === 0 ? b ^ 1 : b))) };
  await assert.rejects(() => decifrar(chave, adulterado), ErroDeAcesso);
});

test('base64 vai e volta preservando os bytes exatos, incluindo zero e 255', async () => {
  const original = new Uint8Array([0, 1, 2, 254, 255, 128, 0, 0, 255]);
  const bytes = deBase64(paraBase64(original));
  assert.deepEqual([...bytes], [...original]);
});

test('novoSal produz valores diferentes a cada chamada', () => {
  const sais = new Set(Array.from({ length: 20 }, () => novoSal()));
  assert.equal(sais.size, 20);
});
