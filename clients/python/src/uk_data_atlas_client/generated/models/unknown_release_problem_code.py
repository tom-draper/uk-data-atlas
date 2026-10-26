from enum import StrEnum


class UnknownReleaseProblemCode(StrEnum):
    UNKNOWN_RELEASE = "unknown_release"

    def __str__(self) -> str:
        return str(self.value)
