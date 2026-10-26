from enum import StrEnum


class PostcodeLookupBoundaryRule(StrEnum):
    INCLUDED = "included"

    def __str__(self) -> str:
        return str(self.value)
