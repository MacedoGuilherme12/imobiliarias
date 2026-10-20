// Troque BASE_URL pelo domínio final depois do deploy (sem barra no fim).
// Ela gera canonical e og:image em URL absoluta em todas as páginas.
export const BASE_URL = 'https://imobiliarias-omega.vercel.app';

// Rascunho: deixe false para os buscadores não indexarem antes da aprovação.
export const INDEXAR = false;

export const CORRETOR = {
  nome: 'Anderson Zanelatto',
  creci: 'CRECI 38199-F',
  whatsapp: '5548991731156',
  whatsappExibicao: '(48) 99173-1156',
  endereco: 'Av. Hilza Terezinha Pagani, 222, sala 02',
  bairroCidade: 'Pagani, Palhoça (SC)',
  mapa: 'https://www.google.com/maps/search/?api=1&query=Av.+Hilza+Terezinha+Pagani,+222,+Palho%C3%A7a+SC',
  nota: '5,0',
  avaliacoes: 50,
};

export const DEPOIMENTOS = [
  'Respondia minhas mensagens em minutos, até no fim de semana. Isso fez diferença na hora de fechar.',
  'Conhece cada rua do Pagani e da Pedra Branca. Mostrou o que valia a pena e também o que não valia.',
  'Tudo explicado com calma, documentação conferida e nenhuma surpresa na assinatura. Me senti seguro do início ao fim.',
];
