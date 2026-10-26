from enum import StrEnum


class AreaGeometryType(StrEnum):
    FEATURE = "Feature"

    def __str__(self) -> str:
        return str(self.value)
