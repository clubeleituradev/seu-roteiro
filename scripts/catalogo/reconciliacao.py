"""Identificação de edições e comparação com a base local."""

import re
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from .campos import (
    AUDIT_FIELDS, AUTHOR, CLASS_FIELDS, COVER, DISCOUNT, FAIR, FAIR_NUMBER,
    ISBN, LINK, PUBLISHER, SUBJECT, TITLE,
)
from .normalizacao import cents, decimal_text, isbn_key, normalized, price_text, publisher_key, valid_isbn
from .pdf import table_rows


def write_prices(row, cover, fair):
    row[COVER] = price_text(cover)
    row[FAIR] = price_text(fair)
    row[FAIR_NUMBER] = decimal_text(fair) if fair and fair > 0 else ""
    row[DISCOUNT] = ""
    if cover and fair and 0 < fair <= cover:
        discount = (Decimal(cover - fair) * 100 / cover).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        row[DISCOUNT] = format(discount, ".2f").replace(".", ",")


def collate(book_list):
    grouped = defaultdict(list)
    for book in book_list:
        grouped[(book.isbn, "" if valid_isbn(book.isbn) else normalized(book.title))].append(book)
    return grouped.values()


def official_prices(reference_row):
    if not reference_row:
        return None, None
    cover = cents(reference_row["price"] or "")
    fair = cents(reference_row["price_discount"] or "")
    cover = cover if cover and cover > 0 else None
    fair = fair if fair and fair > 0 and (cover is None or fair <= cover) else None
    return cover, fair


def resolve_prices(book, previous, reference_row, conflicting_pdf):
    cover, fair = book.cover, book.fair
    official = official_prices(reference_row)
    if (conflicting_pdf or book.uncertain_layout or cover == 0 or fair == 0
            or (cover is not None and fair is not None and fair > cover)):
        return official, "Preço atualizado pela busca oficial" if any(official) else "Preço ocultado para revisão"
    old_cover, old_fair = previous
    if cover is None:
        cover = official[0] or old_cover
    if fair is None:
        fair = official[1] or old_fair
    if cover is not None and fair is not None and fair > cover:
        # A partial PDF may supersede one value without confirming the other.
        cover, fair = book.cover, book.fair
    return (cover, fair), "Preço atualizado pela lista"


