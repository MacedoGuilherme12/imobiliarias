// Verifica que nenhuma página fica mais larga que a tela no celular
// (375px e 412px, isMobile ativado): scrollWidth precisa ser igual à largura.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { servir } from './serve.mjs';

const imoveis = JSON.parse(await readFile(new URL('../data/imoveis.json', import.meta.url), 'utf8'));
const rotas = ['/', ...imoveis.map((i) => `/imovel/${i.slug}/`), '/rota-que-nao-existe/'];
const PORTA = 4174;
const server = await servir(PORTA);
const browser = await chromium.launch();
let falhas = 0;

for (const largura of [375, 412]) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const rota of rotas) {
    await page.goto(`http://localhost:${PORTA}${rota}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // mede durante a animação de entrada e depois dela, e fica com o pior caso
    const medir = () => page.evaluate(() => {
      const w = window.innerWidth;
      const largos = [...document.querySelectorAll('body *')]
        .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > w + 0.5 && !el.closest('.galeria__trilho, .abertura__base'); })
        .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      return { scrollWidth: document.documentElement.scrollWidth, largura: w, largos };
    });
    const r1 = await medir();
    await page.waitForTimeout(1600);
    const r2 = await medir();
    const r = r1.scrollWidth > r2.scrollWidth ? r1 : r2;
    const ok = r.scrollWidth === r.largura && r.largura === largura;
    if (!ok) falhas++;
    console.log(`${ok ? 'ok  ' : 'ERRO'} ${largura}px  scrollWidth=${r.scrollWidth}  ${rota}${r.largos.length ? '  passando: ' + r.largos.join(', ') : ''}`);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(falhas ? `\n${falhas} página(s) mais largas que a tela.` : '\nTodas as páginas cabem na tela em 375px e 412px.');
process.exit(falhas ? 1 : 0);
