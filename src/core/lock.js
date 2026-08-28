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
//
// Tentativa errada custa tempo, de propósito: depois de algumas tentativas
// livres, cada nova tentativa exige esperar cada vez mais — mesmo que o
// código digitado depois esteja certo. O contador vive no armazenamento, não
// em memória, porque senão recarregar a página zeraria a espera de graça.
// ══════════════════════════════════════════════════════════════════════════

import { derivarChave, cifrar, decifrar, novoSal, deBase64, ErroDeAcesso } from './crypto.js';

export { ErroDeAcesso };

const CHAVE_SEGURANCA = 'en-controle:seguranca';
const CHAVE_TENTATIVAS = 'en-controle:tentativas';
export const TAMANHO_MINIMO_CODIGO = 8;

const TEXTO_VERIFICADOR = 'EN-CONTROLE-CODIGO-CERTO';

const TENTATIVAS_LIVRES = 3;
const ESPERAS_SEGUNDOS = [30, 60, 120, 300, 600, 900];

function lerTentativas(armazenamento) {
  try {
    const bruto = JSON.parse(armazenamento.getItem(CHAVE_TENTATIVAS));
    return bruto && typeof bruto.erros === 'number' ? bruto : { erros: 0, bloqueadoAte: 0 };
  } catch {
    return { erros: 0, bloqueadoAte: 0 };
  }
}

function registrarErro(armazenamento) {
  const { erros } = lerTentativas(armazenamento);
  const novosErros = erros + 1;
  const indice = Math.min(novosErros - TENTATIVAS_LIVRES - 1, ESPERAS_SEGUNDOS.length - 1);
  const bloqueadoAte = indice >= 0 ? Date.now() + ESPERAS_SEGUNDOS[indice] * 1000 : 0;
  armazenamento.setItem(CHAVE_TENTATIVAS, JSON.stringify({ erros: novosErros, bloqueadoAte }));
}

/** Zera o contador de tentativas erradas — chamado quando o código certo entra. */
export function zerarTentativas(armazenamento = globalThis.localStorage) {
  armazenamento.removeItem(CHAVE_TENTATIVAS);
}

/** Formata segundos como "30 segundos", "2 minutos" etc., para mensagens de espera. */
export function formatarEspera(segundos) {
  if (segundos < 60) return `${segundos} segundo${segundos === 1 ? '' : 's'}`;
  const minutos = Math.round(segundos / 60);
  return `${minutos} minuto${minutos === 1 ? '' : 's'}`;
}

/**
 * Diz se o aparelho está em espera por causa de tentativas erradas demais.
 * @returns {{bloqueado: boolean, restanteMs: number}}
 */
export function statusBloqueio(armazenamento = globalThis.localStorage) {
  const { bloqueadoAte } = lerTentativas(armazenamento);
  const restanteMs = bloqueadoAte - Date.now();
  return restanteMs > 0 ? { bloqueado: true, restanteMs } : { bloqueado: false, restanteMs: 0 };
}

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
  const { bloqueado, restanteMs } = statusBloqueio(armazenamento);
  if (bloqueado) {
    throw new ErroDeAcesso(`Muitas tentativas erradas. Tente de novo em ${formatarEspera(Math.ceil(restanteMs / 1000))}.`);
  }

  const bruto = armazenamento.getItem(CHAVE_SEGURANCA);
  if (!bruto) throw new ErroDeAcesso('Nenhum código configurado neste aparelho.');

  let registro;
  try {
    registro = JSON.parse(bruto);
  } catch {
    throw new ErroDeAcesso('Registro de segurança corrompido.');
  }

  try {
    const chave = await derivarChave(codigo, deBase64(registro.sal));
    const textoDecifrado = await decifrar(chave, registro.verificador); // lança se o código estiver errado
    if (textoDecifrado !== TEXTO_VERIFICADOR) throw new ErroDeAcesso('Código de acesso incorreto.');
    zerarTentativas(armazenamento);
    return chave;
  } catch {
    registrarErro(armazenamento);
    throw new ErroDeAcesso('Código de acesso incorreto.');
  }
}

/**
 * Apaga o código de acesso e, junto, todos os dados do aparelho. Sem isso, um
 * código esquecido deixaria o aparelho permanentemente inacessível — não há
 * "recuperar por e-mail" possível quando não existe servidor.
 */
export function apagarTudo(chaveDados, armazenamento = globalThis.localStorage) {
  armazenamento.removeItem(CHAVE_SEGURANCA);
  armazenamento.removeItem(chaveDados);
  armazenamento.removeItem(CHAVE_TENTATIVAS);
}
