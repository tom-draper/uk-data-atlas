from enum import StrEnum


class MapResourceTilesTileFormat(StrEnum):
    MVT_2_1 = "mvt-2.1"

    def __str__(self) -> str:
        return str(self.value)
