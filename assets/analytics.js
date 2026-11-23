'use strict';

(() => {
  const id = document.querySelector('meta[name="ga4-measurement-id"]')?.content.trim();
  if (!/^G-[A-Z0-9]+$/.test(id ?? '') || !/^https?:$/.test(location.protocol)) return;

  const labels = {
    capa: 'Início',
    catalogo: 'Catálogo',
    editoras: 'Editoras',
    roteiro: 'Meu roteiro'
  };
  const preferenceKey = 'festa-usp-2026-analytics';
  const notice = document.getElementById('analytics-notice');
  const preferences = document.getElementById('analytics-preferences');
  const launcher = document.getElementById('analytics-launcher');
  let preference = '';
  let activePage = 'capa';
  let lastLocation = '';
  let tagLoaded = false;
  let openedFrom;
  try { preference = localStorage.getItem(preferenceKey) ?? ''; } catch {}

  function sanitizedUrl(value) {
    if (!value) return '';
    const url = new URL(value);
    return url.origin + url.pathname;
  }

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function trackPage() {
    if (preference !== 'allowed') return;
    const pageLocation = sanitizedUrl(location.href) + '#' + activePage;
    if (lastLocation === pageLocation) return;
    if (!tagLoaded) {
      window.dataLayer = window.dataLayer || [];
      gtag('js', new Date());
      gtag('config', id, {send_page_view: false, page_location: pageLocation});
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.append(tag);
      tagLoaded = true;
    } else {
      gtag('config', id, {update: true, page_location: pageLocation});
    }
    gtag('event', 'page_view', {
      send_to: id,
      page_title: labels[activePage] + ' | Faça seu roteiro',
      page_location: pageLocation,
      page_referrer: lastLocation || sanitizedUrl(document.referrer)
    });
    lastLocation = pageLocation;
  }

  function setPreference(value) {
    preference = value;
    try { localStorage.setItem(preferenceKey, value); } catch {}
    window['ga-disable-' + id] = value !== 'allowed';
    notice.hidden = true;
    launcher.hidden = true;
    preferences.hidden = false;
    if (value === 'allowed') trackPage();
    else lastLocation = '';
    if (openedFrom === preferences) preferences.focus();
    else document.querySelector('.brand').focus({preventScroll:true});
    openedFrom?.setAttribute('aria-expanded', 'false');
    openedFrom = undefined;
  }

  window.roteiroAnalytics = {
    page(page) {
      if (!Object.hasOwn(labels, page)) return;
      activePage = page;
      trackPage();
    }
  };
  const decided = preference === 'allowed' || preference === 'declined';
  launcher.hidden = decided;
  preferences.hidden = !decided;
  function openNotice(event) {
    openedFrom = event.currentTarget;
    openedFrom.setAttribute('aria-expanded', 'true');
    launcher.hidden = true;
    notice.hidden = false;
    document.getElementById('analytics-title').focus();
  }
  launcher.addEventListener('click', openNotice);
  preferences.addEventListener('click', openNotice);
  document.getElementById('analytics-decline').addEventListener('click', () => setPreference('declined'));
  document.getElementById('analytics-accept').addEventListener('click', () => setPreference('allowed'));
})();
