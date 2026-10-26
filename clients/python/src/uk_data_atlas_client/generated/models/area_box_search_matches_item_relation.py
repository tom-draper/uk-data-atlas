from enum import StrEnum


class AreaBoxSearchMatchesItemRelation(StrEnum):
    OVERLAPS = "overlaps"
    WITHIN = "within"

    def __str__(self) -> str:
        return str(self.value)
