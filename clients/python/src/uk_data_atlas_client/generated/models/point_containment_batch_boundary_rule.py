from enum import StrEnum


class PointContainmentBatchBoundaryRule(StrEnum):
    INCLUDED = "included"

    def __str__(self) -> str:
        return str(self.value)
