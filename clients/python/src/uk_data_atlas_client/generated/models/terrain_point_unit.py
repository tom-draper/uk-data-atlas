from enum import StrEnum


class TerrainPointUnit(StrEnum):
    METRES = "metres"

    def __str__(self) -> str:
        return str(self.value)
