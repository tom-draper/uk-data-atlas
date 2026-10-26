from enum import StrEnum


class CompactPostcodeBatchPostcodesItemStatus(StrEnum):
    INVALID = "invalid"
    NOT_FOUND = "not-found"
    NOT_PLACED = "not-placed"
    NOT_SERVED = "not-served"
    PLACED = "placed"

    def __str__(self) -> str:
        return str(self.value)
