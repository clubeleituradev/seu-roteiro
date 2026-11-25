"""Leitura e gravação dos dados, das referências e dos relatórios."""

import csv
import json
import re
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from .campos import (
    APP_FIELDS, AUDIT_FIELDS, BASE_FIELDS, CLASS_FIELDS, COVER, DISCOUNT,
    FAIR_NUMBER, PUBLISHER,
)
from .normalizacao import isbn_key, normalized, publisher_key, valid_isbn


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream, delimiter=";"))


def spreadsheet_safe(value):
    if value and value[0] in "=+@-" and not value[1:].isdigit():
        return "'" + value
    return value


def csv_text(rows, fields):
    stream = StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields, delimiter=";", quoting=csv.QUOTE_ALL)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: spreadsheet_safe(str(row.get(field, ""))) for field in fields})
    return "\ufeff" + stream.getvalue()


def atomic_write(path, text):
    with NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(text.encode("utf-8"))
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def js_rows(rows):
    return "[\n  " + ",\n  ".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n]"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_reference(path):
    reference = {}
    reference_titles = {}
    if path:
        for item in read_json(path):
            publisher = publisher_key(item["publisher"] or "")
            title_key = publisher, normalized(item["name"] or "")
            reference_titles[title_key] = item if title_key not in reference_titles else None
            code = isbn_key(item["isbn"] or "")
            if valid_isbn(code):
                key = publisher, code
                reference[key] = item if key not in reference else None
    return reference, reference_titles


def write_reports(list_path, stats, audit):
    audit_status = sorted({row["Status"] for row in audit} | {"Coincide"})
    summary_fields = ("Editora", "Arquivo", "Páginas", "ISBNs detectados", "Linhas extraídas",
                      "Linhas com preço de feira", *audit_status, "Observação")
    atomic_write(list_path / "comparacao.csv", csv_text(audit, AUDIT_FIELDS))
    atomic_write(list_path / "cobertura.csv", csv_text(stats, summary_fields))


def write_catalog(data_path, snapshot, current, original_prices, manifest):
    original_count = len(original_prices)
    js_path = data_path / "catalogo.js"
    script = js_path.read_text(encoding="utf-8")
    catalog_section = re.compile(r"(const catalogRows = )\[[\s\S]*?\];(\s*const publisherRows = )\[[\s\S]*?\];")
    match = catalog_section.search(script)
    if not match:
        raise ValueError("Formato dos dados do app não reconhecido")
    existing_rows = json.loads(script[match.end(1):match.start(2)].rstrip().removesuffix(";"))
    existing_publishers = json.loads(script[match.end(2):match.end()].removesuffix(";"))
    if len(existing_rows) != original_count:
        raise ValueError("O CSV e o aplicativo precisam partir da mesma base")
    for index in range(original_count):
        for field, original in zip((FAIR_NUMBER, DISCOUNT, COVER), original_prices[index]):
            if current[index][field] != original:
                existing_rows[index][APP_FIELDS.index(field)] = current[index][field]
    app_rows = existing_rows + [[row.get(field, "") for field in APP_FIELDS] for row in current[original_count:]]
    names = {publisher_key(row[0]): row[0] for row in existing_publishers}
    names.update({publisher_key(row[PUBLISHER]): row[PUBLISHER] for row in reversed(current)})
    publishers = [[names.get(publisher_key(item["editora"]), item["editora"]), item["url"], item["site"]] for item in manifest]
    updated = (script[:match.start()] + match[1] + js_rows(app_rows)
               + ";" + match[2] + js_rows(publishers) + ";" + script[match.end():])
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", snapshot):
        note = "// Busca oficial complementada pelas listas de " + snapshot + "."
        updated = re.sub(r"^// (?:Snapshot do catálogo oficial|Busca oficial complementada)[^\n]*", note, updated, 1, re.M)
    atomic_write(data_path / "livros-feira-usp-2026.csv", csv_text(current, BASE_FIELDS))
    atomic_write(data_path / "livros-feira-usp-2026-classificados.csv", csv_text(current, (*BASE_FIELDS, *CLASS_FIELDS)))
    publisher_fields = ("Editora", "Lista oficial de precos", "Site")
    atomic_write(data_path / "editoras-feira-usp-2026.csv",
                 csv_text([dict(zip(publisher_fields, row)) for row in publishers], publisher_fields))
    atomic_write(js_path, updated)
