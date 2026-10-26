from enum import StrEnum


class PlaceNotServedProblemCode(StrEnum):
    PLACE_NOT_SERVED = "place_not_served"

    def __str__(self) -> str:
        return str(self.value)
