// Build estático: lê data/imoveis.json e gera dist/ com a home,
// uma página por imóvel, fotos em WebP e imagens de prévia (og:image).
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { BASE_URL, INDEXAR, CORRETOR, DEPOIMENTOS } from './site.config.mjs';

const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(RAIZ, 'dist');
const FOTOS = path.join(RAIZ, 'fotos');
const LARGURAS = [480, 960, 1600];
const HERO = 'casa-piscina.jpg';
const FOTO_SOBRE = 'anderson.jpg';

const imoveis = JSON.parse(await readFile(path.join(RAIZ, 'data/imoveis.json'), 'utf8'));

// ---------- utilidades ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const abs = (p) => BASE_URL.replace(/\/$/, '') + p;
const brl = (n) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const area = (m2) => (m2 >= 10000 ? (m2 / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ha' : m2.toLocaleString('pt-BR') + ' m²');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const base = (arquivo) => arquivo.replace(/\.[^.]+$/, '');
const urlImovel = (im) => `/imovel/${im.slug}/`;
const wa = (msg) => `https://wa.me/${CORRETOR.whatsapp}?text=${encodeURIComponent(msg)}`;

// ---------- imagens ----------

const metaFotos = {};

async function processarFoto(arquivo) {
  if (metaFotos[arquivo]) return metaFotos[arquivo];
  const origem = path.join(FOTOS, arquivo);
  if (!existsSync(origem)) return (metaFotos[arquivo] = null);
  const { width: larguraOriginal } = await sharp(origem).metadata();
  const larguras = LARGURAS.filter((w) => w <= larguraOriginal);
  if (!larguras.length || larguras.at(-1) < Math.min(larguraOriginal, 1600)) larguras.push(Math.min(larguraOriginal, 1600));
  const variantes = [];
  for (const w of larguras) {
    const nome = `${base(arquivo)}-${w}.webp`;
    const destino = path.join(DIST, 'img', nome);
    const info = await sharp(origem).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toFile(destino);
    variantes.push({ w: info.width, h: info.height, src: `/img/${nome}` });
  }
  return (metaFotos[arquivo] = variantes);
}

async function imagemOg(arquivo, nome) {
  const destino = path.join(DIST, 'og', `${nome}.jpg`);
  await sharp(path.join(FOTOS, arquivo)).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, mozjpeg: true }).toFile(destino);
  return `/og/${nome}.jpg`;
}

