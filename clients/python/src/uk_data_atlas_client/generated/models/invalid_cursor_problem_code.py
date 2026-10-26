from enum import StrEnum


class InvalidCursorProblemCode(StrEnum):
    INVALID_CURSOR = "invalid_cursor"

    def __str__(self) -> str:
        return str(self.value)
