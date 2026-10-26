from enum import StrEnum


class TerrainPointSourceCrs(StrEnum):
    EPSG27700 = "EPSG:27700"

    def __str__(self) -> str:
        return str(self.value)
