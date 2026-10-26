from enum import StrEnum


class FindContainingAreasCrs(StrEnum):
    EPSG27700 = "EPSG:27700"
    EPSG29902 = "EPSG:29902"
    EPSG4326 = "EPSG:4326"

    def __str__(self) -> str:
        return str(self.value)
