from enum import StrEnum


class TerrainPointSourceHorizontalTransformation(StrEnum):
    OSTN15 = "OSTN15"

    def __str__(self) -> str:
        return str(self.value)
