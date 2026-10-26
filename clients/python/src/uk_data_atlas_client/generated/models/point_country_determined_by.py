from enum import StrEnum


class PointCountryDeterminedBy(StrEnum):
    AREA_CODE = "area-code"
    COUNTRY_BOUNDARY = "country-boundary"
    UNDETERMINED = "undetermined"

    def __str__(self) -> str:
        return str(self.value)
