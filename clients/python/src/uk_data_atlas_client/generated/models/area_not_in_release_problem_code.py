from enum import StrEnum


class AreaNotInReleaseProblemCode(StrEnum):
    AREA_NOT_IN_RELEASE = "area_not_in_release"

    def __str__(self) -> str:
        return str(self.value)
