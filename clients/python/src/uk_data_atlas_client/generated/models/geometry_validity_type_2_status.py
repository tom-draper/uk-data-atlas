from enum import StrEnum


class GeometryValidityType2Status(StrEnum):
    NOT_CHECKED = "not-checked"

    def __str__(self) -> str:
        return str(self.value)
