from enum import StrEnum


class GetAreaNeighboursTouches(StrEnum):
    ANY = "any"
    EDGE = "edge"

    def __str__(self) -> str:
        return str(self.value)
