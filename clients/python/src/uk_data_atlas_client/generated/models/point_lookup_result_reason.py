from enum import StrEnum


class PointLookupResultReason(StrEnum):
    COUNTRY_NOT_COVERED = "country-not-covered"
    OUTSIDE_UK_BOUNDARIES = "outside-uk-boundaries"

    def __str__(self) -> str:
        return str(self.value)
