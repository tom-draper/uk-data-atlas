from enum import StrEnum


class PointContainmentBoundaryRule(StrEnum):
    INCLUDED = "included"

    def __str__(self) -> str:
        return str(self.value)
