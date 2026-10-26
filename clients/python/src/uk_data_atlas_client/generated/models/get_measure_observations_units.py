from enum import StrEnum


class GetMeasureObservationsUnits(StrEnum):
    CANONICAL = "canonical"
    SOURCE = "source"

    def __str__(self) -> str:
        return str(self.value)
