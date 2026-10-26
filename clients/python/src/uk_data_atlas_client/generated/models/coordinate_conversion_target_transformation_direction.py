from enum import StrEnum


class CoordinateConversionTargetTransformationDirection(StrEnum):
    INVERSE = "inverse"

    def __str__(self) -> str:
        return str(self.value)
