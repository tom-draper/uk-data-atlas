from enum import StrEnum


class PostcodeBatchBoundaryRule(StrEnum):
    INCLUDED = "included"

    def __str__(self) -> str:
        return str(self.value)
