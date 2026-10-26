from enum import StrEnum


class UnsupportedGeographyProblemCode(StrEnum):
    UNSUPPORTED_GEOGRAPHY = "unsupported_geography"

    def __str__(self) -> str:
        return str(self.value)
