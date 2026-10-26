from enum import StrEnum


class TerrainPointSourceCoverageKind(StrEnum):
    BBOX = "bbox"

    def __str__(self) -> str:
        return str(self.value)
