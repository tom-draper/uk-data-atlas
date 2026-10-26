from enum import StrEnum


class TerrainPointInterpolation(StrEnum):
    BILINEAR = "bilinear"
    NEAREST = "nearest"

    def __str__(self) -> str:
        return str(self.value)
