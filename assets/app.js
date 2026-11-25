'use strict';
const byId = id => document.getElementById(id);
const fields = Object.fromEntries(['query','theme','subtheme','publisher','format','price','sort'].map(id => [id, byId(id)]));
const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const splitTags = text => text ? text.split(' | ') : [];
const number = text => text ? Number(text.replace(',', '.')) : null;
const alphabet = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integer = new Intl.NumberFormat('pt-BR');
const books = catalogRows.map(row => {
  const [title, author, publisher, isbn, subject, price, discount, link, main, themes, subthemes, formats, origin, coverPrice] = row;
  return { title, author, publisher, isbn, subject, price: number(price), discount: number(discount), link, coverPrice,
    facets: { publisher: publisher ? [publisher] : [], theme: themes ? splitTags(themes) : [main], subtheme: splitTags(subthemes), format: splitTags(formats) }, origin,
    search: normalize([title, author, publisher, isbn, subject, themes, subthemes, formats].join(' ')) };
}).sort((a,b) => alphabet.compare(a.title,b.title));
const unclassified = books.filter(book => book.facets.theme.includes('A classificar')).length;
byId('filter-note').textContent = integer.format(unclassified) +
  ' livros ainda estão em “A classificar” e podem ser encontrados pela busca de texto.';
