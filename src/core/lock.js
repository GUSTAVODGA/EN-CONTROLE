// ══════════════════════════════════════════════════════════════════════════
// TRAVA — o código de acesso do aparelho
//
// Um registro de segurança, gravado ao lado dos dados, guarda apenas o sal e
// um "verificador": um texto fixo conhecido, cifrado com a chave derivada do
// código. Para conferir se o código digitado está certo, decifra-se o
// verificador — nunca o dado real primeiro. Errar o código nunca expõe nem
// um byte do dado de verdade: `subtle.decrypt` rejeita antes de devolver
// qualquer coisa.
//
// Cada aparelho tem seu próprio código — não há conta nem servidor aqui. Um
// código esquecido não tem recuperação possível: é o preço de o dado nunca
// sair do aparelho sem passar pela chave. `apagarTudo` existe exatamente para
// esse caso, e é irreversível de propósito.
// ══════════════════════════════════════════════════════════════════════════

import { derivarChave, cifrar, decifrar, novoSal, deBase64, ErroDeAcesso } from './crypto.js';

export { ErroDeAcesso };

const CHAVE_SEGURANCA = 'en-controle:seguranca';
export const TAMANHO_MINIMO_CODIGO = 6;

const TEXTO_VERIFICADOR = 'EN-CONTROLE-CODIGO-CERTO';

/** O código só pode ter dígitos, e precisa do tamanho mínimo. */
export function codigoValido(codigo) {
  return typeof codigo === 'string' && /^\d+$/.test(codigo) && codigo.length >= TAMANHO_MINIMO_CODIGO;
}

/** Existe um código de acesso configurado neste aparelho? */
export function temCodigo(armazenamento = globalThis.localStorage) {
  try {
    return armazenamento?.getItem(CHAVE_SEGURANCA) != null;
  } catch {
    return false;
  }
}

/**
 * Cria o primeiro código de acesso do aparelho e devolve a chave já
 * derivada, pronta para cifrar o estado inicial.
 */
export async function criarCodigo(codigo, armazenamento = globalThis.localStorage) {
  if (!codigoValido(codigo)) {
    throw new ErroDeAcesso(`O código precisa ter só números, com pelo menos ${TAMANHO_MINIMO_CODIGO} dígitos.`);
  }
  const sal = novoSal();
  const chave = await derivarChave(codigo, deBase64(sal));
  const verificador = await cifrar(chave, TEXTO_VERIFICADOR);

  armazenamento.setItem(CHAVE_SEGURANCA, JSON.stringify({ sal, verificador }));
  return chave;
}

/**
 * Confere o código digitado contra o registro do aparelho.
 * @returns {Promise<CryptoKey>} a chave, se o código estiver certo
 * @throws {ErroDeAcesso} se estiver errado, ou se não houver registro
 */
export async function verificarCodigo(codigo, armazenamento = globalThis.localStorage) {
  const bruto = armazenamento.getItem(CHAVE_SEGURANCA);
  if (!bruto) throw new ErroDeAcesso('Nenhum código configurado neste aparelho.');

  let registro;
  try {
    registro = JSON.parse(bruto);
  } catch {
    throw new ErroDeAcesso('Registro de segurança corrompido.');
  }

  const chave = await derivarChave(codigo, deBase64(registro.sal));
  const textoDecifrado = await decifrar(chave, registro.verificador); // lança se o código estiver errado

  if (textoDecifrado !== TEXTO_VERIFICADOR) throw new ErroDeAcesso('Código de acesso incorreto.');
  return chave;
}

/**
 * Apaga o código de acesso e, junto, todos os dados do aparelho. Sem isso, um
 * código esquecido deixaria o aparelho permanentemente inacessível — não há
 * "recuperar por e-mail" possível quando não existe servidor.
 */
export function apagarTudo(chaveDados, armazenamento = globalThis.localStorage) {
  armazenamento.removeItem(CHAVE_SEGURANCA);
  armazenamento.removeItem(chaveDados);
}
