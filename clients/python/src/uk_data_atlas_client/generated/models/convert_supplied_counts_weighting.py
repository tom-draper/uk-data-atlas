from enum import StrEnum


class ConvertSuppliedCountsWeighting(StrEnum):
    AREA = "area"
    POPULATION = "population"

    def __str__(self) -> str:
        return str(self.value)
