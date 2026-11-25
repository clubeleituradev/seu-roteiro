"""Extração de registros das listas de preços em PDF."""

import bisect
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations

import pymupdf

from .normalizacao import cents, isbn_key, normalized, valid_isbn


ISBN_LIKE = re.compile(r"^\d{9}[\dXx]$|^\d{11,13}$")
FIXED_LAYOUTS = {
    # Individual exports with missing or misleading rules. Column indexes start at the outer border.
    "editora-538.pdf": (595, [37, 132, 182, 233, 285, 337, 389, 442, 531, 556], (2, 3, 7, 5, 6)),
    "editora-542.pdf": (842, [36, 100, 287, 457, 542, 594, 647, 738], (2, 3, 7, 5, 6)),
    "editora-515.pdf": (842, [50, 137, 189, 319, 544, 585, 683], (4, 3, None, 5, 6)),
    "editora-569.pdf": (842, [50, 107, 164, 221, 278, 335, 392, 449, 506], (2, 3, 7, 5, 6)),
    "editora-620.pdf": (842, [78, 145, 254, 326, 385, 423, 459, 558, 802], (2, 3, 7, 5, 6)),
}


def clean_words(words):
    ordered = sorted(words, key=lambda word: (round(mean_y(word) / 3), word[0]))
    return " ".join(word[4] for word in ordered).strip()


def mean_y(word):
    return (word[1] + word[3]) / 2


def looks_decimal(value):
    return bool(re.search(r"[,.]\d{1,2}\D*$", value))


