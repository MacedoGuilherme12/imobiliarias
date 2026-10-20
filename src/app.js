// Anderson Zanelatto: interações do site (filtros, simulador, galeria, contato)
(() => {
  'use strict';

  const WHATSAPP = '5548991731156';
  const abrirWhatsApp = (msg) => {
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
    const janela = window.open(url, '_blank', 'noopener');
    if (!janela) window.location.href = url;
  };

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const moedaCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numero = (s) => Number(String(s).replace(/\D/g, '')) || 0;

  // ---------- busca e regiões ----------

  const form = document.querySelector('[data-busca]');
  if (form) {
    const cards = [...document.querySelectorAll('[data-lista] .card')];
    const conta = document.querySelector('[data-conta]');
    const vazio = document.querySelector('[data-vazio]');
    const limpar = document.querySelectorAll('[data-limpar]');
    const regioes = [...document.querySelectorAll('[data-regiao-bairro]')];
    const lista = document.getElementById('imoveis');

    const aplicar = () => {
      const tipo = form.tipo.value;
      const bairro = form.bairro.value;
      const [min, max] = form.valor.value ? form.valor.value.split('-').map((v) => (v === '' ? Infinity : Number(v))) : [0, Infinity];
      let visiveis = 0;
      for (const c of cards) {
        const v = Number(c.dataset.valor);
        const ok = (!tipo || c.dataset.tipo === tipo) && (!bairro || c.dataset.bairro === bairro) && v >= min && v <= max;
        c.hidden = !ok;
        if (ok) visiveis++;
      }
      conta.textContent = `${visiveis} ${visiveis === 1 ? 'imóvel' : 'imóveis'}`;
      vazio.hidden = visiveis > 0;
      const filtrando = Boolean(tipo || bairro || form.valor.value);
      limpar.forEach((b) => { if (!vazio.contains(b)) b.hidden = !filtrando; });
      for (const r of regioes) {
        r.setAttribute('aria-pressed', String(r.dataset.regiaoBairro === bairro && r.dataset.regiaoTipo === tipo && filtrando && (bairro || tipo) !== ''));
      }
    };

    form.addEventListener('change', aplicar);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      aplicar();
      lista.scrollIntoView({ block: 'start' });
    });
    regioes.forEach((r) => r.addEventListener('click', () => {
      const ativa = r.getAttribute('aria-pressed') === 'true';
      form.tipo.value = ativa ? '' : r.dataset.regiaoTipo;
      form.bairro.value = ativa ? '' : r.dataset.regiaoBairro;
      form.valor.value = '';
      aplicar();
      if (!ativa) lista.scrollIntoView({ block: 'start' });
    }));
    limpar.forEach((b) => b.addEventListener('click', () => { form.reset(); aplicar(); }));
    aplicar();
  }

  // ---------- simulador ----------

  function calcular({ valor, entradaPct, anos, jurosAno }) {
    const financiado = Math.max(0, valor * (1 - entradaPct / 100));
    const n = anos * 12;
    const i = Math.pow(1 + jurosAno / 100, 1 / 12) - 1;
    const amortizacao = financiado / n;
    const sac1 = amortizacao + financiado * i;
    const sacN = amortizacao * (1 + i);
    const price = i === 0 ? financiado / n : (financiado * i) / (1 - Math.pow(1 + i, -n));
    return { financiado, entrada: valor - financiado, n, sac1, sacN, price, renda: sac1 / 0.3 };
  }

  document.querySelectorAll('[data-sim]').forEach((sim) => {
    const el = (s) => sim.querySelector(s);
    const campoValor = el('[data-sim-valor]');
    const entrada = el('[data-sim-entrada]');
    const prazo = el('[data-sim-prazo]');
    const juros = el('[data-sim-juros]');
    const out = (k) => el(`[data-sim-out="${k}"]`);
    const r = (k) => el(`[data-sim-r="${k}"]`);
    const aviso = el('[data-sim-aviso]');
    let ultimo = null;

    const pintar = (range) => {
      const p = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--p', `${p}%`);
    };

    const atualizar = () => {
      const dados = { valor: numero(campoValor.value), entradaPct: Number(entrada.value), anos: Number(prazo.value), jurosAno: Number(juros.value) };
      const c = calcular(dados);
      out('entrada').textContent = `${dados.entradaPct}% (${moeda.format(c.entrada)})`;
      out('prazo').textContent = `${dados.anos} anos (${c.n} parcelas)`;
      out('juros').textContent = `${dados.jurosAno.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ao ano`;
      r('sac1').textContent = moedaCentavos.format(c.sac1);
      r('price').textContent = moedaCentavos.format(c.price);
      r('financiado').textContent = moeda.format(c.financiado);
      r('renda').textContent = moeda.format(c.renda);
      r('sacN').textContent = moedaCentavos.format(c.sacN);
      aviso.hidden = dados.entradaPct >= 20;
      [entrada, prazo, juros].forEach(pintar);
      ultimo = { ...dados, ...c };
    };

    campoValor.addEventListener('input', () => {
      const v = numero(campoValor.value);
      campoValor.value = v ? moeda.format(v) : '';
      atualizar();
    });
    [entrada, prazo, juros].forEach((x) => x.addEventListener('input', atualizar));

    sim.mensagem = () => {
      const u = ultimo;
      const linhas = ['Olá, Anderson! Fiz uma simulação no seu site.', ''];
      if (sim.dataset.imovel) linhas.push(`Imóvel: ${sim.dataset.imovel}`);
      linhas.push(
        `Valor: ${moeda.format(u.valor)}`,
        `Entrada: ${u.entradaPct}% (${moeda.format(u.entrada)})`,
        `Prazo: ${u.anos} anos, juros de ${u.jurosAno.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}% ao ano`,
        `*1ª parcela (SAC): ${moedaCentavos.format(u.sac1)}*`,
        `Parcela fixa (Price): ${moedaCentavos.format(u.price)}`,
        `Renda mínima: ${moeda.format(u.renda)}`,
        '',
        'Pode me ajudar com o financiamento?'
      );
      if (sim.dataset.link) linhas.push(sim.dataset.link);
      return linhas.join('\n');
    };

    el('[data-sim-enviar]').addEventListener('click', () => {
      if (!numero(campoValor.value)) { campoValor.focus(); return; }
      abrirWhatsApp(sim.mensagem());
    });
    atualizar();
  });

  // ---------- galeria ----------

  document.querySelectorAll('[data-galeria]').forEach((g) => {
    const trilho = g.querySelector('.galeria__trilho');
    const slides = trilho.children;
    const contador = g.querySelector('[data-contador]');
    const ant = g.querySelector('[data-anterior]');
    const prox = g.querySelector('[data-proximo]');
    if (!contador) return;
    const atual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);
    const ir = (i) => trilho.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, i)) * trilho.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const marcar = () => {
      const i = atual();
      contador.textContent = `${i + 1} de ${slides.length}`;
      ant.disabled = i === 0;
      prox.disabled = i === slides.length - 1;
    };
    ant.addEventListener('click', () => ir(atual() - 1));
    prox.addEventListener('click', () => ir(atual() + 1));
    trilho.addEventListener('scroll', () => requestAnimationFrame(marcar), { passive: true });
    trilho.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(atual() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(atual() - 1); }
    });
    marcar();
  });

  // ---------- contato ----------

  const contato = document.querySelector('[data-contato]');
  if (contato) {
    const erro = (campo, texto) => {
      const box = campo.closest('.campo');
      const p = box.querySelector('.campo__erro');
      box.classList.toggle('campo--erro', Boolean(texto));
      campo.setAttribute('aria-invalid', texto ? 'true' : 'false');
      p.textContent = texto || '';
      p.hidden = !texto;
      return !texto;
    };
    const validarNome = () => erro(contato.nome, contato.nome.value.trim().length < 2 ? 'Escreva seu nome para eu saber com quem estou falando.' : '');
    const validarTel = () => {
      const d = contato.telefone.value.replace(/\D/g, '');
      return erro(contato.telefone, d.length < 10 || d.length > 13 ? 'Informe um telefone com DDD, por exemplo (48) 99999-0000.' : '');
    };
    contato.nome.addEventListener('blur', () => contato.nome.value && validarNome());
    contato.telefone.addEventListener('blur', () => contato.telefone.value && validarTel());
    contato.nome.addEventListener('input', () => contato.nome.closest('.campo--erro') && validarNome());
    contato.telefone.addEventListener('input', () => contato.telefone.closest('.campo--erro') && validarTel());

    contato.addEventListener('submit', (e) => {
      e.preventDefault();
      const okNome = validarNome();
      const okTel = validarTel();
      if (!okNome) { contato.nome.focus(); return; }
      if (!okTel) { contato.telefone.focus(); return; }
      const msg = [
        `Olá, Anderson! Meu nome é ${contato.nome.value.trim()}.`,
        `Quero: ${contato.interesse.value.toLowerCase()}.`,
        contato.mensagem.value.trim() && `Mensagem: ${contato.mensagem.value.trim()}`,
        `Meu WhatsApp: ${contato.telefone.value.trim()}`,
      ].filter(Boolean).join('\n');
      abrirWhatsApp(msg);
    });
  }
})();
