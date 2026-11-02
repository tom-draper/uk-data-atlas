from enum import StrEnum


class UnknownDimensionProblemCode(StrEnum):
    UNKNOWN_DIMENSION = "unknown_dimension"

    def __str__(self) -> str:
        return str(self.value)
