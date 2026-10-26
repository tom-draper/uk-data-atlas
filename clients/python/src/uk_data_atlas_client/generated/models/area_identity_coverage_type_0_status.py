from enum import StrEnum


class AreaIdentityCoverageType0Status(StrEnum):
    AVAILABLE = "available"

    def __str__(self) -> str:
        return str(self.value)