const size = 24;
let page = 0;
let filtered = books;
const visitKey = 'festa-usp-2026-favoritos';
const amazonKey = 'festa-usp-2026-precos-amazon';
const bookKey = book => JSON.stringify([book.publisher, book.isbn, book.title, book.author]);
let visitStorage = true;
function readVisit() {
  try {
    const value = JSON.parse(localStorage.getItem(visitKey) ?? '[]');
    return new Map(Array.isArray(value) ? value.filter(entry =>
      Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'boolean') : []);
  } catch {
    visitStorage = false;
    return new Map();
  }
}
const favorites = readVisit();
const amazonPrices = new Map();
const validAmazonPrice = value => Number.isSafeInteger(value) && value > 0;
try {
  const stored = JSON.parse(localStorage.getItem(amazonKey) ?? '[]');
  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' &&
          validAmazonPrice(entry[1])) amazonPrices.set(entry[0], entry[1]);
    }
  }
} catch {}
const bookIndex = new Map(books.map(book => [bookKey(book), book]));
const editionKey = (publisher, isbn, title) => JSON.stringify([normalize(publisher), isbn, normalize(title)]);
const editionIndex = new Map();
for (const book of books) {
  if (!isbnFrom(book.isbn)) continue;
  const key = editionKey(book.publisher, book.isbn, book.title);
  editionIndex.set(key, editionIndex.has(key) ? null : bookKey(book));
}
function currentBookKey(key) {
  if (bookIndex.has(key)) return key;
  try {
    const [publisher, isbn, title] = JSON.parse(key);
    if ([publisher, isbn, title].every(value => typeof value === 'string')) {
      return editionIndex.get(editionKey(publisher, isbn, title)) ?? null;
    }
  } catch {}
  return null;
}
for (const [key, checked] of favorites) {
  const current = currentBookKey(key);
  if (!current || current === key) continue;
  favorites.set(current, Boolean(favorites.get(current) || checked));
  favorites.delete(key);
}
for (const [key, value] of amazonPrices) {
  const current = currentBookKey(key);
  if (!current || current === key) continue;
  if (!amazonPrices.has(current)) amazonPrices.set(current, value);
  amazonPrices.delete(key);
}
const islandNames = {
  1:'Edusp',2:'34 Editora',3:'Ed. Unesp',4:'Aller;Com-Arte;Ed. UnB;Ed. UFSC;Casa Marx | Iskra;Maria Antonia Edições - GMARX;Publicações BBM;Revista IEA',
  5:'Ateliê;Ateliê Editorial',6:'Ed. da Unicamp',7:'Ed. UFABC;Ed. UFPR;Ed. UFV;Ed. Mackenzie;Eduefs;Eduel;Eduem;EdUFSCar;EDUNILA;Uneb;Pontes',8:'Perspectiva',9:'Ed. Unifesp;Ercolano;Fiocruz;GLAC;Quina;Sisko;Sobinfluencia;Temporal;Zagodoni;Zain',
  10:'Ed. UFMG',11:'Record (Grupo)',12:'Contexto;Hucitec;Moinhos;Seja Breve;Via Lettera',13:'Boitempo',15:'baião;Biruta;Casa de Letras;Pulo do Gato;Quatro Cantos;Solisluna',16:'Carochinha;Jujuba',17:'Girassol (Grupo);Paulinas',
  18:'Boitatá;Caxinguelê;Livros da Matriz;Mil Caramiolas;Mostarda;Viajante do Tempo',19:'Aletria;Bamboozinho;Miolo Mole',20:'Melhoramentos;Telos',
  21:'Catapulta;Ciranda Cultural (Grupo);Joaquina',22:'Caixote;Duna Dueto;ÔZé;Panda Books',23:'Autores Associados;Cortez',24:'Cintra;Movimento Neomarginal;Parábola;Pedrazul (Grupo);Peirópolis',
  25:'Malê',26:'L&PM',27:'Taschen',28:'Anita Garibaldi;Contraponto;Escala;Mnema;Odysseus',29:'Seiva;Ubu',30:'Arquipélago;Bazar do Tempo;Carambaia;Fino Traço;Fósforo',
  31:'Estação Liberdade;Vozes',33:"Contracorrente;Cosac;Dublinense;Kotter;Letra Selvagem;Patuá;UK'A - Arte e Literatura;Valentina",
  34:'Globo Livros',35:'Ars et Vita;Arte & Letra;Kitembo;Lote 42;Matrix;Palas Athena;Phorte;Solaris',36:'HarperCollins Brasil',
  37:'DarkSide / Magnética',38:'Brasiliense;Martins Fontes - Selo Martins;Monolito;Paco;Sesc SP',39:'Blucher',40:'Planeta',41:'Diadorim;Pensamento (Grupo);Reformatório',
  42:'Elefante;Expressão Popular;Funilaria',43:'Global',44:'Iná;LVM;nVersos;Pinard',45:'Autêntica (Grupo)',46:'Nova Fronteira;Trama;Nova Fronteira | Trama;Pallas;Rocco',
  47:'Azuco;Hedra;N-1 edições;Olhares;Tabla',48:'todavia',49:'Alameda;Atheneu;DBA Literatura;Nós;Terra Virgem',50:'Antofágica;Balão;Hyperion Comics',
  51:'Edições Loyola;Nova Alexandria',52:'Autonomia Literária;Escuta;Grua;LavraPalavra;Relicário;Sundermann;Zapata',53:'Summus (Grupo);Tinta-da-China',54:'BEĨ;Buzz;Da Vinci;Universo dos Livros',55:'Conrad',
  56:'IMS;Instituto Tomie Ohtake',57:'Barbatana;Book One;DarkSide / Magnética;Instante;Manjuba;MASP;Mundaréu;Mundaréu | Manjuba;TantaTinta;TantaTinta | Carlini e Caniato',58:'NewPOP',60:'Aleph'
};
const publisherIslands = new Map();
for (const [island, names] of Object.entries(islandNames)) {
  for (const name of names.split(';')) {
    const key = normalize(name);
    publisherIslands.set(key, [...(publisherIslands.get(key) ?? []), Number(island)]);
  }
}
const zoneOf = island => island <= 13 ? 'Verde' : island <= 36 ? 'Rosa' : 'Marrom';
const publisherDirectory = new Map();
for (const [name, prices, site] of publisherRows) {
  publisherDirectory.set(normalize(name), {name, prices, site, titles: 0, catalogName: ''});
}
for (const book of books) {
  if (!book.publisher) continue;
  const key = normalize(book.publisher);
  if (!publisherDirectory.has(key)) {
    publisherDirectory.set(key, {name: book.publisher, prices: '', site: '', titles: 0, catalogName: ''});
  }
  const publisher = publisherDirectory.get(key);
  publisher.titles++;
  publisher.catalogName = book.publisher;
}
const directory = [...publisherDirectory.values()]
  .map(publisher => ({...publisher, islands: publisherIslands.get(normalize(publisher.name)) ?? []}))
  .sort((a,b) => alphabet.compare(a.name,b.name));
