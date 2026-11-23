'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const headings = {capa: 'home-title', catalogo: 'page-title', editoras: 'directory-title', roteiro: 'visit-title'};
  const homeSections = {'como-usar': 'flow-title', 'como-chegar': 'arrival-title', perguntas: 'faq-title', feedback: 'feedback-title'};
  const menuToggle = byId('menu-toggle');
  const loading = byId('data-loading');
  const retry = byId('retry-catalog');
  let navigation = 0;
  let dataPromise;
  let appPromise;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('Falha ao carregar ' + src));
      };
      document.head.append(script);
    });
  }

  function loadCatalog() {
    dataPromise ??= loadScript('dados/catalogo.js').catch(error => {
      dataPromise = undefined;
      throw error;
    });
    appPromise ??= dataPromise.then(() => loadScript('assets/app.js')).catch(error => {
      appPromise = undefined;
      throw error;
    });
    return appPromise;
  }

  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  function focusHeading(id) {
    const heading = byId(id);
    heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll:true});
  }

  function showView(active) {
    for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.id !== active;
    document.querySelector('.skip').href = active === 'catalogo' ? '#query' :
      '#' + (headings[active] ?? 'data-loading-status');
  }

  async function showPage(moveFocus) {
    const currentNavigation = ++navigation;
    setMenu(false);
    const hash = location.hash.slice(1).split('?')[0];
    const active = Object.hasOwn(headings, hash) ? hash : hash === 'query' ? 'catalogo' : 'capa';
    for (const link of document.querySelectorAll('[data-page]')) {
      if (link.dataset.page === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    window.roteiroAnalytics?.page(active);

    if (active !== 'capa' && !window.roteiroCatalog) {
      showView('');
      loading.hidden = false;
      retry.hidden = true;
      byId('data-loading-status').textContent = 'Carregando catálogo…';
      window.scrollTo(0, 0);
      try {
        await loadCatalog();
        if (!window.roteiroCatalog) throw new Error('Catálogo indisponível');
      } catch {
        if (currentNavigation !== navigation) return;
        byId('data-loading-status').textContent = 'Não foi possível carregar o catálogo.';
        retry.hidden = false;
        return;
      }
      if (currentNavigation !== navigation) return;
    }

    loading.hidden = true;
    showView(active);
    if (active !== 'capa') window.roteiroCatalog.open(active);
    if (Object.hasOwn(homeSections, hash)) {
      const section = byId(hash);
      if (section.tagName === 'DETAILS') section.open = true;
      if (moveFocus) focusHeading(homeSections[hash]);
      section.scrollIntoView();
    } else if (moveFocus && Object.hasOwn(headings, hash)) {
      focusHeading(headings[active]);
      window.scrollTo(0, 0);
    }
  }

  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  byId('main-menu').addEventListener('click', event => {
    const link = event.target.closest('a[data-page]');
    if (!link || menuToggle.getAttribute('aria-expanded') !== 'true') return;
    setMenu(false);
    if (location.hash === link.hash) menuToggle.focus();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
    setMenu(false);
    menuToggle.focus();
  });
  matchMedia('(max-width: 720px)').addEventListener('change', () => setMenu(false));
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    const target = byId(event.currentTarget.hash.slice(1));
    if (target.tagName !== 'INPUT') target.setAttribute('tabindex', '-1');
    target.focus();
  });
  retry.addEventListener('click', () => showPage(true));
  window.addEventListener('hashchange', () => showPage(true));
  showPage(false);
})();
