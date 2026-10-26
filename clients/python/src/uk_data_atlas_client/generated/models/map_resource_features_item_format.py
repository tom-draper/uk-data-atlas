from enum import StrEnum


class MapResourceFeaturesItemFormat(StrEnum):
    GEOJSON = "geojson"
    GEOPARQUET_1_1 = "geoparquet-1.1"

    def __str__(self) -> str:
        return str(self.value)