function saveVisit() {
  try {
    localStorage.setItem(visitKey, JSON.stringify([...favorites]));
    visitStorage = true;
  } catch {
    visitStorage = false;
  }
}
function saveAmazonPrices() {
  try {
    localStorage.setItem(amazonKey, JSON.stringify([...amazonPrices]));
    return true;
  } catch {
    return false;
  }
}
const facetLabels = {
  publisher: ['Todas as editoras', 'Sem editoras disponíveis'],
  theme: ['Todos os temas', 'Sem temas disponíveis'],
  subtheme: ['Todos os subtemas', 'Sem subtemas disponíveis'],
  format: ['Todos os formatos', 'Sem formatos disponíveis']
};
const facetIds = Object.keys(facetLabels);
function fillFacet(id, totals, current) {
  const select = fields[id];
  const [label, emptyLabel] = facetLabels[id];
  if (current && !totals.has(current)) totals.set(current, 0);
  const options = [...totals.keys()].sort(alphabet.compare).map(value =>
    new Option(value + ' (' + integer.format(totals.get(value)) + ')', value));
  select.replaceChildren(new Option(options.length ? label : emptyLabel,''), ...options);
  select.value = current;
  select.disabled = options.length === 0;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function officialLink(url, label) {
  if (!/^https?:\/\//i.test(url)) return;
  const link = element('a', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function islandLabel(island) {
  return 'Espaço ' + zoneOf(island) + ' · Ilha ' + String(island).padStart(2, '0');
}
function coverPriceInCents(text) {
  const value = text.replace(/^R\$\s*/, '').trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(value)) return null;
  return Number(value.replace(/[.,]/g, ''));
}
function renderPublishers() {
  const query = normalize(byId('publisher-query').value.trim());
  const zone = byId('publisher-zone').value;
  const visible = directory.filter(({name,islands}) => normalize(name).includes(query) &&
    (!zone || (zone === 'unknown' ? !islands.length : islands.some(island => zoneOf(island) === zone))));
  byId('publisher-count').textContent = visible.length === 0 ? 'Nenhuma editora encontrada.' :
    integer.format(visible.length) + (visible.length === 1 ? ' editora' : ' editoras');
  byId('publisher-list').replaceChildren(...visible.map(publisher => {
    const card = element('li', '', 'publisher-card');
    card.append(element('h2', publisher.name));
    card.append(element('p', publisher.islands.map(islandLabel).join(' ou ') || 'Ilha não identificada', 'meta'));
    card.append(element('p', publisher.titles ? integer.format(publisher.titles) + (publisher.titles === 1 ? ' livro na busca' : ' livros na busca') : 'Consulte a lista da editora para ver os títulos.', 'meta'));
    const actions = element('div', '', 'publisher-links');
    if (publisher.titles) {
      const catalog = element('button', 'Ver livros');
      catalog.setAttribute('aria-label', 'Ver livros de ' + publisher.name);
      catalog.onclick = () => {
        location.hash = catalogHash({publisher: publisher.catalogName});
      };
      actions.append(catalog);
    }
    for (const link of [officialLink(publisher.prices, 'Lista oficial'), officialLink(publisher.site, 'Site da editora')]) {
      if (link) actions.append(link);
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }));
}
function favoriteBooks() {
  return [...favorites.keys()].map(key => bookIndex.get(key)).filter(Boolean);
}
function renderMarketComparison(saved) {
  let fair = 0;
  let amazon = 0;
  let count = 0;
  for (const book of saved) {
    const amazonPrice = amazonPrices.get(bookKey(book));
    if (book.price === null || amazonPrice === undefined) continue;
    fair += Math.round(book.price * 100);
    amazon += amazonPrice;
    count++;
  }
  byId('market-totals').hidden = count === 0;
  if (!count) {
    byId('market-note').textContent = 'Informe abaixo o preço na Amazon para comparar os livros que têm preço de feira.';
    return;
  }
  byId('market-fair').textContent = currency.format(fair / 100);
  byId('market-amazon').textContent = currency.format(amazon / 100);
  const difference = amazon - fair;
  byId('market-difference').textContent = difference === 0 ? 'Mesmo valor' :
    currency.format(Math.abs(difference) / 100) + ' a menos ' + (difference > 0 ? 'na feira' : 'na Amazon');
  byId('market-note').textContent = count + ' de ' + saved.length + ' livros comparados. Preços da Amazon informados por você.';
}
function renderVisit() {
  const saved = favoriteBooks();
  const groups = new Map();
  for (const book of saved) {
    if (!groups.has(book.publisher)) groups.set(book.publisher, []);
    groups.get(book.publisher).push(book);
  }
  const stops = [...groups].map(([publisher, titles]) => ({
    publisher, titles, islands: publisherIslands.get(normalize(publisher)) ?? []
  })).sort((a,b) => (a.islands[0] ?? Infinity) - (b.islands[0] ?? Infinity) || alphabet.compare(a.publisher,b.publisher));
  let totalCents = 0;
  let priced = 0;
  let savingsCents = 0;
  let comparableFairCents = 0;
  let comparable = 0;
  for (const book of saved) {
    if (book.price === null) continue;
    const fairCents = Math.round(book.price * 100);
    totalCents += fairCents;
    priced++;
    const coverCents = coverPriceInCents(book.coverPrice);
    if (coverCents === null || coverCents < fairCents) continue;
    savingsCents += coverCents - fairCents;
    comparableFairCents += fairCents;
    comparable++;
  }
  const collected = saved.filter(book => favorites.get(bookKey(book))).length;
  const count = saved.length;
  byId('favorites-count').textContent = '(' + integer.format(count) + ')';
  byId('visit-plan').hidden = count === 0;
  byId('visit-import-help').hidden = count > 0;
  byId('visit-options').hidden = count === 0;
  byId('import-visit-empty').hidden = count > 0;
  let summary = count
    ? count + (count === 1 ? ' livro' : ' livros') + ' · ' + groups.size + (groups.size === 1 ? ' editora' : ' editoras')
    : 'Favorite livros para reunir os títulos de cada editora em uma única parada.';
  byId('visit-total').textContent = priced ? currency.format(totalCents / 100) : 'Indisponível';
  byId('visit-total-note').textContent = priced === count ? '' : priced + ' de ' + count + ' com preço de feira';
  byId('visit-savings').textContent = comparable ? currency.format(savingsCents / 100) : 'Indisponível';
  byId('visit-savings-note').textContent = comparable < count ? comparable + ' de ' + count + ' com preços comparáveis' : '';
  byId('visit-progress-label').textContent = collected + ' de ' + count;
  byId('visit-progress').max = count || 1;
  byId('visit-progress').value = collected;
  const comparableCoverCents = comparableFairCents + savingsCents;
  byId('visit-comparison').hidden = comparableCoverCents === 0;
  if (comparableCoverCents > 0) {
    byId('comparison-paid').style.width = (100 * comparableFairCents / comparableCoverCents) + '%';
    byId('comparison-fair').textContent = 'Na feira ' + currency.format(comparableFairCents / 100);
    byId('comparison-cover').textContent = 'Preço de capa ' + currency.format(comparableCoverCents / 100);
  }
  if (!visitStorage) summary += ' O navegador não pôde salvar o roteiro. Imprima antes de fechar a página.';
  byId('visit-summary').textContent = summary;
  renderMarketComparison(saved);
  byId('stops').replaceChildren(...stops.map(({publisher,titles,islands}) => {
    const stop = element('article', '', 'stop');
    if (islands.length) stop.dataset.zone = zoneOf(islands[0]);
    stop.append(element('h3', publisher || 'Editora não informada'));
    const location = islands.map(islandLabel);
    stop.append(element('p', location.length ? location.join(' ou ') : 'Ilha não identificada. Consulte o mapa oficial.', 'meta'));
    const list = element('ul', '');
    for (const book of titles.sort((a,b) => alphabet.compare(a.title,b.title))) {
      const key = bookKey(book);
      const item = element('li', '');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = favorites.get(key);
      checkbox.addEventListener('change', () => {
        favorites.set(key, checkbox.checked);
        saveVisit();
        renderVisit();
        const replacement = [...byId('stops').querySelectorAll('input[type="checkbox"]')].find(input => input.value === key);
        replacement?.focus({preventScroll:true});
      });
      checkbox.value = key;
      const text = book.title + (book.isbn ? ' · ' + book.isbn : '') +
        (book.price === null ? ' · Sem preço informado' : ' · ' + currency.format(book.price));
      const label = element('label', '');
      label.append(checkbox, element('span', text));
      const remove = element('button', '×', 'remove-book');
      remove.type = 'button';
      remove.title = 'Remover do roteiro';
      remove.setAttribute('aria-label', 'Remover ' + book.title + ' do roteiro');
      remove.addEventListener('click', () => {
        const index = [...byId('stops').querySelectorAll('.remove-book')].indexOf(remove);
        favorites.delete(key);
        saveVisit();
        renderVisit();
        render();
        const remaining = byId('stops').querySelectorAll('.remove-book');
        (remaining[Math.min(index, remaining.length - 1)] ?? byId('visit-title')).focus({preventScroll:true});
      });
      item.append(label, remove, amazonComparison(book));
      list.append(item);
    }
    stop.append(list);
    return stop;
  }));
}
function favoriteButton(book) {
  const button = element('button', '', 'favorite');
  const key = bookKey(book);
  function update() {
    const active = favorites.has(key);
    button.textContent = active ? '★ Favoritado' : '☆ Favoritar';
    button.setAttribute('aria-pressed', String(active));
  }
  button.setAttribute('aria-label', 'Favoritar ' + book.title);
  button.addEventListener('click', () => {
    if (favorites.has(key)) favorites.delete(key);
    else favorites.set(key, false);
    saveVisit();
    update();
    renderVisit();
  });
  update();
  return button;
}
const missingCovers = new Set();
function isbnFrom(code) {
  const isbn = code.replace(/[\s-]/g, '').toUpperCase();
  return /^(?:\d{9}[\dX]|97[89]\d{10})$/.test(isbn) ? isbn : '';
}
function bookCover(book) {
  const cover = element('div', '', 'cover');
  cover.setAttribute('aria-hidden', 'true');
  cover.append(element('span', '', 'cover-placeholder'));
  const isbn = isbnFrom(book.isbn);
  const isbnCover = isbn
    ? 'https://covers.openlibrary.org/b/isbn/' + isbn + '-S.jpg?default=false'
    : '';
  const publisherCover = Object.hasOwn(publisherCovers, book.link) ? publisherCovers[book.link] : '';
  const sources = [publisherCover, isbnCover].filter(url => url && !missingCovers.has(url));
  if (!sources.length) return cover;
  const image = document.createElement('img');
  image.alt = '';
  image.width = 52;
  image.height = 78;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  let source = 0;
  image.addEventListener('error', () => {
    missingCovers.add(sources[source++]);
    if (source < sources.length) image.src = sources[source];
    else image.remove();
  });
  image.src = sources[source];
  cover.append(image);
  return cover;
}
function amazonComparison(book) {
  const key = bookKey(book);
  const panel = element('details', '', 'price-comparison');
  const heading = element('summary', 'Comparar com a Amazon');
  const amazon = new URL('https://www.amazon.com.br/s');
  amazon.searchParams.set('i', 'stripbooks');
  amazon.searchParams.set('k', isbnFrom(book.isbn) || [book.title, book.author].filter(Boolean).join(' '));
  const link = officialLink(amazon.href, 'Buscar na Amazon');
  const form = element('form', '');
  const label = element('label', 'Preço na Amazon com frete (R$)');
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.placeholder = 'Ex. 39,90';
  const saved = amazonPrices.get(key);
  if (saved !== undefined) input.value = (saved / 100).toFixed(2).replace('.', ',');
  label.append(input);
  const save = element('button', 'Salvar');
  save.type = 'submit';
  form.append(label, save);
  const result = element('p', '', 'meta');
  result.setAttribute('role', 'status');
  function showComparison() {
    const cents = amazonPrices.get(key);
    heading.textContent = cents === undefined ? 'Comparar com a Amazon' : 'Amazon: ' + currency.format(cents / 100);
    if (cents === undefined) {
      result.textContent = 'Confira se é a mesma edição e informe o valor encontrado.';
      return;
    }
    if (book.price === null) {
      result.textContent = 'Preço informado salvo. O preço de feira está indisponível para comparar.';
      return;
    }
    const difference = cents - Math.round(book.price * 100);
    result.textContent = difference === 0 ? 'Mesmo preço na feira e na Amazon.' :
      (difference > 0 ? 'A feira sai ' : 'A Amazon sai ') +
      currency.format(Math.abs(difference) / 100) + ' mais barata.';
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim().replace(/^R\$\s*/, '');
    const cents = /^\d+(?:[,.]\d{1,2})?$/.test(text) ? Math.round(Number(text.replace(',', '.')) * 100) : coverPriceInCents(text);
    if (text && !validAmazonPrice(cents)) {
      result.textContent = 'Informe um preço válido ou deixe o campo vazio para remover.';
      input.focus();
      return;
    }
    if (text) amazonPrices.set(key, cents);
    else amazonPrices.delete(key);
    const persisted = saveAmazonPrices();
    showComparison();
    renderMarketComparison(favoriteBooks());
    if (!persisted) result.textContent += ' Este navegador não conseguiu guardar o valor.';
  });
  showComparison();
  panel.append(heading, link, form, result);
  return panel;
}
function bookCard(book) {
  const card = element('article', '', 'book');
  const heading = element('div', '', 'book-heading');
  const details = element('div', '');
  details.append(element('h2', book.title || 'Título não informado'));
  if (book.author) details.append(element('p', book.author));
  details.append(element('p', [book.publisher, book.isbn].filter(Boolean).join(' · '), 'meta'));
  heading.append(bookCover(book), details);
  card.append(heading);
  card.append(favoriteButton(book));
  const { theme, subtheme, format } = book.facets;
  const tags = [...(subtheme.length ? subtheme : theme), ...format];
  card.append(element('p', tags.join(' · '), 'tags'));
  if (book.subject && !/^\d+(?:[,.]\d+)?$/.test(book.subject)) card.append(element('p', 'Assunto informado: ' + book.subject, 'meta'));
  if (book.origin.includes('Título') && book.origin.includes('revisar')) card.append(element('p', 'Tema inferido pelo título', 'meta'));
  const footer = element('footer', '');
  const prices = element('div', '');
  prices.append(element('span', book.price === null ? 'Preço de feira indisponível' : currency.format(book.price), 'price'));
  if (book.coverPrice) prices.append(element('span', 'Capa ' + book.coverPrice, 'price-detail'));
  if (book.discount !== null && book.discount > 0) prices.append(element('span', integer.format(Math.round(book.discount)) + '% de desconto', 'discount'));
  footer.append(prices);
  if (/^https?:\/\//i.test(book.link)) {
    const link = element('a', 'Ver na editora');
    link.href = book.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Ver ' + book.title + ' na editora (abre em outra aba)');
    footer.append(link);
  }
  card.append(footer);
  return card;
}
function render() {
  const pages = Math.ceil(filtered.length / size);
  byId('count').textContent = integer.format(filtered.length) + (filtered.length === 1 ? ' resultado' : ' resultados') + ' de ' + integer.format(books.length);
  byId('cards').replaceChildren(...(pages ? filtered.slice(page * size, (page + 1) * size).map(bookCard) : [element('p', 'Nenhum livro combina com os filtros ativos. Remova um filtro, aumente o preço máximo ou ajuste a busca.', 'empty')]));
  byId('pagination').hidden = pages <= 1;
  byId('pagination').style.display = pages <= 1 ? 'none' : '';
  byId('page').textContent = 'Página ' + (page + 1) + ' de ' + pages;
  byId('prev').disabled = page === 0;
  byId('next').disabled = page + 1 >= pages;
}
const searchParams = {
  query: 'busca', publisher: 'editora', theme: 'tema', subtheme: 'subtema',
  format: 'formato', price: 'ate', sort: 'ordem'
};
const validFacetValues = Object.fromEntries(facetIds.map(id => [id, new Set(books.flatMap(book => book.facets[id]))]));
function catalogHash(state) {
  const params = new URLSearchParams();
  for (const [id, name] of Object.entries(searchParams)) {
    if (state[id] && !(id === 'sort' && state[id] === 'title')) params.set(name, state[id]);
  }
  return '#catalogo' + (params.size ? '?' + params.toString() : '');
}
function readCatalogHash() {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const state = Object.fromEntries(Object.entries(searchParams).map(([id,name]) => [id, params.get(name) ?? '']));
  for (const id of facetIds) if (!validFacetValues[id].has(state[id])) state[id] = '';
  if (!['price','discount'].includes(state.sort)) state.sort = 'title';
  return state;
}
function filter(state) {
  if (state) {
    for (const id of ['query','price','sort']) fields[id].value = state[id];
  }
  byId('share-feedback').textContent = '';
  byId('share-url').hidden = true;
  const query = normalize(fields.query.value.trim()).split(/\s+/).filter(Boolean);
  const maximum = fields.price.valueAsNumber;
  const selected = new Map(facetIds.map(id => [id, state ? state[id] : fields[id].value]).filter(([,value]) => value));
  const filterCount = selected.size + Number(!Number.isNaN(maximum));
  byId('filter-toggle').textContent = 'Filtros e ordenação' + (filterCount ? ' (' + filterCount + ')' : '');
  const activeFacets = [...selected];
  const counts = Object.fromEntries(facetIds.map(id => [id, new Map()]));
  filtered = [];
  for (const book of books) {
    if (!query.every(term => book.search.includes(term))) continue;
    if (!Number.isNaN(maximum) && (book.price === null || book.price > maximum)) continue;
    const mismatches = activeFacets.filter(([id,value]) => !book.facets[id].includes(value));
    if (mismatches.length > 1) continue;
    if (!mismatches.length) filtered.push(book);
    // Each menu counts books that satisfy all the other menus.
    const availableMenus = mismatches.length ? [mismatches[0][0]] : facetIds;
    for (const id of availableMenus) {
      const totals = counts[id];
      for (const value of book.facets[id]) {
        if (value) totals.set(value, (totals.get(value) ?? 0) + 1);
      }
    }
  }
  for (const id of facetIds) fillFacet(id, counts[id], selected.get(id) ?? '');
  if (fields.sort.value === 'price') filtered.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (fields.sort.value === 'discount') filtered.sort((a,b) => (b.discount ?? -Infinity) - (a.discount ?? -Infinity));
  page = 0;
  render();
  const hash = catalogHash(Object.fromEntries(Object.entries(fields).map(([id,field]) => [id, field.value])));
  for (const link of document.querySelectorAll('a[href^="#catalogo"]')) link.href = hash;
  if (location.hash.slice(1).split('?')[0] === 'catalogo' && location.hash !== hash) history.replaceState(null, '', hash);
}
function resetFilters() {
  for (const [id, field] of Object.entries(fields)) field.value = id === 'sort' ? 'title' : '';
  filter();
}
for (const field of Object.values(fields)) field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => filter());
byId('reset').onclick = resetFilters;
byId('filter-toggle').onclick = () => {
  const collapsed = byId('catalog-filters').toggleAttribute('data-mobile-collapsed');
  byId('filter-toggle').setAttribute('aria-expanded', String(!collapsed));
};
byId('share-search').onclick = async () => {
  const feedback = byId('share-feedback');
  if (!/^https?:$/.test(location.protocol)) {
    feedback.textContent = 'Abra o catálogo pelo endereço publicado para compartilhar esta busca.';
    return;
  }
  const url = byId('share-url');
  try {
    await navigator.clipboard.writeText(location.href);
    feedback.textContent = 'Link da busca copiado.';
  } catch {
    url.value = location.href;
    url.hidden = false;
    url.select();
    feedback.textContent = 'Copie o endereço selecionado para compartilhar a busca.';
  }
};
function move(delta) {
  page += delta;
  render();
  byId('count').scrollIntoView({block:'start'});
}
byId('prev').onclick = () => move(-1);
byId('next').onclick = () => move(1);
byId('print-visit').onclick = () => window.print();
const transferStatus = byId('visit-transfer-status');
byId('export-visit').onclick = () => {
  const entries = [...favorites].filter(([key]) => bookIndex.has(key))
    .map(([key, checked]) => [key, checked, amazonPrices.get(key) ?? null]);
  const file = new Blob([JSON.stringify({format:'festa-usp-2026-roteiro', version:2, entries})], {type:'application/json'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'meu-roteiro-festa-usp-2026.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  transferStatus.textContent = 'Importe o arquivo baixado no outro aparelho para abrir o roteiro.';
};
const visitFile = byId('visit-file');
byId('import-visit-empty').onclick = () => visitFile.click();
byId('import-visit').onclick = () => visitFile.click();
visitFile.addEventListener('change', async () => {
  const file = visitFile.files[0];
  visitFile.value = '';
  if (!file) return;
  try {
    if (file.size > 20_000_000) throw new Error();
    const data = JSON.parse(await file.text());
    if (data?.format !== 'festa-usp-2026-roteiro' || ![1,2].includes(data.version) || !Array.isArray(data.entries) ||
        !data.entries.every(entry => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'boolean' &&
          (data.version === 1 ? entry.length === 2 : entry.length === 3 && (entry[2] === null || validAmazonPrice(entry[2]))))) throw new Error();
    let added = 0;
    let updated = 0;
    let importedPrices = 0;
    let skipped = 0;
    for (const [previousKey, checked, amazonPrice] of data.entries) {
      const key = currentBookKey(previousKey);
      if (!key) { skipped++; continue; }
      if (!favorites.has(key)) added++;
      else if (checked && !favorites.get(key)) updated++;
      favorites.set(key, Boolean(favorites.get(key) || checked));
      if (validAmazonPrice(amazonPrice) && !amazonPrices.has(key)) {
        amazonPrices.set(key, amazonPrice);
        importedPrices++;
      }
    }
    saveVisit();
    const pricesSaved = !importedPrices || saveAmazonPrices();
    renderVisit();
    render();
    transferStatus.textContent = added || updated || importedPrices
      ? 'Roteiro importado. ' + added + ' favoritos adicionados e ' + updated + ' marcações atualizadas.'
      : 'Seu roteiro já contém os títulos reconhecidos deste arquivo.';
    if (importedPrices) transferStatus.textContent += ' Preços da Amazon importados: ' + importedPrices + '.';
    if (!pricesSaved) transferStatus.textContent += ' Este navegador não conseguiu guardar os preços importados.';
    if (skipped) transferStatus.textContent += ' ' + skipped + ' títulos do arquivo não aparecem nesta versão do catálogo.';
  } catch {
    transferStatus.textContent = 'Não foi possível importar. Selecione um arquivo JSON exportado por este catálogo.';
  }
});
const directoryMap = byId('visit-map-panel').cloneNode(true);
directoryMap.removeAttribute('id');
byId('directory-map').append(directoryMap);
for (const button of document.querySelectorAll('.zoom-map')) {
  button.onclick = () => {
    const map = button.closest('details').querySelector('.visit-map');
    const expanded = map.classList.toggle('expanded');
    button.setAttribute('aria-pressed', String(expanded));
    button.textContent = expanded ? 'Reduzir mapa' : 'Ampliar mapa';
    if (!expanded) map.scrollLeft = 0;
  };
}
byId('clear-favorites').onclick = () => {
  if (!window.confirm('Limpar todos os favoritos e as marcações do roteiro?')) return;
  favorites.clear();
  transferStatus.textContent = '';
  saveVisit();
  renderVisit();
  render();
  byId('visit-title').focus({preventScroll:true});
};
byId('publisher-query').addEventListener('input', renderPublishers);
byId('publisher-zone').addEventListener('change', renderPublishers);
renderVisit();
byId('favorites-count').hidden = false;
window.roteiroCatalog = {
  open(view) {
    if (view === 'editoras') renderPublishers();
    if (view === 'catalogo') filter(readCatalogHash());
  }
};
