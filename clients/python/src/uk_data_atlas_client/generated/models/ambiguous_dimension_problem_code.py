from enum import StrEnum


class AmbiguousDimensionProblemCode(StrEnum):
    AMBIGUOUS_DIMENSION = "ambiguous_dimension"

    def __str__(self) -> str:
        return str(self.value)
