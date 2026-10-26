from enum import StrEnum


class SuppliedCountConversionEnvelopeDataSemantics(StrEnum):
    COUNT = "count"

    def __str__(self) -> str:
        return str(self.value)
