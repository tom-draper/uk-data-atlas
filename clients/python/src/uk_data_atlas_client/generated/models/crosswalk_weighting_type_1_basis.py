from enum import StrEnum


class CrosswalkWeightingType1Basis(StrEnum):
    AREA = "area"

    def __str__(self) -> str:
        return str(self.value)
