"""Campos compartilhados pelos CSVs e pelo catálogo do site."""


TITLE, AUTHOR, PUBLISHER, ISBN = "Titulo", "Autores", "Editora", "ISBN ou codigo"
SUBJECT, COVER, FAIR = "Assunto", "Preco de capa publicado", "Preco de feira publicado"
FAIR_NUMBER, DISCOUNT, LINK = "Preco de feira (R$)", "Desconto (%)", "Link"
CLASS_FIELDS = ("Tema principal", "Temas", "Subtemas", "Formato identificado", "Origem da classificação")
BASE_FIELDS = (ISBN, TITLE, AUTHOR, PUBLISHER, SUBJECT, COVER, FAIR, FAIR_NUMBER, DISCOUNT, LINK)
APP_FIELDS = (TITLE, AUTHOR, PUBLISHER, ISBN, SUBJECT, FAIR_NUMBER, DISCOUNT, LINK, *CLASS_FIELDS, COVER)
AUDIT_FIELDS = ("Status", PUBLISHER, ISBN, TITLE, "Capa na base", "Capa no PDF",
                "Feira na base", "Feira no PDF", "Página", "Lista oficial")
