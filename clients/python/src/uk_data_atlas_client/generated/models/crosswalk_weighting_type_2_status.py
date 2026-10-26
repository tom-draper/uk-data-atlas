from enum import StrEnum


class CrosswalkWeightingType2Status(StrEnum):
    PROVIDED = "provided"

    def __str__(self) -> str:
        return str(self.value)
