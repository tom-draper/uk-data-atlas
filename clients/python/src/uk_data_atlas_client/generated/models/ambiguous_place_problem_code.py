from enum import StrEnum


class AmbiguousPlaceProblemCode(StrEnum):
    AMBIGUOUS_PLACE = "ambiguous_place"

    def __str__(self) -> str:
        return str(self.value)
