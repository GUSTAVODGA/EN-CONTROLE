// ══════════════════════════════════════════════════════════════════════════
// CRIPTOGRAFIA — o código de acesso protege o dado, não só a tela
//
// A diferença importa: uma "tela de bloqueio" que apenas esconde a interface
// não protege nada de quem abre as ferramentas do navegador e lê o
// `localStorage` diretamente — o dado real continuaria em texto puro. Aqui, o
// que fica gravado no aparelho é o resultado de AES-GCM 256 bits; sem o
// código de acesso certo, o que existe em disco é ruído.
//
// Cada peça usa exclusivamente a Web Crypto API nativa do navegador
// (`crypto.subtle`) — nenhuma implementação própria de cifra. Criptografia
// caseira é o tipo de coisa que parece funcionar e falha exatamente na hora
// que importa; a implementação do navegador é auditada e testada por todo o
// ecossistema web.
//
// LIMITE HONESTO: a força de tudo isto é limitada pelo tamanho do código de
// acesso. PBKDF2 com muitas iterações encarece a tentativa, mas não torna um
// código de 6 dígitos impossível de descobrir por força bruta para quem tiver
// o arquivo e tempo ilimitado — só torna caro demais para ser prático contra
// alguém pegando o aparelho ou uma cópia do backup. Não é a mesma garantia de
// um cofre de banco; é a diferença entre "qualquer um que abrir o app vê tudo"
// e "só quem sabe o código vê alguma coisa".
// ══════════════════════════════════════════════════════════════════════════

const ITERACOES_PBKDF2 = 210000;
const TAMANHO_CHAVE_BITS = 256;
const TAMANHO_IV_BYTES = 12; // recomendado para AES-GCM

/** Erro de domínio: código de acesso errado, ou dado corrompido/adulterado. */
export class ErroDeAcesso extends Error {}

function exigirSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new ErroDeAcesso(
      'Este navegador não tem suporte à criptografia necessária. Atualize o navegador ou use outro.'
    );
  }
  return subtle;
}

// ── conversão de bytes ⇄ texto ─────────────────────────────────────────────

export function paraBase64(bytes) {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

export function deBase64(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Bytes aleatórios criptograficamente seguros, prontos para uso como sal ou IV. */
export function bytesAleatorios(tamanho) {
  return globalThis.crypto.getRandomValues(new Uint8Array(tamanho));
}

// ── derivação de chave ──────────────────────────────────────────────────────

/**
 * Deriva uma chave AES-GCM de 256 bits a partir do código de acesso e de um
 * sal. O mesmo par (código, sal) sempre produz a mesma chave — é assim que o
 * desbloqueio funciona sem guardar o código em lugar nenhum.
 *
 * @param {string} codigo         o que a pessoa digitou
 * @param {Uint8Array} salBytes   sal já gerado (armazenado ao lado do dado)
 * @returns {Promise<CryptoKey>}
 */
export async function derivarChave(codigo, salBytes) {
  const subtle = exigirSubtle();
  const codificador = new TextEncoder();

  const chaveBase = await subtle.importKey(
    'raw', codificador.encode(codigo), 'PBKDF2', false, ['deriveKey']
  );

  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salBytes, iterations: ITERACOES_PBKDF2, hash: 'SHA-256' },
    chaveBase,
    { name: 'AES-GCM', length: TAMANHO_CHAVE_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Um sal novo, em base64 — para gravar ao lado do dado cifrado. */
export function novoSal() {
  return paraBase64(bytesAleatorios(16));
}

// ── cifrar e decifrar texto ──────────────────────────────────────────────

/**
 * Cifra um texto com a chave dada.
 * @returns {Promise<{iv: string, dados: string}>} tudo em base64, pronto para JSON
 */
export async function cifrar(chave, textoClaro) {
  const subtle = exigirSubtle();
  const iv = bytesAleatorios(TAMANHO_IV_BYTES);
  const codificador = new TextEncoder();

  const bufer = await subtle.encrypt(
    { name: 'AES-GCM', iv }, chave, codificador.encode(textoClaro)
  );

  return { iv: paraBase64(iv), dados: paraBase64(new Uint8Array(bufer)) };
}

/**
 * Decifra o que `cifrar` produziu. AES-GCM autentica o conteúdo: um código de
 * acesso errado ou um dado adulterado faz `subtle.decrypt` rejeitar — nunca
 * devolve um texto errado em silêncio.
 *
 * @throws {ErroDeAcesso} quando a chave está errada ou o dado foi adulterado
 */
export async function decifrar(chave, { iv, dados }) {
  const subtle = exigirSubtle();
  const decodificador = new TextDecoder();

  try {
    const bufer = await subtle.decrypt(
      { name: 'AES-GCM', iv: deBase64(iv) }, chave, deBase64(dados)
    );
    return decodificador.decode(bufer);
  } catch {
    throw new ErroDeAcesso('Código de acesso incorreto.');
  }
}
