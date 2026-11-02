from enum import StrEnum


class NoMatchingSeriesProblemCode(StrEnum):
    NO_MATCHING_SERIES = "no_matching_series"

    def __str__(self) -> str:
        return str(self.value)
