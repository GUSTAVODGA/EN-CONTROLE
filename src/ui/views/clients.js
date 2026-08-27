// CLIENTES — a lista, com busca. Cada linha diz três coisas: quem é, quanto
// ainda deve e como está. Nada além disso.

import { esc, estadoVazio } from '../dom.js';
import { icones } from '../icons.js';
import { situacaoDoCliente } from '../pieces.js';
import { formatarReais } from '../../core/money.js';
import { formatarDataCurta } from '../../core/dates.js';
import { estadoDoCliente } from '../../core/portfolio.js';
import { formatarTelefone } from '../../core/model.js';

// A busca vive fora do estado do app de propósito: é preferência de momento,
// não dado. Some ao sair da tela, como deve.
let termoDeBusca = '';

export function telaClientes(ctx) {
  const clientes = ctx.dados.clientes
    .map(c => estadoDoCliente(c, ctx.pano))
    .sort(ordenar);

  const filtrados = filtrar(clientes, termoDeBusca);

  return {
    titulo: 'Clientes',
    acaoTopo: { acao: 'novo-cliente', icone: icones.mais, rotulo: 'Novo cliente' },
    html: clientes.length === 0 ? semClientes() : `
      <div class="busca" style="margin:10px 0 8px">
        ${icones.busca}
        <input class="entrada" id="busca-clientes" type="search" placeholder="Buscar por nome ou telefone"
               value="${esc(termoDeBusca)}" autocomplete="off" enterkeyhint="search">
      </div>
      ${filtrados.length === 0
        ? estadoVazio({ titulo: 'Nada encontrado.', texto: `Nenhum cliente corresponde a "${termoDeBusca.trim()}".` })
        : `<div class="itens">${filtrados.map(linhaCliente).join('')}</div>`}
    `,
    aoMontar(raiz) {
      const campo = raiz.querySelector('#busca-clientes');
      if (!campo) return;
      campo.addEventListener('input', () => {
        termoDeBusca = campo.value;
        ctx.atualizar({ manterFoco: '#busca-clientes' });
      });
    },
  };
}

/** Ordem útil: quem está em atraso primeiro, depois quem deve mais. */
function ordenar(a, b) {
  const pesoA = a.situacao === 'atrasado' ? 0 : a.aReceberCents > 0 ? 1 : 2;
  const pesoB = b.situacao === 'atrasado' ? 0 : b.aReceberCents > 0 ? 1 : 2;
  if (pesoA !== pesoB) return pesoA - pesoB;
  if (a.aReceberCents !== b.aReceberCents) return b.aReceberCents - a.aReceberCents;
  return a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR');
}

function filtrar(lista, termo) {
  const limpo = termo.trim().toLowerCase();
  if (!limpo) return lista;
  const digitos = limpo.replace(/\D/g, '');
  return lista.filter(({ cliente }) =>
    cliente.nome.toLowerCase().includes(limpo) ||
    (digitos.length >= 3 && cliente.telefone.replace(/\D/g, '').includes(digitos))
  );
}

function linhaCliente(estado) {
  const { cliente } = estado;
  const situacao = situacaoDoCliente(estado);

  const sub = estado.proximoVencimento
    ? `próximo vencimento ${formatarDataCurta(estado.proximoVencimento)}`
    : cliente.telefone
      ? formatarTelefone(cliente.telefone)
      : '';

  return `<button class="item" data-acao="abrir-cliente" data-cliente="${esc(cliente.id)}">
    <span class="item-corpo">
      <span class="item-nome">${esc(cliente.nome)}</span>
      ${sub ? `<span class="item-sub">${esc(sub)}</span>` : ''}
    </span>
    <span class="item-fim">
      <span class="cifra cifra-media">${esc(formatarReais(estado.aReceberCents))}</span>
      <span class="item-sub ${situacao.tom}">${esc(situacao.texto)}</span>
    </span>
  </button>`;
}

function semClientes() {
  return estadoVazio({
    titulo: 'Nenhum cliente ainda.',
    texto: 'Os clientes são a base de tudo: cada dívida pertence a um deles.',
    botao: { acao: 'novo-cliente', rotulo: 'Cadastrar cliente' },
  });
}
