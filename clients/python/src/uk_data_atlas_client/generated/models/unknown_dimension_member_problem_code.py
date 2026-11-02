from enum import StrEnum


class UnknownDimensionMemberProblemCode(StrEnum):
    UNKNOWN_DIMENSION_MEMBER = "unknown_dimension_member"

    def __str__(self) -> str:
        return str(self.value)
