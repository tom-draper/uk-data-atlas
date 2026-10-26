from enum import StrEnum


class NearestAreasResultsItemStatus(StrEnum):
    AMBIGUOUS_RELEASE = "ambiguous-release"
    FOUND = "found"
    GEOMETRY_UNAVAILABLE = "geometry-unavailable"
    NONE_WITHIN = "none-within"
    NO_RELEASE_FOR_DATE = "no-release-for-date"

    def __str__(self) -> str:
        return str(self.value)
