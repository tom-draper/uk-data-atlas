from enum import StrEnum


class TerrainPointSourceVerticalDatum(StrEnum):
    ODN = "ODN"

    def __str__(self) -> str:
        return str(self.value)
