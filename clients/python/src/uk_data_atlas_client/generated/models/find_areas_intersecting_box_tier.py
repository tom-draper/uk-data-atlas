from enum import StrEnum


class FindAreasIntersectingBoxTier(StrEnum):
    FULL = "full"
    HIGH = "high"
    LOW = "low"
    MEDIUM = "medium"

    def __str__(self) -> str:
        return str(self.value)
