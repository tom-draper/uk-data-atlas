from enum import StrEnum


class SuppliedCountConversionEnvelopeDataRecordsItemStatus(StrEnum):
    DERIVED = "derived"

    def __str__(self) -> str:
        return str(self.value)
