// Grava o vídeo de demonstração (demo-anderson.mp4) quadro a quadro.
// O site roda num celular virtual (412x915, isMobile, hasTouch, deviceScaleFactor 2.6);
// cada quadro é uma captura de tela montada num quadro vertical 1080x1920 com sharp,
// e o ffmpeg junta tudo em H.264. Rolagens e controles são interpolados quadro a quadro.
import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { servir } from './serve.mjs';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const QUADROS = path.join(RAIZ, '.demo-frames');
const AMOSTRAS = path.join(RAIZ, 'demo-amostras');
const SAIDA = path.join(RAIZ, 'demo-anderson.mp4');
const PORTA = 4175;
const URL_BASE = `http://localhost:${PORTA}`;
const IMOVEL = '/imovel/casa-quinta-dos-guimaraes/';

const FPS = 30;
const W = 1080, H = 1920;
const VW = 412, VH = 915, DPR = 2.6;
const TELA_W = 744, TELA_H = Math.round((TELA_W * VH) / VW); // 1652
const TELA_X = (W - TELA_W) / 2, TELA_Y = 232;
const FAIXA_LEGENDA = 216;

const LEGENDAS = {
  abrir: 'É isso que o cliente vê ao abrir o link',
  busca: 'O cliente encontra o que procura',
  pagina: 'Cada imóvel tem sua própria página para você mandar aos clientes',
  simula: 'O cliente simula a parcela na hora',
  contato: 'O contato chega pronto no seu WhatsApp',
  reputacao: 'Sua reputação em destaque',
};

const seg = (s) => Math.round(s * FPS);
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- peças gráficas renderizadas uma vez (mesma tipografia do site) ----------

const FONTES = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..640&family=Instrument+Sans:wght@400;500;600&display=block">`;
const SERRA = 'M0 92 L70 84 L130 66 L190 74 L260 44 L310 54 L380 24 L430 34 L480 16 L540 46 L600 40 L670 70 L740 58 L810 78 L880 52 L940 60 L1010 30 L1070 38 L1130 66 L1210 58 L1290 80 L1360 72 L1440 86';

async function renderHtml(browser, html, { largura = W, altura = H, transparente = false } = {}) {
  const pg = await browser.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const buf = await pg.screenshot({ type: 'png', omitBackground: transparente });
  await pg.close();
  return buf;
}

const cartao = (titulo, sub) => `<!doctype html><html><head>${FONTES}<style>
  body{margin:0;width:${W}px;height:${H}px;background:#1f3b34;color:#f4efe6;font-family:'Instrument Sans',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;position:relative;overflow:hidden}
  h1{font-family:'Fraunces',serif;font-weight:500;font-size:112px;line-height:1.04;margin:0;letter-spacing:-0.01em}
  p{margin:44px 0 0;font-size:42px;color:#e3a869;font-weight:500}
  svg{position:absolute;left:0;bottom:0;width:100%;height:420px}
</style></head><body><h1>${titulo}</h1><p>${sub}</p>
<svg viewBox="0 0 1440 250" preserveAspectRatio="none"><path d="${SERRA} L1440 250 L0 250Z" fill="#16302a"/><path d="${SERRA}" fill="none" stroke="#c8823a" stroke-width="3" vector-effect="non-scaling-stroke"/></svg></body></html>`;

const fundo = () => `<!doctype html><html><head><style>
  body{margin:0;width:${W}px;height:${H}px;background:radial-gradient(120% 60% at 50% 0%,#24453d 0%,#1f3b34 55%,#16302a 100%)}
  .aro{position:absolute;left:${TELA_X - 10}px;top:${TELA_Y - 10}px;width:${TELA_W + 20}px;height:${TELA_H + 20}px;border-radius:58px;background:#0d1c18;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1.5px rgba(244,239,230,.12)}
</style></head><body><div class="aro"></div></body></html>`;

