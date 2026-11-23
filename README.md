# Faça seu roteiro

App independente do [Leitura Dev](https://leitura.dev/) para planejar a visita à 28ª Festa do Livro da USP. O catálogo permite buscar por título, autor e ISBN, combinar filtros, localizar as editoras no mapa e montar um roteiro de compras.

## Como abrir e publicar

Abra `index.html` no navegador. Para publicar, use a raiz do repositório como diretório de uma hospedagem estática. O projeto funciona sem instalação, compilação ou chaves de API.

A busca, os filtros e o mapa das ilhas funcionam offline. As capas e os links externos dependem de conexão. Use **Exportar roteiro** e **Importar roteiro** para transferir favoritos, marcações e preços da Amazon informados manualmente para outro navegador ou para o endereço publicado. A importação mantém os preços já salvos no navegador de destino.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Capa, catálogo, lista de editoras e roteiro |
| `assets/styles.css` | Estilos e layout responsivo |
| `assets/app.js` | Busca, filtros, favoritos, mapa e comparações |
| `assets/navigation.js` | Menu, navegação e carregamento do catálogo sob demanda |
| `assets/analytics.js` | Medição de visitas e preferências do Google Analytics 4 |
| `assets/mapa-ilhas.webp` | Mapa oficial das ilhas |
| `dados/catalogo.js` | Dados carregados pelo site, incluindo os endereços das capas |
| `dados/*.csv` | Exportações de livros, classificações e editoras para análise |

## Fonte dos dados

A base de **22/11/2026** inclui **26.014 registros** de livros e **163 editoras** na lista de catálogos. O assunto informado pela editora é preservado. Temas e subtemas são rótulos atribuídos automaticamente, e os registros sem classificação aparecem em **A classificar**.

Para consultar preços, disponibilidade e novos títulos, use o [catálogo oficial da Edusp](https://festadolivro.edusp.com.br/28-festa-do-livro-da-usp/busca-por-livros). As capas vêm das editoras e da [Open Library](https://openlibrary.org/).

Ao atualizar a base, mantenha a mesma data e os mesmos totais nos CSVs, em `dados/catalogo.js` e nos avisos de fonte de `index.html`.

## Google Analytics 4

O app usa o mesmo fluxo web GA4 do Leitura Dev. O ID público de medição fica na meta tag `ga4-measurement-id` em `index.html`. O app registra uma visualização a cada troca de aba após o visitante permitir a medição. Ele usa o endereço da aba sem os termos e filtros da busca.

Depois de publicar, valide a coleta em **Tempo real**. Para acompanhar a quantidade de visitas ao longo do tempo, use a métrica **Sessões** e filtre pelo domínio ou caminho publicado do app. Mudanças nas [visualizações automáticas baseadas no histórico](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events) afetam todo o fluxo compartilhado. Se essa opção estiver ligada, ela pode duplicar visualizações de abas.
