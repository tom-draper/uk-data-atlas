from enum import StrEnum


class TerrainPointStatus(StrEnum):
    NODATA = "nodata"
    OK = "ok"
    OUTSIDE_COVERAGE = "outside_coverage"

    def __str__(self) -> str:
        return str(self.value)