const legenda = (texto) => `<!doctype html><html><head>${FONTES}<style>
  html,body{margin:0;background:transparent}
  body{width:${W}px;height:${FAIXA_LEGENDA}px;display:flex;align-items:center;justify-content:center}
  div{max-width:940px;box-sizing:border-box;padding:24px 40px;border-radius:30px;background:#f4efe6;color:#1f3b34;text-align:center;
      font-family:'Fraunces',serif;font-weight:540;font-size:44px;line-height:1.18;box-shadow:0 10px 30px rgba(0,0,0,.25);border-bottom:6px solid #c8823a}
</style></head><body><div>${texto}</div></body></html>`;

// ---------- composição dos quadros ----------

let mascara, fundoBuf, legendaBuf = {};
let quadro = 0;
let legendaAtual = null, legendaAlfa = 0, legendaAlvo = null;
let ultimaTela = null, ultimoComposto = null, ultimaChave = '';

async function alfa(buf, a, w, h) {
  if (a >= 1) return buf;
  return sharp(buf).ensureAlpha().composite([{ input: { create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: a } } }, blend: 'dest-in' }]).png().toBuffer();
}

async function compor(tela) {
  const camadas = [{ input: tela, left: TELA_X, top: TELA_Y }];
  if (legendaAtual && legendaAlfa > 0) camadas.push({ input: await alfa(legendaBuf[legendaAtual], legendaAlfa, W, FAIXA_LEGENDA), left: 0, top: 0 });
  return sharp(fundoBuf).composite(camadas).jpeg({ quality: 93 }).toBuffer();
}

async function gravarQuadro(buf) {
  quadro++;
  await writeFile(path.join(QUADROS, `${String(quadro).padStart(5, '0')}.jpg`), buf);
}

// Avança a legenda um passo (fade de saída em 6 quadros, entrada em 8).
function passoLegenda() {
  if (legendaAlvo !== legendaAtual) {
    legendaAlfa = Math.max(0, legendaAlfa - 1 / 6);
    if (legendaAlfa === 0 || !legendaAtual) { legendaAtual = legendaAlvo; legendaAlfa = 0; }
  } else if (legendaAtual && legendaAlfa < 1) {
    legendaAlfa = Math.min(1, legendaAlfa + 1 / 8);
  }
}

async function telaDaPagina(page) {
  const png = await page.screenshot({ type: 'jpeg', quality: 95 });
  return sharp(png).resize(TELA_W, TELA_H, { fit: 'fill', kernel: 'lanczos3' }).composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
}

// Captura a página e grava n quadros (só recompõe quando a tela ou a legenda mudam).
async function capturar(page, n = 1, { novaTela = true } = {}) {
  let mudou = novaTela || !ultimaTela;
  if (mudou) ultimaTela = await telaDaPagina(page);
  for (let i = 0; i < n; i++) {
    passoLegenda();
    const chave = `${legendaAtual}|${legendaAlfa}`;
    if (mudou || chave !== ultimaChave || !ultimoComposto) {
      ultimoComposto = await compor(ultimaTela);
      ultimaChave = chave;
      mudou = false;
    }
    await gravarQuadro(ultimoComposto);
  }
}

const pausa = (page, s) => capturar(page, seg(s), { novaTela: false });

async function cartaoQuadros(buf, s) { for (let i = 0; i < seg(s); i++) await gravarQuadro(buf); }

async function transicao(deBuf, paraBuf, n = 12) {
  for (let i = 1; i <= n; i++) {
    const t = suave(i / n);
    const topo = await sharp(paraBuf).ensureAlpha(t).png().toBuffer();
    await gravarQuadro(await sharp(deBuf).composite([{ input: topo }]).jpeg({ quality: 93 }).toBuffer());
  }
}

// ---------- ações dentro da página ----------

