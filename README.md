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
| `scripts/cruzar_listas_editoras.py` | Comando para comparar as listas com a base e aplicar as atualizações |
| `scripts/catalogo/` | Extração dos PDFs, normalização, comparação e gravação dos dados |
| `scripts/requirements.txt` | Versão do PyMuPDF usada na importação |

## Fonte dos dados

A busca integrada de **22/11/2026** foi complementada com as listas das editoras baixadas em **25/11/2026**. A base resultante reúne **33.040 registros** e **176 editoras** no índice oficial. Temas e subtemas são atribuídos automaticamente, e os registros sem classificação aparecem em **A classificar**.

Para consultar preços, disponibilidade e novos títulos, use o [catálogo oficial da Edusp](https://festadolivro.edusp.com.br/28-festa-do-livro-da-usp/busca-por-livros). As capas vêm das editoras e da [Open Library](https://openlibrary.org/).

### Cruzar as listas das editoras

A pasta local `dados/listas-editoras/2026-11-25/` guarda os PDFs, o `manifesto.json` com a relação de editoras e URLs, e o `busca-oficial.json` usado para confirmar metadados. Essa pasta é ignorada pelo Git. Execute os comandos abaixo na raiz do projeto.

```sh
python -m pip install -r scripts/requirements.txt
python scripts/cruzar_listas_editoras.py --listas dados/listas-editoras/2026-11-25 --referencia dados/listas-editoras/2026-11-25/busca-oficial.json
```

Por padrão, o script grava apenas `comparacao.csv` e `cobertura.csv` ao lado dos PDFs. O primeiro detalha correções, inclusões e casos para revisão. O segundo resume a extração por editora. Depois de revisar os relatórios, repita o comando com `--aplicar` para gravar também os CSVs do projeto e `dados/catalogo.js`.

No cruzamento, o preço identificado com segurança no PDF tem prioridade. Para conflitos internos ou extrações incertas, o script usa a busca oficial quando encontra a mesma edição. Se a edição estiver identificada e o preço em conflito não puder ser confirmado, o campo fica em branco. Títulos podem ser acrescentados com o preço de feira em branco quando a lista só publica o valor de capa. Use `--editora "Nome da editora"` para limitar a comparação.

## Google Analytics 4

O app usa o mesmo fluxo web GA4 do Leitura Dev. O ID público de medição fica na meta tag `ga4-measurement-id` em `index.html`. O app registra uma visualização a cada troca de aba após o visitante permitir a medição. Ele usa o endereço da aba sem os termos e filtros da busca.

Depois de publicar, valide a coleta em **Tempo real**. Para acompanhar a quantidade de visitas ao longo do tempo, use a métrica **Sessões** e filtre pelo domínio ou caminho publicado do app. Mudanças nas [visualizações automáticas baseadas no histórico](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events) afetam todo o fluxo compartilhado. Se essa opção estiver ligada, ela pode duplicar visualizações de abas.
