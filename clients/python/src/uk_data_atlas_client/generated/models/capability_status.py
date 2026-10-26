from enum import StrEnum


class CapabilityStatus(StrEnum):
    AVAILABLE = "available"
    NOT_BUILT = "not-built"
    PARTIAL = "partial"
    REQUIRES_CONVERSION = "requires-conversion"
    UNSUPPORTED = "unsupported"

    def __str__(self) -> str:
        return str(self.value)