async function prepararPagina(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    const s = document.createElement('style');
    s.textContent = `#__toque{position:fixed;left:0;top:0;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;
      background:rgba(200,130,58,.42);border:4px solid #c8823a;box-shadow:0 0 0 5px rgba(31,59,52,.35);
      pointer-events:none;z-index:99999;opacity:0}
      .__destaque{box-shadow:0 0 0 var(--anel,0px) rgba(227,168,105,.55)!important}
      #__msg{position:fixed;left:12px;right:12px;bottom:92px;z-index:9999;background:#efe7da;border-radius:20px;padding:16px;
      box-shadow:0 18px 50px rgba(0,0,0,.35);font-family:'Instrument Sans',sans-serif;color:#1a1d1c}
      #__msg header{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;margin-bottom:12px;color:#1f3b34}
      #__msg header span{width:34px;height:34px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center}
      #__msg header svg{width:20px;height:20px;fill:#fff}
      #__msg .bolha{background:#d9fdd3;border-radius:14px 14px 4px 14px;padding:12px 14px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
      #__msg .bolha small{display:block;text-align:right;color:#5b6b63;font-size:12px;margin-top:4px}`;
    document.head.appendChild(s);
    const t = document.createElement('div'); t.id = '__toque'; document.body.appendChild(t);
  });
}

async function rolarAte(page, y, s) {
  const y0 = await page.evaluate(() => window.scrollY);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const alvo = Math.max(0, Math.min(max, Math.round(y)));
  const n = Math.max(1, seg(s));
  for (let i = 1; i <= n; i++) {
    await page.evaluate((v) => window.scrollTo(0, v), Math.round(y0 + (alvo - y0) * suave(i / n)));
    await capturar(page, 1);
  }
}

const topoDe = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, sel);
const centroDe = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);

async function toque(page, x, y, escala, opacidade) {
  await page.evaluate(([x, y, e, o]) => {
    const t = document.getElementById('__toque');
    t.style.transform = `translate(${x}px, ${y}px) scale(${e})`;
    t.style.opacity = o;
  }, [x, y, escala, opacidade]);
}

// Círculo de toque: aparece, executa a ação no meio e some (16 quadros).
async function tocar(page, sel, acao) {
  const { x, y } = await centroDe(page, sel);
  for (let i = 0; i < 16; i++) {
    if (i === 7 && acao) await acao();
    const e = i < 7 ? 0.55 + (0.45 * i) / 6 : 1 + (0.5 * (i - 6)) / 9;
    const o = i < 7 ? i / 6 : 1 - (i - 6) / 9;
    await toque(page, x, y, e, o);
    await capturar(page, 1);
  }
  await toque(page, x, y, 1, 0);
}

// Arrasta um controle deslizante até o valor final, com o círculo de toque seguindo o botão.
async function arrastar(page, sel, ate, s) {
  const pos = () => page.evaluate((q) => {
    const r = document.querySelector(q); const b = r.getBoundingClientRect();
    const p = (r.value - r.min) / (r.max - r.min);
    return { x: b.left + 14 + p * (b.width - 28), y: b.top + b.height / 2, v: Number(r.value) };
  }, sel);
  let { x, y, v: de } = await pos();
  for (let i = 0; i < 6; i++) { await toque(page, x, y, 0.6 + 0.08 * i, i / 5); await capturar(page, 1); }
  const n = seg(s);
  for (let i = 1; i <= n; i++) {
    const v = Math.round(de + (ate - de) * suave(i / n));
    await page.evaluate(([q, v]) => { const r = document.querySelector(q); if (Number(r.value) !== v) { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); } }, [sel, v]);
    ({ x, y } = await pos());
    await toque(page, x, y, 1, 1);
    await capturar(page, 1);
  }
  for (let i = 1; i <= 8; i++) { await toque(page, x, y, 1 + i * 0.06, 1 - i / 8); await capturar(page, 1); }
}

