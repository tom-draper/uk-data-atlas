from enum import StrEnum


class CoordinateConversionTargetCoordinateConversionGridCrs(StrEnum):
    EPSG27700 = "EPSG:27700"
    EPSG29902 = "EPSG:29902"

    def __str__(self) -> str:
        return str(self.value)
