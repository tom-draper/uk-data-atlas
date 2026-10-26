from enum import StrEnum


class CoordinateConversionTargetGridReferencePosition(StrEnum):
    CONTAINING_CELL = "containing-cell"

    def __str__(self) -> str:
        return str(self.value)
