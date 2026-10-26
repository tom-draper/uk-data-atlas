from enum import StrEnum


class AmbiguousReleaseProblemCode(StrEnum):
    AMBIGUOUS_RELEASE = "ambiguous_release"

    def __str__(self) -> str:
        return str(self.value)
