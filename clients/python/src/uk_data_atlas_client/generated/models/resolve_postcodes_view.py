from enum import StrEnum


class ResolvePostcodesView(StrEnum):
    COMPACT = "compact"
    FULL = "full"

    def __str__(self) -> str:
        return str(self.value)
