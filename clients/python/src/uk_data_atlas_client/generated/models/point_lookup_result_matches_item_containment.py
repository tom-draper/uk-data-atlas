from enum import StrEnum


class PointLookupResultMatchesItemContainment(StrEnum):
    BOUNDARY = "boundary"
    INTERIOR = "interior"

    def __str__(self) -> str:
        return str(self.value)
