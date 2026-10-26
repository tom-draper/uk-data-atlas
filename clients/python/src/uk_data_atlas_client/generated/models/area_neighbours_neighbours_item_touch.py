from enum import StrEnum


class AreaNeighboursNeighboursItemTouch(StrEnum):
    EDGE = "edge"
    POINT = "point"

    def __str__(self) -> str:
        return str(self.value)
