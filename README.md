# Site do Anderson Zanelatto (rascunho)

Site estático gerado por `build.mjs` (Node, sem framework) a partir de `data/imoveis.json` e das fotos em `fotos/`.

## Comandos
- `npm install` e depois `npm run build`: gera `dist/` (home, uma página por imóvel em `/imovel/<slug>/`, fotos WebP até 1600px, imagens de prévia em `og/`).
- `npm run serve`: abre `dist/` em http://localhost:4173.
- `npm run check:mobile`: confere em 375px e 412px (isMobile) que nenhuma página fica mais larga que a tela.
- `npm run demo`: grava `demo-anderson.mp4` de novo (1080x1920, H.264) e salva 6 quadros em `demo-amostras/`.

## Antes de publicar
1. Troque `BASE_URL` em `site.config.mjs` pelo domínio final (canonical e og:image saem dela).
2. Quando aprovado, mude `INDEXAR` para `true` para liberar os buscadores.
3. Na Vercel, importe esta pasta como projeto: `vercel.json` já define o build (`npm run build`) e a saída (`dist`).

## Trocar imóveis
Edite `data/imoveis.json` (título, tipo, bairro, cidade, quartos, suítes, banheiros, vagas, área em m², valor, selo, descrição, fotos) e coloque as fotos em `fotos/`. Foto que faltar vira um espaço marcado.
