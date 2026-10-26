from enum import StrEnum


class AreaIdentityCoverageType1Status(StrEnum):
    UNSUPPORTED = "unsupported"

    def __str__(self) -> str:
        return str(self.value)
