from enum import StrEnum


class ConvertSuppliedCountsSemantics(StrEnum):
    COUNT = "count"

    def __str__(self) -> str:
        return str(self.value)
