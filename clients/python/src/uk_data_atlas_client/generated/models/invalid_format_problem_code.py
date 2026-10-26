from enum import StrEnum


class InvalidFormatProblemCode(StrEnum):
    INVALID_FORMAT = "invalid_format"

    def __str__(self) -> str:
        return str(self.value)
