from enum import StrEnum


class AreaMetricsLabelPointMethod(StrEnum):
    CENTROID = "centroid"
    INTERIOR_SPAN = "interior-span"

    def __str__(self) -> str:
        return str(self.value)
