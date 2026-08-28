// Os únicos sete ícones do sistema. Todos são NAVEGAÇÃO ou CONTROLE — voltar,
// avançar, buscar, somar, subtrair, editar, apagar. Nenhum é decorativo: onde
// um ícone só ilustraria o que a palavra ao lado já diz, ele não existe.
//
// Mesmo traço em todos: 24×24, contorno de 1,5, pontas arredondadas.

const desenho = corpo =>
  `<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

export const icones = {
  esquerda: desenho('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
  direita: desenho('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
  busca: desenho('<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.4 4.4"/>'),
  mais: desenho('<path d="M12 5.5v13M5.5 12h13"/>'),
  menos: desenho('<path d="M5.5 12h13"/>'),
  lapis: desenho('<path d="M4.6 19.4h3.6L18.9 8.7l-3.6-3.6L4.6 15.8Z"/><path d="m13.9 6.5 3.6 3.6"/>'),
  apagar: desenho('<path d="M9.3 5.5H19a1.2 1.2 0 0 1 1.2 1.2v10.6A1.2 1.2 0 0 1 19 18.5H9.3L3.9 12.6a1 1 0 0 1 0-1.2Z"/><path d="m10.8 9.8 4.8 4.8m0-4.8-4.8 4.8"/>'),
};
