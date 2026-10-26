from enum import StrEnum


class GeometryValidityType1Status(StrEnum):
    INVALID = "invalid"

    def __str__(self) -> str:
        return str(self.value)
