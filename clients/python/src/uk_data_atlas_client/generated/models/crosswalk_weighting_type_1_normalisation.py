from enum import StrEnum


class CrosswalkWeightingType1Normalisation(StrEnum):
    PER_SOURCE = "per-source"

    def __str__(self) -> str:
        return str(self.value)
