from enum import StrEnum


class GetMeasureObservationsInclude(StrEnum):
    AREA = "area"

    def __str__(self) -> str:
        return str(self.value)
