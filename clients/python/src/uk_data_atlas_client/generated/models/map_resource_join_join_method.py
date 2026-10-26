from enum import StrEnum


class MapResourceJoinJoinMethod(StrEnum):
    CODE_MATCH = "code-match"

    def __str__(self) -> str:
        return str(self.value)
