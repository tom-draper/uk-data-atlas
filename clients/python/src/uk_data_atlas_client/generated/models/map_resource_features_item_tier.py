from enum import StrEnum


class MapResourceFeaturesItemTier(StrEnum):
    FULL = "full"
    HIGH = "high"
    LOW = "low"
    MEDIUM = "medium"

    def __str__(self) -> str:
        return str(self.value)
