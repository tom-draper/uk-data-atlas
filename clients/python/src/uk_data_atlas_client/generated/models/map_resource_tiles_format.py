from enum import StrEnum


class MapResourceTilesFormat(StrEnum):
    PMTILES_3 = "pmtiles-3"

    def __str__(self) -> str:
        return str(self.value)
