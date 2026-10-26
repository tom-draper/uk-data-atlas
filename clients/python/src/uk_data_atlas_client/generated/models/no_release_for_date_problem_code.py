from enum import StrEnum


class NoReleaseForDateProblemCode(StrEnum):
    NO_RELEASE_FOR_DATE = "no_release_for_date"

    def __str__(self) -> str:
        return str(self.value)
