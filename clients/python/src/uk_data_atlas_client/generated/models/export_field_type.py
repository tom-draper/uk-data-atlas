from enum import StrEnum


class ExportFieldType(StrEnum):
    NUMBER = "number"
    OBJECT = "object"
    STRING = "string"

    def __str__(self) -> str:
        return str(self.value)
