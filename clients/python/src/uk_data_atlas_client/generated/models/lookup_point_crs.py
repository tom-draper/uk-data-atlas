from enum import StrEnum


class LookupPointCrs(StrEnum):
    EPSG4326 = "EPSG:4326"

    def __str__(self) -> str:
        return str(self.value)
