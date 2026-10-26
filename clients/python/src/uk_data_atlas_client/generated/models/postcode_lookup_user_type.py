from enum import StrEnum


class PostcodeLookupUserType(StrEnum):
    LARGE = "large"
    SMALL = "small"

    def __str__(self) -> str:
        return str(self.value)
