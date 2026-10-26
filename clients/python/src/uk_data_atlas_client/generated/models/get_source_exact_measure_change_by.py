from enum import StrEnum


class GetSourceExactMeasureChangeBy(StrEnum):
    ABSOLUTE = "absolute"
    RELATIVE = "relative"

    def __str__(self) -> str:
        return str(self.value)
