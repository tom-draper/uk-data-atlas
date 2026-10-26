from enum import StrEnum


class MapResourceTopology(StrEnum):
    SHARED_ARC = "shared-arc"

    def __str__(self) -> str:
        return str(self.value)
