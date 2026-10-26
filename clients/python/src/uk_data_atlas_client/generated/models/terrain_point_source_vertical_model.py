from enum import StrEnum


class TerrainPointSourceVerticalModel(StrEnum):
    OSGM15 = "OSGM15"

    def __str__(self) -> str:
        return str(self.value)
