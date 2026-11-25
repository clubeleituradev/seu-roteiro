# Faça seu roteiro

Planeje sua visita à **28ª Festa do Livro da USP**. Encontre livros, veja onde ficam as editoras e organize suas compras em um roteiro. Um projeto independente do [Leitura Dev](https://leitura.dev/).

**[Abrir o Faça seu roteiro](https://clubeleituradev.github.io/seu-roteiro/)**

## O que você pode fazer

- Buscar por título, autor ou ISBN e combinar filtros de editora, tema, subtema e preço.
- Favoritar livros e ver o roteiro agrupado por editora, com as ilhas no mapa e o total da compra.
- Comparar o total da feira com os preços da Amazon que você informar para as mesmas edições.
- Exportar e importar o roteiro para levar seus favoritos a outro navegador ou aparelho.

## Dados e fontes

O catálogo reúne **33.040 registros de 176 editoras**. A busca da Edusp de **22/11/2026** foi complementada com as listas oficiais das editoras de **25/11/2026**. Quando o preço pode ser confirmado para a edição, a lista da editora tem prioridade. Valores conflitantes sem confirmação ficam em branco. Os temas e subtemas são atribuídos automaticamente.

Para confirmar preços e disponibilidade, consulte a [busca oficial da Festa](https://festadolivro.edusp.com.br/28-festa-do-livro-da-usp/busca-por-livros) ou a [página de editoras](https://festadolivro.edusp.com.br/28-festa-do-livro-da-usp/editoras). As capas vêm das editoras e da [Open Library](https://openlibrary.org/).

## Rodar localmente

```sh
git clone https://github.com/clubeleituradev/seu-roteiro.git
cd seu-roteiro
```

Abra [`index.html`](index.html) no navegador. O app usa HTML, CSS e JavaScript e funciona sem instalar dependências ou compilar. A busca e o mapa funcionam offline. Capas externas e links da feira precisam de conexão.

| Caminho | Conteúdo |
| --- | --- |
| [`assets/`](assets/) | Interface, navegação, mapa e estatísticas |
| [`dados/`](dados/) | Catálogo usado pelo app e exportações CSV |
| [`scripts/`](scripts/) | Importação e conferência das listas das editoras |

## Atualizar o catálogo

O app já inclui o catálogo pronto. Para rodar a importação, baixe os PDFs da página oficial de editoras e coloque-os em uma pasta com um `manifesto.json`. O manifesto é uma lista de objetos com os campos `editora`, `arquivo` (nome do PDF), `url` (link oficial da lista) e `site` (site da editora). Os PDFs e relatórios locais em `dados/listas-editoras/` ficam fora do Git.

Na raiz do projeto, instale a dependência e rode a comparação. Substitua o caminho no exemplo pelo da sua pasta.

```sh
python -m pip install -r scripts/requirements.txt
python scripts/cruzar_listas_editoras.py --listas dados/listas-editoras/2026-11-25
```

Use `--referencia CAMINHO.json` se tiver uma exportação da busca oficial para confirmar preços e metadados. Use `--editora "Nome da editora"` para limitar a conferência. Revise `comparacao.csv` e `cobertura.csv` na pasta das listas e repita o comando com `--aplicar` para atualizar o catálogo e os CSVs versionados.

## Privacidade

O roteiro é salvo no navegador. O Google Analytics conta visitas após o consentimento e recebe o endereço da aba sem os termos e filtros da busca.

## Feedback e licença

Para sugerir melhorias ou relatar um problema, use o [formulário de issues do GitHub](https://github.com/clubeleituradev/seu-roteiro/issues/new) ou escreva para [contato@leitura.dev](mailto:contato@leitura.dev).

O código é distribuído sob a [licença MIT](https://github.com/clubeleituradev/seu-roteiro/blob/main/LICENSE).
