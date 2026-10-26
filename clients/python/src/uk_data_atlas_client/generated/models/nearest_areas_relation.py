from enum import StrEnum


class NearestAreasRelation(StrEnum):
    DISTANCE = "distance"

    def __str__(self) -> str:
        return str(self.value)
