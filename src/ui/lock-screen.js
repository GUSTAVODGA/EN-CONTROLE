// ══════════════════════════════════════════════════════════════════════════
// TELA DE TRAVA — o portão de entrada do aplicativo
//
// Roda ANTES de qualquer outra coisa: antes do store existir, antes de
// `app.js` montar a navegação normal. Por isso esta tela desenha direto nos
// mesmos elementos (`#topo`, `#tela`, `#abas`) em vez de passar pelo roteador
// — o roteador depende de um store que ainda não pode existir, porque criar o
// store exige a chave que só sai daqui.
//
// Dois fluxos, um teclado só:
//   · criar   — primeiro uso deste aparelho: digitar o código, confirmar
//               digitando de novo, e então a operação nasce vazia;
//   · entrar  — usos seguintes: digitar o código certo decifra o que já
//               existe. Errar não revela nada — nem um byte do dado real é
//               tocado antes do código bater.
// ══════════════════════════════════════════════════════════════════════════

import { esc } from './dom.js';
import { icones } from './icons.js';
import { confirmar } from './sheet.js';
import {
  temCodigo, criarCodigo, verificarCodigo, apagarTudo, codigoValido, TAMANHO_MINIMO_CODIGO,
  statusBloqueio, formatarEspera,
} from '../core/lock.js';
import { lerCriptografado, CHAVE_ARMAZENAMENTO } from '../core/store.js';
import { estadoVazio } from '../core/model.js';

const elTopo = () => document.getElementById('topo');
const elTela = () => document.getElementById('tela');
const elAbas = () => document.getElementById('abas');

/**
 * Assume o controle da tela até o aparelho ser desbloqueado.
 *
 * @param {function(CryptoKey, object): void} aoDesbloquear
 *   chamado uma única vez, com a chave derivada e o estado inicial (vazio,
 *   no primeiro uso; decifrado, nos usos seguintes). Dali em diante quem
 *   manda na tela é `app.js`.
 */
export function iniciarTrava(aoDesbloquear) {
  elTopo().innerHTML = '';
  elAbas().hidden = true;
  elAbas().innerHTML = '';

  if (temCodigo()) modoEntrar(aoDesbloquear);
  else modoCriar(aoDesbloquear);
}

// ── modo: primeiro uso do aparelho ──────────────────────────────────────────

function modoCriar(aoDesbloquear) {
  let primeiroCodigo = null;

  desenharTeclado({
    titulo: 'Crie um código de acesso',
    texto: `Só quem souber este código abre o EN Controle neste aparelho. Use pelo menos ${TAMANHO_MINIMO_CODIGO} números.`,
    rotuloConfirmar: 'Continuar',
    minimo: TAMANHO_MINIMO_CODIGO,
    async aoConfirmar(codigo, { erro }) {
      if (!codigoValido(codigo)) {
        erro(`Use só números, com pelo menos ${TAMANHO_MINIMO_CODIGO} dígitos.`);
        return;
      }
      primeiroCodigo = codigo;
      desenharTeclado({
        titulo: 'Confirme o código',
        texto: 'Digite o mesmo código mais uma vez.',
        rotuloConfirmar: 'Criar código',
        minimo: TAMANHO_MINIMO_CODIGO,
        async aoConfirmar(confirmacao, ctx2) {
          if (confirmacao !== primeiroCodigo) {
            ctx2.erro('Os códigos não são iguais. Digite de novo.');
            return;
          }
          const chave = await criarCodigo(primeiroCodigo);
          aoDesbloquear(chave, estadoVazio());
        },
      });
    },
  });
}

// ── modo: usos seguintes ─────────────────────────────────────────────────

function modoEntrar(aoDesbloquear) {
  desenharTeclado({
    titulo: 'Código de acesso',
    texto: 'Digite o código deste aparelho.',
    rotuloConfirmar: 'Entrar',
    minimo: TAMANHO_MINIMO_CODIGO,
    obterBloqueio: () => statusBloqueio(),
    linkRodape: { rotulo: 'Esqueci o código', acao: () => abrirEsqueciOCodigo(aoDesbloquear) },
    async aoConfirmar(codigo, { erro }) {
      try {
        const chave = await verificarCodigo(codigo);
        const dados = await lerCriptografado(chave, CHAVE_ARMAZENAMENTO);
        aoDesbloquear(chave, dados || estadoVazio());
      } catch (e) {
        erro(e.message || 'Código incorreto.');
      }
    },
  });
}

function abrirEsqueciOCodigo(aoDesbloquear) {
  confirmar({
    titulo: 'Esqueceu o código?',
    texto: 'Não há como recuperar: os dados deste aparelho estão cifrados com ele. ' +
           'A única saída é apagar tudo e recomeçar vazio, com um código novo. ' +
           'Não há como desfazer.',
    rotuloConfirmar: 'Apagar tudo e recomeçar',
    perigo: true,
    aoConfirmar() {
      apagarTudo(CHAVE_ARMAZENAMENTO);
      // Sem isto, uma rota antiga (a ficha de um cliente que acabou de ser
      // apagado, por exemplo) tentaria abrir de novo assim que o app novo
      // nascesse, e mostraria "cliente não encontrado" em vez do começo limpo.
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      modoCriar(aoDesbloquear);
    },
  });
}