def grid(page):
    vertical, horizontal = Counter(), Counter()
    for drawing in page.get_cdrawings():
        for kind, *items in drawing["items"]:
            if kind == "l":
                (x0, y0), (x1, y1) = items
                if abs(x0 - x1) < .4:
                    vertical[round(x0, 1)] += abs(y1 - y0)
                elif abs(y0 - y1) < .4:
                    horizontal[round(y0, 1)] += abs(x1 - x0)
            elif kind == "re":
                (x0, y0, x1, y1), _orientation = items
                if x1 - x0 < 2:
                    vertical[round((x0 + x1) / 2, 1)] += y1 - y0
                if y1 - y0 < 2:
                    horizontal[round((y0 + y1) / 2, 1)] += x1 - x0

    def positions(counts, minimum):
        groups = []
        for key in sorted(key for key, weight in counts.items() if weight >= minimum):
            if groups and key - groups[-1][-1] <= 1.0:
                groups[-1].append(key)
            else:
                groups.append([key])
        return [group[len(group) // 2] for group in groups]

    return positions(vertical, 20), positions(horizontal, page.rect.width * .28)


def grouped_rows(words, anchors, row_edges):
    y_values = [mean_y(word) for word in anchors]
    grid_rows = [bisect.bisect_right(row_edges, y) for y in y_values]
    if row_edges and len(set(grid_rows)) == len(anchors) and all(0 < index < len(row_edges) for index in grid_rows):
        anchor_rows = {index: i for i, index in enumerate(grid_rows)}
        groups = [[] for _ in anchors]
        for word in words:
            index = anchor_rows.get(bisect.bisect_right(row_edges, mean_y(word)))
            if index is not None:
                groups[index].append(word)
        return groups
    middle = [(a + b) / 2 for a, b in zip(y_values, y_values[1:])]
    groups = [[] for _ in anchors]
    for word in words:
        y = mean_y(word)
        if y_values[0] - 5 <= y <= y_values[-1] + 5:
            groups[bisect.bisect_right(middle, y)].append(word)
    return groups


@dataclass
class ExtractedBook:
    isbn: str
    title: str
    author: str
    subject: str
    cover: int | None
    fair: int | None
    link: str
    page: int
    uncertain_layout: bool = False


def read_page(page, previous, extra_codes=None, fixed=None):
    words = page.get_text("words")
    candidates = [word for word in words if word[0] < page.rect.width * .32
                  and (ISBN_LIKE.fullmatch(code := isbn_key(word[4])) or (extra_codes and extra_codes.fullmatch(code)))]
    if not candidates:
        return [], 0, previous
    x_edges, y_edges = grid(page)
    if fixed and abs(page.rect.width - fixed[0]) < 1:
        x_edges = fixed[1]
    else:
        fixed = None
    if len(x_edges) < 4:
        if not previous or previous[0] != page.rect.width or len(previous[1]) < 4:
            return read_unruled(page, words, candidates, previous, y_edges)
        else:
            x_edges = previous[1]

    def column(word):
        # Start coordinates keep text printed over a neighboring cell in its original column.
        return bisect.bisect_right(x_edges, word[0] + .3)

    counts = Counter(column(word) for word in candidates)
    isbn_column = min(counts, key=lambda col: (-counts[col], col))
    anchors = sorted((word for word in candidates if column(word) == isbn_column), key=mean_y)
    header = [word for word in words if mean_y(word) < mean_y(anchors[0]) - 3]
    header_columns = defaultdict(set)
    for word in header:
        label = normalized(word[4])
        if label:
            header_columns[label].add(column(word))

    def find_column(labels, previous_index, default=None):
        positions = sorted({c for label in labels for c in header_columns[label] if c >= isbn_column})
        if positions:
            return positions[0]
        if previous and previous[0] == page.rect.width and len(previous[1]) == len(x_edges):
            return previous[previous_index]
        return default

    title = find_column(("titulo", "titulos", "title", "obra", "livro", "produto", "produtos", "descricao"), 2, isbn_column + 1)
    author = find_column(("autor", "autores", "autoria"), 3)
    subject = find_column(("assunto", "area", "categoria", "genero", "tema"), 4)
    cover_header = find_column(("capa", "valor", "unit", "unitario", "original"), 5)
    fair_header = find_column(("desconto", "descont", "desc", "feira", "usp", "venda"), 6)
    price_heads = sorted(header_columns["preco"])
    if len(price_heads) == 2:
        cover_header, fair_header = price_heads
    if fair_header is None:
        fair_header = next((column(word) for word in header if word[4] == "50%"
                            and column(word) > (cover_header if cover_header is not None else title)), None)
    price_after = author if author is not None else title
    rows = grouped_rows(words, anchors, y_edges)
    by_row = []
    pair_counts = Counter()
    for row in rows:
        cells = defaultdict(list)
        for word in row:
            cells[column(word)].append(word)
        by_row.append(cells)
        prices = sorted(col for col, cell in cells.items()
                        if col > price_after and col != subject
                        and any(looks_decimal(word[4]) for word in cell)
                        and cents(clean_words(cell)) is not None)
        pair_counts.update(combinations(prices, 2))
    if fixed:
        title, author, subject, cover_col, fair_col = fixed[2]
    elif cover_header is not None and fair_header is not None and price_after < cover_header < fair_header:
        cover_col, fair_col = cover_header, fair_header
        if pair_counts and pair_counts[cover_col, fair_col] == 0:
            cover_col, fair_col = max(pair_counts, key=lambda pair: (pair_counts[pair], pair))
    elif pair_counts:
        cover_col, fair_col = max(pair_counts, key=lambda pair: (pair_counts[pair], pair))
    elif previous and previous[0] == page.rect.width and len(previous[1]) == len(x_edges) and previous[5] is not None:
        cover_col, fair_col = previous[5:7]
    elif cover_header is not None and cover_header > price_after:
        cover_col, fair_col = cover_header, None
    else:
        return read_unruled(page, words, anchors, previous, y_edges)
    profile = page.rect.width, x_edges, title, author, subject, cover_col, fair_col

    links = page.get_links()
    link_order = sorted((item["from"].y0, item["from"].y1, item.get("uri", ""))
                        for item in links if item.get("uri", "").startswith(("https://", "http://")))
    output = []
    for anchor, cells in zip(anchors, by_row):
        isbn = isbn_key(anchor[4])
        title_words = [word for word in cells[title] if word != anchor]
        name = clean_words(title_words)
        cover = cents(clean_words(cells[cover_col]))
        fair = cents(clean_words(cells[fair_col]))
        if not name or (not any(char.isalpha() for char in name) and not re.fullmatch(r"\d{1,6}", name)):
            output.extend(isbn_only(page, [anchor]))
            continue
        link = next((uri for top, bottom, uri in link_order if top - 2 <= mean_y(anchor) <= bottom + 2), "")
        output.append(ExtractedBook(isbn, name, clean_words(cells[author]),
                                    clean_words(cells[subject]) if subject is not None else "",
                                    cover, fair, link, page.number + 1))
    return output, len(anchors), profile


def read_unruled(page, words, candidates, previous, y_edges):
    positions = Counter(round(word[0] / 7) for word in candidates)
    x_group = min(positions, key=lambda value: (-positions[value], value))
    anchors = sorted((word for word in candidates if abs(round(word[0] / 7) - x_group) <= 1), key=mean_y)
    header = [word for word in words if mean_y(word) < mean_y(anchors[0]) - 3]
    cover_words = [word for word in header if normalized(word[4]) in {"capa", "valor", "unit", "unitario"}]
    fair_words = [word for word in header if normalized(word[4]) in {"desconto", "descont", "desc", "feira", "usp", "venda"} or word[4] == "50%"]
    price_words = sorted((word for word in header if normalized(word[4]) == "preco"), key=lambda word: word[0])
    if not (cover_words and fair_words) and len(price_words) == 2:
        cover_words, fair_words = [price_words[0]], [price_words[1]]
    if cover_words and fair_words:
        cover_word, fair_word = cover_words[-1], fair_words[-1]
        cover_x, fair_x = ((word[0] + word[2]) / 2 for word in (cover_word, fair_word))
        if not 4 <= fair_x - cover_x <= page.rect.width * .4:
            return isbn_only(page, anchors), len(anchors), previous
    elif previous and previous[0] == page.rect.width and not previous[1]:
        cover_x, fair_x = previous[5:7]
    else:
        return isbn_only(page, anchors), len(anchors), previous
    profile = page.rect.width, [], None, None, None, cover_x, fair_x
    result = []
    midpoint = (cover_x + fair_x) / 2
    margin = max(11, (fair_x - cover_x) * .53)
    for anchor, row in zip(anchors, grouped_rows(words, anchors, y_edges)):
        identified = []
        for word in row:
            price = cents(word[4])
            if price is not None and looks_decimal(word[4]):
                identified.append(((word[0] + word[2]) / 2, price))
        cover = min(((abs(x-cover_x), value) for x, value in identified if x < midpoint and cover_x - x <= margin), default=(0,None))[1]
        fair = min(((abs(x-fair_x), value) for x, value in identified if x >= midpoint and x - fair_x <= margin), default=(0,None))[1]
        result.append(ExtractedBook(isbn_key(anchor[4]), "", "", "", cover, fair, "", page.number + 1, True))
    return result, len(anchors), profile


def table_rows(pdf_path):
    books, candidates = [], 0
    profile = None
    exceptions = {"editora-629.pdf": re.compile(r"\d{5,6}"), "editora-645.pdf": re.compile(r"97[89]\d{4,7}")}
    with pymupdf.open(pdf_path) as pdf:
        split_layouts = {"editora-480.pdf": (10, 2, 132, 640), "editora-508.pdf": (16, 8, 93, 95)}
        split_layout = split_layouts.get(pdf_path.name)
        if split_layout and len(pdf) == split_layout[0]:
            return read_split_table(pdf, *split_layout[1:])
        for page in pdf:
            rows, count, profile = read_page(page, profile, exceptions.get(pdf_path.name), FIXED_LAYOUTS.get(pdf_path.name))
            books.extend(rows)
            candidates += count
        return books, len(pdf), candidates


def read_split_table(pdf, offset, title_x, price_divider):
    # Excel paginated the title and price columns horizontally. Join only rows at the same height.
    output, candidates = [], 0
    for index in range(offset):
        left, right = pdf[index], pdf[index + offset]
        words = left.get_text("words")
        anchors = sorted([word for word in words if word[0] < title_x and ISBN_LIKE.fullmatch(isbn_key(word[4]))], key=mean_y)
        if not anchors:
            continue
        candidates += len(anchors)
        price_words = [word for word in right.get_text("words")
                       if looks_decimal(word[4]) and cents(word[4].rstrip("-")) is not None]
        for anchor, row in zip(anchors, grouped_rows(words, anchors, grid(left)[1])):
            matches = [word for word in price_words if abs(mean_y(word) - mean_y(anchor)) <= 3.5]
            cover = [cents(word[4].rstrip("-")) for word in matches if word[0] < price_divider]
            fair = [cents(word[4].rstrip("-")) for word in matches if word[0] >= price_divider]
            if len(cover) != 1 or len(fair) != 1:
                output.extend(isbn_only(left, [anchor]))
                continue
            title = clean_words([word for word in row if word[0] >= title_x])
            output.append(ExtractedBook(isbn_key(anchor[4]), title, "", "", cover[0], fair[0], "", left.number + 1))
    return output, len(pdf), candidates


def isbn_only(page, anchors):
    return [ExtractedBook(code, "", "", "", None, None, "", page.number + 1, True)
            for anchor in anchors if valid_isbn(code := isbn_key(anchor[4]))]
