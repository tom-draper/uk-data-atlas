from enum import StrEnum


class GeometryValidityType0Status(StrEnum):
    VALID = "valid"

    def __str__(self) -> str:
        return str(self.value)
