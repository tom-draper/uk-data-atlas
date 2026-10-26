from enum import StrEnum


class ConversionNotAvailableProblemCode(StrEnum):
    CONVERSION_NOT_AVAILABLE = "conversion_not_available"

    def __str__(self) -> str:
        return str(self.value)
