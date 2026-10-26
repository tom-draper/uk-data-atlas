from enum import StrEnum


class GetMapResourceFeaturesFormat(StrEnum):
    GEOJSON = "geojson"
    GEOPARQUET = "geoparquet"

    def __str__(self) -> str:
        return str(self.value)
