from enum import StrEnum


class EnvelopeApiVersion(StrEnum):
    V1 = "v1"

    def __str__(self) -> str:
        return str(self.value)
