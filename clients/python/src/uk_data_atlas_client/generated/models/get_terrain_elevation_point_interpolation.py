from enum import StrEnum


class GetTerrainElevationPointInterpolation(StrEnum):
    BILINEAR = "bilinear"
    NEAREST = "nearest"

    def __str__(self) -> str:
        return str(self.value)
