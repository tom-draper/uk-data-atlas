from enum import StrEnum


class TerrainPointSourceHorizontalDatum(StrEnum):
    OSGB36 = "OSGB36"

    def __str__(self) -> str:
        return str(self.value)