async function deslizarGaleria(page, para, s) {
  const { x0, w, y } = await page.evaluate(() => {
    const t = document.querySelector('.galeria__trilho'); t.style.scrollSnapType = 'none';
    const b = t.getBoundingClientRect();
    return { x0: t.scrollLeft, w: t.clientWidth, y: b.top + b.height * 0.55 };
  });
  const n = seg(s);
  for (let i = 0; i <= n; i++) {
    const t = suave(i / n);
    await page.evaluate((v) => { const tr = document.querySelector('.galeria__trilho'); tr.scrollLeft = v; tr.dispatchEvent(new Event('scroll')); }, x0 + (para * w - x0) * t);
    const o = i < 4 ? i / 3 : i > n - 4 ? Math.max(0, (n - i) / 3) : 1;
    await toque(page, 300 - 200 * t, y, 1, o);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await capturar(page, 1);
  }
  await toque(page, 0, 0, 1, 0);
}

// ---------- roteiro ----------

const inicio = Date.now();
await rm(QUADROS, { recursive: true, force: true });
await mkdir(QUADROS, { recursive: true });
await mkdir(AMOSTRAS, { recursive: true });

execFileSync('node', [path.join(RAIZ, 'build.mjs')], { stdio: 'inherit' });
const server = await servir(PORTA);
const browser = await chromium.launch();

fundoBuf = await renderHtml(browser, fundo());
for (const [k, t] of Object.entries(LEGENDAS)) legendaBuf[k] = await renderHtml(browser, legenda(t), { altura: FAIXA_LEGENDA, transparente: true });
const cartaoAbre = await sharp(await renderHtml(browser, cartao('Seu site, Anderson', 'Anderson Zanelatto · Corretor de imóveis'))).jpeg({ quality: 93 }).toBuffer();
const cartaoFecha = await sharp(await renderHtml(browser, cartao('Tudo pode ser ajustado do seu jeito', 'Seus imóveis, suas fotos, seus textos'))).jpeg({ quality: 93 }).toBuffer();
mascara = Buffer.from(`<svg width="${TELA_W}" height="${TELA_H}"><rect width="${TELA_W}" height="${TELA_H}" rx="48" ry="48" fill="#fff"/></svg>`);

const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'pt-BR' });
await ctx.addInitScript(() => { window.open = () => ({}); });
const page = await ctx.newPage();

// 1. cartão de abertura
await cartaoQuadros(cartaoAbre, 2.6);

// 2. a página abrindo no topo
await page.goto(URL_BASE + '/', { waitUntil: 'networkidle' });
await prepararPagina(page);
ultimaTela = await telaDaPagina(page);
await transicao(cartaoAbre, await compor(ultimaTela), 14);
legendaAlvo = 'abrir';
await pausa(page, 3.2);

// 3. busca por tipo, bairro e valor
legendaAlvo = 'busca';
await rolarAte(page, (await topoDe(page, '#busca-titulo')) - 120, 1.6);
await pausa(page, 0.8);
await tocar(page, '#f-tipo', () => page.selectOption('#f-tipo', 'Casa em condomínio'));
await pausa(page, 0.7);
await tocar(page, '#f-bairro', () => page.selectOption('#f-bairro', 'Quinta dos Guimarães'));
await pausa(page, 0.7);
await tocar(page, '#f-valor', () => page.selectOption('#f-valor', '2500000-'));
await pausa(page, 0.8);
await tocar(page, '.busca__botao');
await rolarAte(page, (await topoDe(page, '#imoveis')) - 8, 1.6);
await pausa(page, 2.2);

// 4. página do imóvel com galeria
await tocar(page, '[data-lista] .card:not([hidden]) .card__link');
const antes = await compor(ultimaTela);
await page.goto(URL_BASE + IMOVEL, { waitUntil: 'networkidle' });
await prepararPagina(page);
legendaAlvo = 'pagina';
ultimaTela = await telaDaPagina(page);
await transicao(antes, await compor(ultimaTela), 10);
await pausa(page, 1.4);
await deslizarGaleria(page, 1, 0.8);
await pausa(page, 0.9);
await deslizarGaleria(page, 2, 0.8);
await pausa(page, 0.9);
await deslizarGaleria(page, 3, 0.8);
await pausa(page, 0.8);
await rolarAte(page, (await topoDe(page, '.imovel__info')) - 70, 1.6);
await pausa(page, 2.2);

