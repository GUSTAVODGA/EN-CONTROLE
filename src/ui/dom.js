// Utilidades de tela. Nenhuma biblioteca: as telas são funções que devolvem
// HTML e o comportamento vem de delegação de evento por `data-acao`.

/** Escapa texto vindo do usuário antes de entrar em HTML. Sempre. */
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Junta classes ignorando o que for falso. */
export function classes(...lista) {
  return lista.filter(Boolean).join(' ');
}

let temporizadorAviso = null;

/** Aviso curto e discreto no rodapé. */
export function avisar(texto) {
  const el = document.getElementById('aviso');
  if (!el) return;
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { el.hidden = true; }, 2600);
}

/** Vibração curta de confirmação, onde o aparelho suportar. */
export function tremer(padrao = 8) {
  try { navigator.vibrate?.(padrao); } catch { /* sem suporte, sem problema */ }
}

/**
 * Cabeçalho de seção: micro-etiqueta em caixa alta à esquerda e, quando
 * ajudar, um número discreto à direita.
 */
export function cabecalhoSecao(titulo, valor) {
  return `<div class="secao-cabecalho">
    <span class="etiqueta">${esc(titulo)}</span>
    ${valor !== undefined && valor !== null ? `<span class="secao-valor">${esc(valor)}</span>` : ''}
  </div>`;
}

/**
 * Estado vazio: uma frase em serifa, uma explicação curta e, quando fizer
 * sentido, uma saída. Alinhado à esquerda, como um parágrafo — sem ícone
 * centralizado, que só ocuparia espaço sem dizer nada.
 */
export function estadoVazio({ titulo, texto, botao }) {
  return `<div class="vazio">
    <div class="vazio-titulo">${esc(titulo)}</div>
    ${texto ? `<p class="vazio-texto">${esc(texto)}</p>` : ''}
    ${botao ? `<button class="acao" data-acao="${esc(botao.acao)}">${esc(botao.rotulo)}</button>` : ''}
  </div>`;
}
