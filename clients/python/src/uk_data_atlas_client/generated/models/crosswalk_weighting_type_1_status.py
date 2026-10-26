from enum import StrEnum


class CrosswalkWeightingType1Status(StrEnum):
    PROVIDED = "provided"

    def __str__(self) -> str:
        return str(self.value)
