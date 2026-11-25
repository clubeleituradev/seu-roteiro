"""Cruza os PDFs oficiais com a base local e gera relatórios para revisão."""

import argparse
import json
from collections import Counter
from pathlib import Path

from catalogo.arquivos import load_reference, read_csv, read_json, write_catalog, write_reports
from catalogo.campos import COVER, DISCOUNT, FAIR_NUMBER
from catalogo.normalizacao import normalized
from catalogo.reconciliacao import reconciliation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listas", type=Path, required=True, help="Pasta dos PDFs e do manifesto.json")
    parser.add_argument("--dados", type=Path, default=Path("dados"), help="Pasta da base local")
    parser.add_argument("--editora", action="append", default=[], help="Limitar a uma editora para testar. Pode repetir.")
    parser.add_argument("--referencia", type=Path, help="JSON opcional com os livros da busca oficial, para validar metadados e preços ausentes")
    parser.add_argument("--aplicar", action="store_true", help="Atualizar também os CSVs e os dados do app")
    args = parser.parse_args()
    manifest = read_json(args.listas / "manifesto.json")
    current = read_csv(args.dados / "livros-feira-usp-2026-classificados.csv")
    original_count = len(current)
    original_prices = [[row[field] for field in (FAIR_NUMBER, DISCOUNT, COVER)] for row in current]
    reference, reference_titles = load_reference(args.referencia)
    stats, audit = reconciliation(current, manifest, args.listas, {normalized(name) for name in args.editora},
                                  reference, reference_titles)
    write_reports(args.listas, stats, audit)
    if args.aplicar:
        write_catalog(args.dados, args.listas.name, current, original_prices, manifest)
    print(json.dumps({"listas": len(stats), "linhas_extraidas": sum(row.get("Linhas extraídas", 0) for row in stats),
                      "novos": len(current) - original_count, "base": len(current), "aplicado": args.aplicar,
                      "resultados": dict(Counter(row["Status"] for row in audit))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