function img(arquivo, { alt, sizes = '100vw', eager = false, cls = '' }) {
  const v = metaFotos[arquivo];
  if (!v) return `<div class="foto-vazia ${cls}" role="img" aria-label="Espaço reservado para foto"><span>Foto em breve</span></div>`;
  const media = v.find((x) => x.w >= 960) || v.at(-1);
  const srcset = v.map((x) => `${x.src} ${x.w}w`).join(', ');
  const carregamento = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img class="${cls}" src="${media.src}" srcset="${srcset}" sizes="${sizes}" width="${media.w}" height="${media.h}" alt="${esc(alt)}" decoding="async" ${carregamento}>`;
}

// ---------- pedaços de HTML ----------

const ICONES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-cama" viewBox="0 0 24 24"><path d="M3 19v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 15h18M6 9V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V9"/></symbol>
<symbol id="i-carro" viewBox="0 0 24 24"><path d="M4 16v-4l2.2-5h11.6L20 12v4H4zM4 12h16M6 16v2.5M18 16v2.5"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/></symbol>
<symbol id="i-area" viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></symbol>
<symbol id="i-banho" viewBox="0 0 24 24"><path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/></symbol>
<symbol id="i-suite" viewBox="0 0 24 24"><path d="M6 21V4h12v17M4 21h16M14.5 12.5h.01"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
<symbol id="i-casa" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6"/></symbol>
<symbol id="i-anterior" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
<symbol id="i-proximo" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
<symbol id="i-estrela" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></symbol>
<symbol id="i-whats" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.13c-.24.69-1.42 1.32-1.96 1.37-.5.05-1.13.07-1.83-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.58-.36.77-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.69.8 1.98.94.29.14.48.22.55.34.07.12.07.69-.17 1.36z"/></symbol>
</svg>`;

const estrelas = (cls = '') => `<span class="estrelas ${cls}" aria-hidden="true">${'<svg><use href="#i-estrela"/></svg>'.repeat(5)}</span>`;

// Contorno da serra que separa a foto de abertura do conteúdo.
const SERRA_PATH = 'M0 120 L0 92 L70 84 L130 66 L190 74 L260 44 L310 54 L380 24 L430 34 L480 16 L540 46 L600 40 L670 70 L740 58 L810 78 L880 52 L940 60 L1010 30 L1070 38 L1130 66 L1210 58 L1290 80 L1360 72 L1440 86 L1440 120 Z';
const serra = (cls) => `<svg class="serra ${cls}" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="serra__massa" d="${SERRA_PATH}"/><path class="serra__linha" d="${SERRA_PATH.replace(/ L1440 120 Z$/, '').replace(/^M0 120 L/, 'M')}"/></svg>`;

const selo = () => `<a class="selo-nota" href="/#sobre" aria-label="Nota ${CORRETOR.nota} no Google, ${CORRETOR.avaliacoes} avaliações. Ver depoimentos">
  <span class="selo-nota__numero">${CORRETOR.nota}</span>${estrelas()}<span class="selo-nota__texto">${CORRETOR.avaliacoes} avaliações no Google</span></a>`;

function head({ titulo, descricao, caminho, ogImagem, ogAlt, css }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${INDEXAR ? '' : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${abs(caminho)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(CORRETOR.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${abs(caminho)}">
<meta property="og:image" content="${abs(ogImagem)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F3B34">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..640&family=Instrument+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${css}">
</head>`;
}

const faixa = () => `<p class="faixa">Rascunho de apresentação, imóveis e valores ilustrativos</p>`;

function topo({ prefixo = '' } = {}) {
  return `<header class="topo">
  <div class="wrap topo__inner">
    <a class="marca" href="/"><span class="marca__nome">Anderson Zanelatto</span><span class="marca__creci">Corretor de imóveis, ${CORRETOR.creci}</span></a>
    <nav class="topo__nav" aria-label="Principal">
      <a class="topo__link" href="${prefixo}#imoveis">Imóveis</a><a class="topo__link" href="${prefixo}#simular">Simular</a><a class="topo__link" href="${prefixo}#sobre">Sobre</a>
      <a class="topo__link topo__link--destaque" href="${prefixo}#contato">Fale comigo</a>
    </nav>
  </div>
</header>`;
}

function rodape() {
  return `<footer class="rodape">
  <div class="wrap rodape__inner">
    <div>
      <p class="rodape__nome">Anderson Zanelatto</p>
      <p>Corretor de imóveis, ${CORRETOR.creci}</p>
    </div>
    <div>
      <p>${CORRETOR.endereco}</p>
      <p>${CORRETOR.bairroCidade}</p>
    </div>
    <div>
      <p><a href="${wa('Olá, Anderson! Vim pelo seu site.')}" target="_blank" rel="noopener">${CORRETOR.whatsappExibicao}</a></p>
      <p class="rodape__aviso">Site em rascunho. Imóveis e valores ilustrativos.</p>
    </div>
  </div>
</footer>`;
}

const flutuante = (msg) => `<a class="whats-flutuante" href="${wa(msg)}" target="_blank" rel="noopener" aria-label="Conversar com o Anderson no WhatsApp"><svg aria-hidden="true"><use href="#i-whats"/></svg></a>`;

function specs(im, completo = false) {
  const itens = [
    ['i-cama', plural(im.quartos, 'quarto', 'quartos')],
    ['i-carro', plural(im.vagas, 'vaga', 'vagas')],
    ['i-area', area(im.area)],
  ];
  return `<ul class="specs${completo ? ' specs--grande' : ''}">${itens.map(([i, t]) => `<li><svg aria-hidden="true"><use href="#${i}"/></svg>${t}</li>`).join('')}</ul>`;
}

function card(im, { eager = false } = {}) {
  return `<article class="card" data-tipo="${esc(im.tipo)}" data-bairro="${esc(im.bairro)}" data-valor="${im.valor}">
  <a class="card__link" href="${urlImovel(im)}">
    <div class="card__foto">
      ${img(im.fotos[0], { alt: im.titulo, sizes: '(min-width: 1080px) 340px, (min-width: 680px) 50vw, 100vw', eager })}
      <span class="tag">${esc(im.selo)}</span>
    </div>
    <div class="card__corpo">
      <p class="card__local"><svg aria-hidden="true"><use href="#i-pin"/></svg>${esc(im.bairro)}, ${esc(im.cidade)}</p>
      <h3 class="card__titulo">${esc(im.titulo)}</h3>
      <p class="card__valor">${brl(im.valor)}</p>
      ${specs(im)}
    </div>
  </a>
</article>`;
}

function simulador({ valor, imovel = '', link = '' }) {
  return `<section class="sim" id="simular" aria-labelledby="sim-titulo" data-sim data-imovel="${esc(imovel)}" data-link="${esc(link)}">
  <div class="wrap">
    <div class="sim__cabeca">
      <h2 id="sim-titulo">Simule a parcela</h2>
      <p>Mexa nos valores e veja na hora quanto fica por mês. Depois me mande a simulação, que eu confiro as condições com o banco.</p>
    </div>
    <div class="sim__grid">
      <form class="sim__controles" novalidate>
        <div class="campo">
          <label for="sim-valor">Valor do imóvel</label>
          <input id="sim-valor" name="valor" type="text" inputmode="numeric" autocomplete="off" value="${brl(valor)}" data-sim-valor>
        </div>
        <div class="campo campo--faixa">
          <div class="campo__linha"><label for="sim-entrada">Entrada</label><output for="sim-entrada" data-sim-out="entrada"></output></div>
          <input id="sim-entrada" type="range" min="5" max="80" step="1" value="20" data-sim-entrada>
        </div>
        <div class="campo campo--faixa">
          <div class="campo__linha"><label for="sim-prazo">Prazo</label><output for="sim-prazo" data-sim-out="prazo"></output></div>
          <input id="sim-prazo" type="range" min="5" max="35" step="1" value="30" data-sim-prazo>
        </div>
        <div class="campo campo--faixa">
          <div class="campo__linha"><label for="sim-juros">Juros ao ano</label><output for="sim-juros" data-sim-out="juros"></output></div>
          <input id="sim-juros" type="range" min="7" max="15" step="0.1" value="11" data-sim-juros>
        </div>
      </form>
      <div class="sim__resultado" aria-live="polite">
        <p class="sim__rotulo">Primeira parcela (SAC)</p>
        <p class="sim__destaque" data-sim-r="sac1">-</p>
        <p class="sim__aviso" data-sim-aviso hidden>Com menos de 20% de entrada poucos bancos aprovam o financiamento. Me chame que eu vejo as opções com você.</p>
        <dl class="sim__lista">
          <div><dt>Parcela fixa (Price)</dt><dd data-sim-r="price">-</dd></div>
          <div><dt>Valor financiado</dt><dd data-sim-r="financiado">-</dd></div>
          <div><dt>Renda mínima sugerida</dt><dd data-sim-r="renda">-</dd></div>
          <div><dt>Última parcela (SAC)</dt><dd data-sim-r="sacN">-</dd></div>
        </dl>
        <button type="button" class="btn btn--whats" data-sim-enviar><svg aria-hidden="true"><use href="#i-whats"/></svg>Enviar simulação no WhatsApp</button>
        <p class="sim__nota">Cálculo aproximado, sem seguros e taxas. A renda mínima considera a parcela em até 30% da renda.</p>
      </div>
    </div>
  </div>
</section>`;
}

function reputacao({ titulo = 'O que dizem os clientes', id = 'reputacao' } = {}) {
  return `<div class="reputacao" id="${id}">
  <div class="reputacao__nota">
    <p class="reputacao__numero">${CORRETOR.nota}</p>
    <div>${estrelas('estrelas--grande')}<p class="reputacao__total">${CORRETOR.avaliacoes} avaliações no Google</p></div>
  </div>
  <h3 class="reputacao__titulo">${titulo}</h3>
  <ul class="depoimentos">
    ${DEPOIMENTOS.map((d) => `<li><figure><blockquote><p>${esc(d)}</p></blockquote><figcaption>Resumo de avaliação no Google</figcaption></figure></li>`).join('\n    ')}
  </ul>
</div>`;
}

const scriptTag = (js) => `<script src="${js}" defer></script>`;

// ---------- páginas ----------

function paginaHome({ css, js, og }) {
  const tipos = [...new Set(imoveis.map((i) => i.tipo))];
  const bairros = [...new Set(imoveis.map((i) => i.bairro))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const conta = (f) => imoveis.filter(f).length;
  const regioes = [
    { nome: 'Pagani', linha: 'Lançamentos e prontos, perto de tudo', bairro: 'Pagani', tipo: '' },
    { nome: 'Pedra Branca', linha: 'Bairro planejado, dá para viver a pé', bairro: 'Pedra Branca', tipo: '' },
    { nome: 'Quinta dos Guimarães', linha: 'Casas em condomínio em Santo Amaro', bairro: 'Quinta dos Guimarães', tipo: '' },
    { nome: 'Sítios', linha: 'Alto padrão entre a mata e o rio', bairro: '', tipo: 'Sítio' },
  ];
  return `${head({
    titulo: 'Anderson Zanelatto, corretor de imóveis em Palhoça',
    descricao: 'Apartamentos no Pagani e na Pedra Branca, casas em condomínio em Santo Amaro e sítios de alto padrão. Nota 5,0 no Google.',
    caminho: '/',
    ogImagem: og,
    ogAlt: 'Casa com piscina, imóvel ilustrativo do site do Anderson Zanelatto',
    css,
  })}
<body>
${ICONES}
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${faixa()}
${topo()}
<main id="conteudo">
  <section class="abertura" aria-labelledby="abertura-titulo">
    ${img(HERO, { alt: 'Casa com piscina e vista para o céu do fim de tarde', eager: true, cls: 'abertura__foto' })}
    <div class="wrap abertura__texto">
      <h1 id="abertura-titulo">Seu próximo endereço entre o Pagani e a serra.</h1>
      <p>Sou o Anderson, corretor em Palhoça. Trabalho com apartamentos na planta e prontos no Pagani e na Pedra Branca, casas em condomínio em Santo Amaro e sítios de alto padrão.</p>
    </div>
    <div class="abertura__base">${serra('serra--abertura')}</div>
    <div class="wrap abertura__selo">${selo()}</div>
  </section>

  <section class="busca" id="buscar" aria-labelledby="busca-titulo">
    <div class="wrap">
      <h2 id="busca-titulo" class="busca__titulo">O que você procura?</h2>
      <form class="busca__form" data-busca>
        <div class="campo">
          <label for="f-tipo">Tipo</label>
          <select id="f-tipo" name="tipo"><option value="">Todos os tipos</option>${tipos.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
        </div>
        <div class="campo">
          <label for="f-bairro">Bairro</label>
          <select id="f-bairro" name="bairro"><option value="">Todos os bairros</option>${bairros.map((b) => `<option>${esc(b)}</option>`).join('')}</select>
        </div>
        <div class="campo">
          <label for="f-valor">Valor</label>
          <select id="f-valor" name="valor">
            <option value="">Qualquer valor</option>
            <option value="0-700000">Até R$ 700 mil</option>
            <option value="700000-1500000">R$ 700 mil a R$ 1,5 milhão</option>
            <option value="1500000-2500000">R$ 1,5 a R$ 2,5 milhões</option>
            <option value="2500000-">Acima de R$ 2,5 milhões</option>
          </select>
        </div>
        <button class="btn btn--primario busca__botao" type="submit">Ver imóveis</button>
      </form>
    </div>
  </section>

  <section class="regioes" aria-labelledby="regioes-titulo">
    <div class="wrap">
      <h2 id="regioes-titulo">Onde eu trabalho</h2>
      <ul class="regioes__lista">
        ${regioes.map((r) => `<li><button type="button" class="regiao" data-regiao-bairro="${esc(r.bairro)}" data-regiao-tipo="${esc(r.tipo)}" aria-pressed="false">
          <span class="regiao__nome">${r.nome}</span><span class="regiao__linha">${r.linha}</span><span class="regiao__conta">${plural(conta((i) => (!r.bairro || i.bairro === r.bairro) && (!r.tipo || i.tipo === r.tipo)), 'imóvel', 'imóveis')}</span>
        </button></li>`).join('\n        ')}
      </ul>
    </div>
  </section>

  <section class="imoveis" id="imoveis" aria-labelledby="imoveis-titulo">
    <div class="wrap">
      <div class="imoveis__cabeca">
        <h2 id="imoveis-titulo">Imóveis</h2>
        <p class="imoveis__conta" data-conta aria-live="polite">${plural(imoveis.length, 'imóvel', 'imóveis')}</p>
        <button type="button" class="btn btn--linha" data-limpar hidden>Limpar filtros</button>
      </div>
      <div class="grade-cards" data-lista>
        ${imoveis.map((im) => card(im)).join('\n')}
      </div>
      <div class="vazio" data-vazio hidden>
        <p>Nenhum imóvel com esses filtros por aqui. Mude o bairro ou a faixa de valor, ou me conte o que você procura que eu busco para você.</p>
        <button type="button" class="btn btn--linha" data-limpar>Limpar filtros</button>
      </div>
    </div>
  </section>

  ${simulador({ valor: 890000 })}

  <section class="sobre" id="sobre" aria-labelledby="sobre-titulo">
    <div class="wrap sobre__grid">
      <div class="sobre__foto">${img(FOTO_SOBRE, { alt: 'Anderson Zanelatto sentado em uma poltrona', sizes: '(min-width: 900px) 420px, 100vw' })}</div>
      <div class="sobre__texto">
        <h2 id="sobre-titulo">Prazer, eu sou o Anderson</h2>
        <p>Trabalho em Palhoça e região, e é aqui que eu conheço cada detalhe: qual prédio do Pagani tem a melhor planta, qual lado da Pedra Branca pega o sol da manhã, quanto tempo leva de Santo Amaro até a BR-101 no horário de pico.</p>
        <p>Respondo rápido, explico cada etapa da compra e só indico o que eu compraria no seu lugar. Do primeiro contato à entrega das chaves, você fala direto comigo.</p>
      </div>
    </div>
    <div class="wrap">${reputacao({ id: 'reputacao' })}</div>
  </section>

  <section class="contato" id="contato" aria-labelledby="contato-titulo">
    <div class="wrap contato__grid">
      <div class="contato__info">
        <h2 id="contato-titulo">Vamos conversar</h2>
        <p>Conte o que você procura. A mensagem chega direto no meu WhatsApp e eu respondo no mesmo dia.</p>
        <dl class="contato__dados">
          <div><dt>Escritório</dt><dd><a href="${CORRETOR.mapa}" target="_blank" rel="noopener">${CORRETOR.endereco}, ${CORRETOR.bairroCidade}</a></dd></div>
          <div><dt>WhatsApp</dt><dd><a href="${wa('Olá, Anderson! Vim pelo seu site.')}" target="_blank" rel="noopener">${CORRETOR.whatsappExibicao}</a></dd></div>
          <div><dt>Registro</dt><dd>${CORRETOR.creci}</dd></div>
        </dl>
      </div>
      <form class="contato__form" data-contato novalidate>
        <div class="campo">
          <label for="c-nome">Seu nome</label>
          <input id="c-nome" name="nome" type="text" autocomplete="name" aria-describedby="c-nome-erro">
          <p class="campo__erro" id="c-nome-erro" hidden></p>
        </div>
        <div class="campo">
          <label for="c-tel">WhatsApp com DDD</label>
          <input id="c-tel" name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(48) 99999-0000" aria-describedby="c-tel-erro">
          <p class="campo__erro" id="c-tel-erro" hidden></p>
        </div>
        <div class="campo">
          <label for="c-interesse">Você quer</label>
          <select id="c-interesse" name="interesse">
            <option>Comprar um imóvel</option>
            <option>Vender meu imóvel</option>
            <option>Investir</option>
            <option>Outro assunto</option>
          </select>
        </div>
        <div class="campo">
          <label for="c-msg">Mensagem <span class="campo__opcional">(opcional)</span></label>
          <textarea id="c-msg" name="mensagem" rows="4" placeholder="Ex.: apartamento de 3 quartos no Pagani até R$ 900 mil"></textarea>
        </div>
        <button class="btn btn--whats" type="submit"><svg aria-hidden="true"><use href="#i-whats"/></svg>Enviar pelo WhatsApp</button>
      </form>
    </div>
  </section>
</main>
${rodape()}
${flutuante('Olá, Anderson! Vim pelo seu site e quero conversar sobre imóveis.')}
${scriptTag(js)}
</body>
</html>`;
}

function paginaImovel(im, { css, js, og }) {
  const caminho = urlImovel(im);
  const fotos = [...im.fotos];
  const vazios = Math.max(0, 2 - fotos.length);
  const slides = [
    ...fotos.map((f, i) => `<figure class="galeria__slide">${img(f, { alt: `${im.titulo}, foto ${i + 1}`, sizes: '(min-width: 1080px) 1040px, 100vw', eager: i === 0 })}</figure>`),
    ...Array.from({ length: vazios }, () => `<div class="galeria__slide galeria__vazio" role="img" aria-label="Espaço reservado para mais fotos"><span>Espaço para mais fotos deste imóvel</span></div>`),
  ];
  const total = slides.length;
  const outros = imoveis.filter((o) => o.slug !== im.slug).sort((a, b) => Math.abs(a.valor - im.valor) - Math.abs(b.valor - im.valor)).slice(0, 2);
  const msgVisita = `Olá, Anderson! Vi o imóvel "${im.titulo}" (${im.bairro}, ${brl(im.valor)}) no seu site e quero agendar uma visita.\n${abs(caminho)}`;
  const descricao = `${im.tipo} em ${im.bairro}, ${im.cidade}. ${plural(im.quartos, 'quarto', 'quartos')}, ${area(im.area)}, ${brl(im.valor)}.`;
  const ficha = [
    ['i-casa', 'Tipo', im.tipo],
    ['i-cama', 'Quartos', im.quartos],
    ['i-suite', 'Suítes', im.suites],
    ['i-banho', 'Banheiros', im.banheiros],
    ['i-carro', 'Vagas', im.vagas],
    ['i-area', 'Área', area(im.area)],
  ];
  return `${head({ titulo: `${im.titulo} | Anderson Zanelatto`, descricao, caminho, ogImagem: og, ogAlt: im.titulo, css })}
<body class="pagina-imovel">
${ICONES}
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${faixa()}
${topo({ prefixo: '/' })}
<main id="conteudo">
  <div class="wrap imovel__topo">
    <a class="voltar" href="/#imoveis"><svg aria-hidden="true"><use href="#i-anterior"/></svg>Todos os imóveis</a>
    <div class="galeria" data-galeria>
      <div class="galeria__trilho" tabindex="0" role="region" aria-label="Fotos do imóvel, deslize para ver mais">
        ${slides.join('\n        ')}
      </div>
      ${total > 1 ? `<div class="galeria__ctrl">
        <button type="button" class="galeria__btn" data-anterior aria-label="Foto anterior"><svg aria-hidden="true"><use href="#i-anterior"/></svg></button>
        <span class="galeria__contador" data-contador aria-live="polite">1 de ${total}</span>
        <button type="button" class="galeria__btn" data-proximo aria-label="Próxima foto"><svg aria-hidden="true"><use href="#i-proximo"/></svg></button>
      </div>` : ''}
      <span class="tag tag--galeria">${esc(im.selo)}</span>
    </div>

    <div class="imovel__info">
      <p class="card__local"><svg aria-hidden="true"><use href="#i-pin"/></svg>${esc(im.bairro)}, ${esc(im.cidade)}</p>
      <h1 class="imovel__titulo">${esc(im.titulo)}</h1>
      <p class="imovel__valor">${brl(im.valor)}</p>
      <dl class="ficha">
        ${ficha.map(([i, k, v]) => `<div><dt><svg aria-hidden="true"><use href="#${i}"/></svg>${k}</dt><dd>${esc(v)}</dd></div>`).join('\n        ')}
      </dl>
      <p class="imovel__descricao">${esc(im.descricao)}</p>
      <a class="btn btn--whats btn--largo" href="${wa(msgVisita)}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-whats"/></svg>Agendar visita</a>
      <a class="btn btn--linha btn--largo" href="#simular">Simular financiamento</a>
    </div>
  </div>

  ${simulador({ valor: im.valor, imovel: im.titulo, link: abs(caminho) })}

  <section class="sobre sobre--compacto" aria-label="Avaliações do Anderson">
    <div class="wrap">${reputacao({ titulo: 'Quem já comprou comigo', id: 'reputacao' })}</div>
  </section>

  <section class="imoveis imoveis--relacionados" aria-labelledby="outros-titulo">
    <div class="wrap">
      <h2 id="outros-titulo">Veja também</h2>
      <div class="grade-cards grade-cards--dois">
        ${outros.map((o) => card(o)).join('\n')}
      </div>
    </div>
  </section>
</main>
${rodape()}
${flutuante(`Olá, Anderson! Tenho interesse no imóvel "${im.titulo}".\n${abs(caminho)}`)}
${scriptTag(js)}
</body>
</html>`;
}

function pagina404({ css, js, og }) {
  return `${head({ titulo: 'Página não encontrada | Anderson Zanelatto', descricao: 'Esta página não existe mais.', caminho: '/404', ogImagem: og, ogAlt: 'Anderson Zanelatto', css })}
<body>
${ICONES}
${faixa()}
${topo({ prefixo: '/' })}
<main id="conteudo" class="wrap nao-encontrada">
  <h1>Este imóvel não está mais aqui</h1>
  <p>Ele pode ter sido vendido ou o link mudou. Veja os imóveis disponíveis ou me chame no WhatsApp.</p>
  <a class="btn btn--primario" href="/#imoveis">Ver imóveis disponíveis</a>
</main>
${rodape()}
${flutuante('Olá, Anderson! Vim pelo seu site.')}
${scriptTag(js)}
</body>
</html>`;
}

// ---------- execução ----------

async function asset(origem, nome, ext) {
  const conteudo = await readFile(path.join(RAIZ, origem));
  const hash = createHash('sha1').update(conteudo).digest('hex').slice(0, 8);
  const arquivo = `/assets/${nome}.${hash}.${ext}`;
  await writeFile(path.join(DIST, arquivo), conteudo);
  return arquivo;
}

async function gravar(caminho, html) {
  const destino = path.join(DIST, caminho, caminho.endsWith('.html') ? '' : 'index.html');
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, html);
}

const inicio = Date.now();
await rm(DIST, { recursive: true, force: true });
for (const d of ['img', 'og', 'assets']) await mkdir(path.join(DIST, d), { recursive: true });

const usadas = new Set([HERO, FOTO_SOBRE, ...imoveis.flatMap((i) => i.fotos)]);
await Promise.all([...usadas].map(processarFoto));
const faltando = [...usadas].filter((f) => !metaFotos[f]);
if (faltando.length) console.warn('Fotos não encontradas (espaço reservado no lugar):', faltando.join(', '));

const css = await asset('src/styles.css', 'styles', 'css');
const js = await asset('src/app.js', 'app', 'js');
const ogHome = await imagemOg(HERO, 'home');

await gravar('/', paginaHome({ css, js, og: ogHome }));
for (const im of imoveis) {
  const og = metaFotos[im.fotos[0]] ? await imagemOg(im.fotos[0], im.slug) : ogHome;
  await gravar(urlImovel(im), paginaImovel(im, { css, js, og }));
}
await gravar('/404.html', pagina404({ css, js, og: ogHome }));
await copyFile(path.join(RAIZ, 'src/favicon.svg'), path.join(DIST, 'favicon.svg'));
await writeFile(path.join(DIST, 'robots.txt'), INDEXAR ? `User-agent: *\nAllow: /\nSitemap: ${abs('/sitemap.xml')}\n` : 'User-agent: *\nDisallow:\n');
await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...imoveis.map(urlImovel)].map((u) => `  <url><loc>${abs(u)}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Build pronto em ${((Date.now() - inicio) / 1000).toFixed(1)}s: ${imoveis.length} imóveis, ${usadas.size} fotos. BASE_URL = ${BASE_URL}`);
