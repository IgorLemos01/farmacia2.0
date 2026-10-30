from flask_restx import fields


class TextoOpcional(fields.String):
    """Texto opcional que também aceita null (o frontend envia null para campos vazios)."""

    __schema_type__ = ["string", "null"]


class NumeroOpcional(fields.Float):
    """Número opcional que também aceita null."""

    __schema_type__ = ["number", "null"]
