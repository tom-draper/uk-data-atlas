from enum import StrEnum


class CrosswalkWeightingType2Basis(StrEnum):
    POPULATION = "population"

    def __str__(self) -> str:
        return str(self.value)
