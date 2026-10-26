from enum import StrEnum


class IncompatibleGeometryProblemCode(StrEnum):
    INCOMPATIBLE_GEOMETRY = "incompatible_geometry"

    def __str__(self) -> str:
        return str(self.value)
