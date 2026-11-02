from enum import StrEnum


class ConflictingDimensionFilterProblemCode(StrEnum):
    CONFLICTING_DIMENSION_FILTER = "conflicting_dimension_filter"

    def __str__(self) -> str:
        return str(self.value)
