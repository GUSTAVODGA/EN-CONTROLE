// ══════════════════════════════════════════════════════════════════════════
// ARMAZENAMENTO
//
// Toda mutação passa por aqui, e só por aqui. A interface nunca escreve num
// objeto de dado: ela chama uma ação, o estado é substituído por um novo, o
// novo é gravado e os assinantes redesenham. Um caminho só, sempre o mesmo.
//
// A persistência é injetada como adaptador — hoje `localStorage`, amanhã
// Firestore. Como toda a camada de cálculo é pura e derivada, trocar o
// adaptador por um que sincronize entre os dois sócios não muda uma linha de
// regra financeira: muda quem entrega o objeto de dados e quem avisa quando
// ele mudou.
// ══════════════════════════════════════════════════════════════════════════

import {
  normalizar,
  criarCliente, aplicarEdicaoCliente, criarDivida, criarPagamento, criarMovimentoCaixa,
} from './model.js';
import { cifrar, decifrar } from './crypto.js';

export const CHAVE_ARMAZENAMENTO = 'en-controle:v1';

/** Adaptador padrão: o armazenamento local do aparelho. */
export function adaptadorLocal(chave = CHAVE_ARMAZENAMENTO) {
  return {
    ler() {
      try {
        const cru = globalThis.localStorage?.getItem(chave);
        return cru ? JSON.parse(cru) : null;
      } catch {
        // Dado ilegível não derruba o app: ele volta vazio e o usuário vê a
        // tela inicial em vez de uma página branca.
        return null;
      }
    },
    escrever(estado) {
      try {
        globalThis.localStorage?.setItem(chave, JSON.stringify(estado));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Adaptador de memória — usado pelos testes. */
export function adaptadorMemoria(inicial = null) {
  let dados = inicial;
  return {
    ler: () => dados,
    escrever(estado) {
      dados = JSON.parse(JSON.stringify(estado));
      return true;
    },
  };
}

/**
 * Adaptador que cifra tudo antes de gravar no `localStorage`, com a chave
 * derivada do código de acesso na tela de desbloqueio.
 *
 * `ler()` sempre devolve `null` de propósito: o estado inicial já chega
 * decifrado de fora (a tela de desbloqueio decifra antes de o store existir),
 * e `criarStore` recebe isso via `estadoInicial` — não há por que decifrar de
 * novo aqui.
 *
 * `escrever()` é assíncrono (cifrar é assíncrono), mas `aplicar()` no store
 * não espera por ele: a leitura em memória já está correta no instante da
 * chamada, e a gravação em disco termina alguns milissegundos depois, sem
 * bloquear a tela.
 */
export function adaptadorCriptografado(chave, chaveArmazenamento = CHAVE_ARMAZENAMENTO) {
  return {
    ler: () => null,
    async escrever(estado) {
      try {
        const cifrado = await cifrar(chave, JSON.stringify(estado));
        globalThis.localStorage?.setItem(chaveArmazenamento, JSON.stringify(cifrado));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Decifra o que `adaptadorCriptografado` gravou. Usado na tela de desbloqueio. */
export async function lerCriptografado(chave, chaveArmazenamento = CHAVE_ARMAZENAMENTO) {
  const bruto = globalThis.localStorage?.getItem(chaveArmazenamento);
  if (!bruto) return null;
  const cifrado = JSON.parse(bruto);
  const texto = await decifrar(chave, cifrado);
  return JSON.parse(texto);
}

export function criarStore(adaptador = adaptadorLocal(), estadoInicial = null) {
  let estado = estadoInicial ? normalizar(estadoInicial) : normalizar(adaptador.ler());
  const ouvintes = new Set();
  let falhaAoGravar = false;

  function aplicar(transformacao) {
    estado = { ...estado, ...transformacao(estado) };
    // A leitura em memória (linha acima) já está correta neste instante — é
    // o que a interface usa para redesenhar. A gravação em disco pode ser
    // assíncrona (o adaptador criptografado cifra antes de gravar) sem que
    // nada no resto do app precise de `await`: só o resultado de
    // `gravacaoFalhou()`, usado uma única vez no aviso de inicialização,
    // chega um instante depois.
    Promise.resolve(adaptador.escrever(estado))
      .then(ok => { falhaAoGravar = !ok; })
      .catch(() => { falhaAoGravar = true; });
    for (const ouvinte of ouvintes) ouvinte(estado);
    return estado;
  }

  return {
    estado: () => estado,
    gravacaoFalhou: () => falhaAoGravar,

    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },

    cliente(id) {
      return estado.clientes.find(c => c.id === id) || null;
    },
    divida(id) {
      return estado.dividas.find(d => d.id === id) || null;
    },
    pagamentosDaDivida(dividaId) {
      return estado.pagamentos.filter(p => p.dividaId === dividaId);
    },

    // ── clientes ──────────────────────────────────────────────────────────
    adicionarCliente(campos) {
      const cliente = criarCliente(campos);
      aplicar(e => ({ clientes: [...e.clientes, cliente] }));
      return cliente;
    },

    editarCliente(id, campos) {
      const atual = estado.clientes.find(c => c.id === id);
      if (!atual) return null;
      const atualizado = aplicarEdicaoCliente(atual, campos);
      aplicar(e => ({ clientes: e.clientes.map(c => (c.id === id ? atualizado : c)) }));
      return atualizado;
    },

    /** Remove o cliente e, junto, todas as dívidas e pagamentos dele. */
    removerCliente(id) {
      const dividas = estado.dividas.filter(d => d.clienteId === id).map(d => d.id);
      aplicar(e => ({
        clientes: e.clientes.filter(c => c.id !== id),
        dividas: e.dividas.filter(d => d.clienteId !== id),
        pagamentos: e.pagamentos.filter(p => !dividas.includes(p.dividaId)),
      }));
    },

    // ── dívidas ───────────────────────────────────────────────────────────
    adicionarDivida(campos) {
      const divida = criarDivida(campos);
      aplicar(e => ({ dividas: [...e.dividas, divida] }));
      return divida;
    },

    removerDivida(id) {
      aplicar(e => ({
        dividas: e.dividas.filter(d => d.id !== id),
        pagamentos: e.pagamentos.filter(p => p.dividaId !== id),
      }));
    },

    // ── pagamentos ────────────────────────────────────────────────────────
    registrarPagamento(campos) {
      const pagamento = criarPagamento(campos);
      aplicar(e => ({ pagamentos: [...e.pagamentos, pagamento] }));
      return pagamento;
    },

    removerPagamento(id) {
      aplicar(e => ({ pagamentos: e.pagamentos.filter(p => p.id !== id) }));
    },

    // ── caixa ─────────────────────────────────────────────────────────────
    registrarMovimentoCaixa(campos) {
      const movimento = criarMovimentoCaixa(campos);
      aplicar(e => ({ caixa: [...e.caixa, movimento] }));
      return movimento;
    },

    removerMovimentoCaixa(id) {
      aplicar(e => ({ caixa: e.caixa.filter(m => m.id !== id) }));
    },
  };
}
