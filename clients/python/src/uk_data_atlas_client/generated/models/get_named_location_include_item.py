from enum import StrEnum


class GetNamedLocationIncludeItem(StrEnum):
    CAPABILITIES = "capabilities"

    def __str__(self) -> str:
        return str(self.value)