// 5. simulador já preenchido, controles se movendo devagar
legendaAlvo = 'simula';
await rolarAte(page, (await topoDe(page, '#sim-valor')) - 120, 1.8);
await pausa(page, 1.6);
await arrastar(page, '#sim-entrada', 30, 2.2);
await pausa(page, 0.6);
await arrastar(page, '#sim-prazo', 25, 1.8);
await pausa(page, 1.6);

// 6. botão de enviar em destaque e a mensagem que seria enviada
legendaAlvo = 'contato';
const yBotao = await page.evaluate(() => { const b = document.querySelector('[data-sim-enviar]').getBoundingClientRect(); return b.top + window.scrollY; });
await rolarAte(page, yBotao - 300, 1.3);
await page.evaluate(() => document.querySelector('[data-sim-enviar]').classList.add('__destaque'));
for (let i = 0; i < seg(1.0); i++) {
  await page.evaluate((a) => document.querySelector('[data-sim-enviar]').style.setProperty('--anel', `${a}px`), Math.round(8 * Math.abs(Math.sin((i / seg(1.0)) * Math.PI * 2))));
  await capturar(page, 1);
}
await tocar(page, '[data-sim-enviar]');
await page.evaluate(() => {
  const sim = document.querySelector('[data-sim]');
  const texto = sim.mensagem().replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n(https?:\S+)$/, '');
  const box = document.createElement('div'); box.id = '__msg';
  box.innerHTML = `<header><span><svg viewBox="0 0 24 24"><use href="#i-whats"/></svg></span>Mensagem que chega no WhatsApp do Anderson</header><div class="bolha">${texto}<small>agora</small></div>`;
  box.style.transform = 'translateY(140%)';
  document.body.appendChild(box);
});
for (let i = 1; i <= 14; i++) { await page.evaluate((p) => { document.getElementById('__msg').style.transform = `translateY(${p}%)`; }, Math.round(140 * (1 - suave(i / 14)))); await capturar(page, 1); }
await pausa(page, 4.2);
for (let i = 1; i <= 10; i++) { await page.evaluate((p) => { document.getElementById('__msg').style.transform = `translateY(${p}%)`; }, Math.round(140 * suave(i / 10))); await capturar(page, 1); }
await page.evaluate(() => { document.getElementById('__msg').remove(); document.querySelector('[data-sim-enviar]').classList.remove('__destaque'); });

// 7. nota 5,0 e depoimentos
legendaAlvo = 'reputacao';
await rolarAte(page, (await topoDe(page, '#reputacao')) - 60, 1.8);
await pausa(page, 2.6);
await rolarAte(page, (await topoDe(page, '.depoimentos li:nth-child(2)')) - 260, 1.4);
await pausa(page, 1.8);

// 8. cartão de encerramento
legendaAlvo = null;
await capturar(page, 8, { novaTela: false });
await transicao(ultimoComposto, cartaoFecha, 14);
await cartaoQuadros(cartaoFecha, 3);

await browser.close();
server.close();

// ---------- vídeo ----------

console.log(`${quadro} quadros (${(quadro / FPS).toFixed(1)} s). Codificando...`);
execFileSync(ffmpeg, [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(QUADROS, '%05d.jpg'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '1900k', '-bufsize', '3800k',
  '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-movflags', '+faststart', '-an', SAIDA,
], { stdio: 'inherit' });

const dur = quadro / FPS;
for (let i = 0; i < 6; i++) {
  const t = (dur * (0.06 + i * 0.172)).toFixed(2);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', t, '-i', SAIDA, '-frames:v', '1', path.join(AMOSTRAS, `amostra-${i + 1}.png`)]);
}
if (!process.argv.includes('--manter-quadros')) await rm(QUADROS, { recursive: true, force: true });

const mb = (await stat(SAIDA)).size / 1024 / 1024;
console.log(`Pronto: ${path.basename(SAIDA)}, ${dur.toFixed(1)} s, ${mb.toFixed(1)} MB, em ${((Date.now() - inicio) / 1000).toFixed(0)} s. Amostras em demo-amostras/.`);