// ── o teclado em si ──────────────────────────────────────────────────────

/**
 * @param {object} opcoes
 * @param {function(): {bloqueado: boolean, restanteMs: number}} [opcoes.obterBloqueio]
 *   só faz sentido no modo "entrar" — no modo "criar" não há o que adivinhar.
 * @param {function(string, {erro:function}): (void|Promise<void>)} opcoes.aoConfirmar
 */
function desenharTeclado({ titulo, texto, rotuloConfirmar, minimo, linkRodape, obterBloqueio, aoConfirmar }) {
  let digitado = '';
  let processando = false;
  let temporizador = null;

  elTela().className = 'tela sem-abas';
  elTela().innerHTML = `
    <div class="trava">
      <div class="trava-topo">
        <h1 class="trava-titulo">${esc(titulo)}</h1>
        <p class="trava-texto">${esc(texto)}</p>
      </div>

      <div class="trava-pontos" id="trava-pontos" aria-live="polite"></div>
      <p class="trava-erro" id="trava-erro" hidden></p>

      <div class="trava-teclado">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => teclaNumero(n)).join('')}
        <span></span>
        ${teclaNumero(0)}
        <button class="trava-tecla trava-apagar" data-tecla="apagar" aria-label="Apagar">${icones.apagar}</button>
      </div>

      <button class="botao botao-primario botao-bloco" id="trava-confirmar" disabled>${esc(rotuloConfirmar)}</button>

      ${linkRodape ? `<button class="trava-link" id="trava-link">${esc(linkRodape.rotulo)}</button>` : ''}
    </div>
  `;

  const elPontos = document.getElementById('trava-pontos');
  const elErro = document.getElementById('trava-erro');
  const elConfirmar = document.getElementById('trava-confirmar');

  function redesenharPontos() {
    elPontos.innerHTML = digitado
      .split('')
      .map(() => '<span class="trava-ponto"></span>')
      .join('');
    elConfirmar.disabled = digitado.length < minimo || processando;
  }

  function mostrarErro(mensagem) {
    elErro.textContent = mensagem;
    elErro.hidden = false;
    digitado = '';
    redesenharPontos();
    const container = elTela().querySelector('.trava');
    container.classList.remove('tremendo');
    // Força reflow para o CSS reiniciar a animação numa segunda tentativa.
    void container.offsetWidth;
    container.classList.add('tremendo');
  }

  function definirTeclasHabilitadas(habilitadas) {
    elTela().querySelectorAll('[data-tecla]').forEach(botao => { botao.disabled = !habilitadas; });
  }

  function aplicarBloqueio() {
    if (!obterBloqueio) return false;
    const { bloqueado, restanteMs } = obterBloqueio();
    if (!bloqueado) {
      if (temporizador) { clearInterval(temporizador); temporizador = null; }
      definirTeclasHabilitadas(true);
      redesenharPontos();
      return false;
    }
    digitado = '';
    redesenharPontos();
    definirTeclasHabilitadas(false);
    elConfirmar.disabled = true;
    const atualizar = () => {
      const estado = obterBloqueio();
      if (!estado.bloqueado) {
        clearInterval(temporizador);
        temporizador = null;
        definirTeclasHabilitadas(true);
        elErro.hidden = true;
        redesenharPontos();
        return;
      }
      elErro.hidden = false;
      elErro.textContent = `Muitas tentativas erradas. Tente de novo em ${formatarEspera(Math.ceil(estado.restanteMs / 1000))}.`;
    };
    atualizar();
    if (!temporizador) temporizador = setInterval(atualizar, 1000);
    return true;
  }

  elTela().querySelectorAll('[data-tecla]').forEach(botao => {
    botao.addEventListener('click', () => {
      if (processando) return;
      elErro.hidden = true;
      const tecla = botao.dataset.tecla;
      if (tecla === 'apagar') digitado = digitado.slice(0, -1);
      else digitado += tecla;
      redesenharPontos();
    });
  });

  if (linkRodape) {
    document.getElementById('trava-link').addEventListener('click', linkRodape.acao);
  }

  elConfirmar.addEventListener('click', async () => {
    if (digitado.length < minimo || processando) return;
    processando = true;
    elConfirmar.disabled = true;
    elConfirmar.textContent = 'Verificando…';
    try {
      await aoConfirmar(digitado, { erro: mostrarErro });
    } finally {
      processando = false;
      // Se `aoConfirmar` desenhou uma tela nova (próximo passo, ou o app
      // desbloqueado), este elemento nem existe mais — só reabilita se o
      // teclado ainda for o mesmo na tela.
      if (document.getElementById('trava-confirmar') === elConfirmar) {
        elConfirmar.textContent = rotuloConfirmar;
        if (!aplicarBloqueio()) redesenharPontos();
      }
    }
  });

  redesenharPontos();
  aplicarBloqueio();
}

function teclaNumero(n) {
  return `<button class="trava-tecla" data-tecla="${n}">${n}</button>`;
}
