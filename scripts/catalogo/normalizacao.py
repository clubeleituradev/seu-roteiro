"""Normalização de títulos, editoras, ISBNs e valores monetários."""

import re
import unicodedata
from decimal import Decimal


ISBN_PREFIX = re.compile(r"^(97[89](?:-?\d){10})(?=[^\d]|$)")
MONEY = re.compile(r"(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?")


def normalized(text):
    plain = unicodedata.normalize("NFKD", text.casefold())
    return " ".join(re.findall(r"\w+", "".join(char for char in plain if not unicodedata.combining(char))))


def isbn_key(value):
    value = value.strip().strip("()")
    prefix = ISBN_PREFIX.match(value)
    if prefix:
        value = prefix[1]
    return re.sub(r"[\s-]", "", value).upper()


def valid_isbn(value):
    if re.fullmatch(r"97[89]\d{10}", value):
        return sum(int(digit) * (1 if index % 2 == 0 else 3)
                   for index, digit in enumerate(value)) % 10 == 0
    if re.fullmatch(r"\d{9}[\dX]", value):
        return sum((10 if digit == "X" else int(digit)) * (10 - index)
                   for index, digit in enumerate(value)) % 11 == 0
    return False


def cents(value):
    value = value.strip().strip("()").strip()
    if value.startswith("-") and value.endswith("-"):
        value = value[1:-1].strip()
    value = re.sub(r"^R\$\s*", "", value).strip()
    if re.fullmatch(r"\d+\.\d{1,2}", value):
        value = value.replace(".", ",")
    if not MONEY.fullmatch(value):
        return None
    return int(Decimal(value.replace(".", "").replace(",", ".")) * 100)


def decimal_text(value):
    return f"{value // 100},{value % 100:02}" if value is not None else ""


def price_text(value):
    return "R$ " + decimal_text(value) if value is not None else ""


def publisher_key(name):
    words = normalized(name).split()
    if words and words[0] in ("editora", "ed") and len(words) > 1:
        words.pop(0)
    if words and words[-1] == "editora" and len(words) > 1:
        words.pop()
    if words and words[-1] in ("grupo", "brasil") and len(words) > 1:
        words.pop()
    aliases = {
        "ufsc": "edufsc",
        "ufscar": "edufscar",
        "unicamp": "da unicamp",
        "grupo record": "record",
        "grupo aleph": "aleph",
        "atelie editorial": "atelie",
    }
    key = " ".join(words)
    return aliases.get(key, key)