def reconciliation(current, manifest, list_path, enabled, reference, reference_titles):
    editions, global_editions, titles, known_subjects = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(Counter)
    publishers = {}
    for row in current:
        pub = publisher_key(row[PUBLISHER])
        isbn = isbn_key(row[ISBN])
        publishers.setdefault(pub, row[PUBLISHER])
        if isbn:
            editions[pub, isbn].append(row)
            global_editions[isbn].append(row)
        titles[pub, normalized(row[TITLE])].append(row)
        if row[SUBJECT] and row["Origem da classificação"] == "Assunto":
            known_subjects[normalized(row[SUBJECT])][tuple(row[field] for field in CLASS_FIELDS[:3])] += 1

    stats, differences = [], []
    for publisher in manifest:
        if not publisher["arquivo"] or (enabled and normalized(publisher["editora"]) not in enabled):
            continue
        name = publisher["editora"]
        pub = publisher_key(name)
        name = publishers.get(pub, name)
        result = Counter()
        try:
            extracted, pages, candidates = table_rows(list_path / Path(publisher["arquivo"]).name)
        except (RuntimeError, OSError, ValueError) as error:
            stats.append({"Editora": name, "Arquivo": publisher["arquivo"], "Observação": str(error)})
            continue

        def audit(status, book, previous=None):
            result[status] += 1
            if status == "Coincide":
                return
            differences.append(dict(zip(AUDIT_FIELDS, (
                status, name, book.isbn, book.title, previous[COVER] if previous else "", price_text(book.cover),
                previous[FAIR] if previous else "", price_text(book.fair), book.page, publisher["url"]))))

        for same_edition in collate(extracted):
            book = max(same_edition, key=lambda row: (row.fair is not None, row.cover is not None, len(row.title)))
            cover_values = {row.cover for row in same_edition if row.cover is not None}
            fair_values = {row.fair for row in same_edition if row.fair is not None}
            conflicting_pdf = len(cover_values) > 1 or len(fair_values) > 1
            if conflicting_pdf:
                for duplicate in same_edition:
                    audit("Conflito dentro do PDF", duplicate)
            else:
                book.cover = next(iter(cover_values), None)
                book.fair = next(iter(fair_values), None)
            pdf_cover, pdf_fair = book.cover, book.fair
            reference_row = reference.get((pub, book.isbn))
            reference_code_verified = False
            if not reference_row and not valid_isbn(book.isbn) and len(book.isbn) >= 7:
                title_match = reference_titles.get((pub, normalized(book.title)))
                verified_isbn = isbn_key(title_match["isbn"] or "") if title_match else ""
                if verified_isbn.startswith(book.isbn) and valid_isbn(verified_isbn):
                    reference_row = title_match
                    book.isbn = verified_isbn
                elif (verified_isbn == book.isbn and title_match and book.cover and book.fair
                      and book.cover == cents(title_match["price"] or "")
                      and book.fair == cents(title_match["price_discount"] or "")):
                    reference_row = title_match
                    reference_code_verified = True
            if reference_row and reference_row["name"]:
                book.title = reference_row["name"].strip()
                book.author = (reference_row["authors"] or "").strip()
                book.subject = (reference_row["subject"] or "").strip()
                book.link = (reference_row["link"] or "").strip()
            hits = editions[pub, book.isbn] if valid_isbn(book.isbn) else []
            title_hits = titles[pub, normalized(book.title)]
            if not hits:
                hits = [row for row in title_hits if not valid_isbn(isbn_key(row[ISBN])) or not valid_isbn(book.isbn)]
            if len(hits) > 1:
                exact = [row for row in hits if normalized(row[TITLE]) == normalized(book.title)]
                if len(exact) == 1:
                    hits = exact
            if len(hits) > 1:
                audit("Mais de um registro na base", book)
                continue
            if hits:
                row = hits[0]
                if not book.title:
                    book.title = row[TITLE]
                old_cover, old_fair = cents(row[COVER]), cents(row[FAIR_NUMBER] or row[FAIR])
                differs = ((old_cover is not None and book.cover is not None and old_cover != book.cover)
                           or (old_fair is not None and book.fair is not None and old_fair != book.fair))
                if differs or conflicting_pdf:
                    prices, status = resolve_prices(book, (old_cover, old_fair), reference_row, conflicting_pdf)
                    if prices != (old_cover, old_fair):
                        audit(status, book, row)
                        write_prices(row, *prices)
                    else:
                        audit("Busca oficial mantida" if any(prices) else "Sem preço confirmado", book, row)
                elif (book.fair and book.cover and 0 < book.fair <= book.cover
                      and (old_cover is None or old_fair is None)
                      and (not book.uncertain_layout or (reference_row and
                           book.cover == cents(reference_row["price"] or "") and
                           book.fair == cents(reference_row["price_discount"] or "")))):
                    audit("Preço preenchido", book, row)
                    write_prices(row, book.cover if old_cover is None else old_cover,
                                 book.fair if old_fair is None else old_fair)
                else:
                    audit("Coincide" if book.fair is not None and old_fair == book.fair else "Preço incompleto", book, row)
                continue
            if conflicting_pdf:
                continue
            if valid_isbn(book.isbn) and global_editions[book.isbn]:
                audit("ISBN em outra editora", book, global_editions[book.isbn][0])
                continue
            # The integrated catalogue supplies missing fields only when the PDF identifies the same edition.
            cover = book.cover or (cents(reference_row["price"] or "") if reference_row else None)
            fair = book.fair or (cents(reference_row["price_discount"] or "") if reference_row else None)
            if ((not valid_isbn(book.isbn) and not reference_code_verified) or not book.title or not cover
                    or (fair is not None and not 0 < fair <= cover)
                    or (book.uncertain_layout and not reference_row)):
                audit("Novo registro para revisão", book)
                continue
            row = {ISBN: book.isbn, TITLE: book.title, AUTHOR: book.author, PUBLISHER: name, SUBJECT: book.subject, LINK: book.link}
            classification = known_subjects.get(normalized(book.subject))
            values = classification.most_common(1)[0][0] if classification and len(classification) == 1 else ("A classificar", "", "")
            row.update(zip(CLASS_FIELDS[:3], values))
            row[CLASS_FIELDS[3]] = "Quadrinhos" if re.search(r"\bquadrinhos\b", normalized(book.title)) else ""
            row[CLASS_FIELDS[4]] = "Revisar" if values[0] == "A classificar" else "Assunto"
            write_prices(row, cover, fair)
            current.append(row)
            editions[pub, book.isbn].append(row)
            global_editions[book.isbn].append(row)
            titles[pub, normalized(book.title)].append(row)
            if fair is None:
                audit("Adicionado sem preço de feira", book)
            elif (pdf_cover, pdf_fair) != (cover, fair):
                audit("Adicionado com preço da busca oficial", book)
            else:
                audit("Adicionado", book)
        stats.append({"Editora": name, "Arquivo": publisher["arquivo"], "Páginas": pages,
                      "ISBNs detectados": candidates, "Linhas extraídas": len(extracted),
                      "Linhas com preço de feira": sum(book.fair is not None for book in extracted), **result,
                      "Observação": "" if extracted else "Layout sem extração confiável"})
        print(f"{name}: {len(extracted)} extraídos; {sum(n for status, n in result.items() if status.startswith('Adicionado'))} novos", flush=True)
    return stats, differences
