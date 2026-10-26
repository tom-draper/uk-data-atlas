from enum import StrEnum


class CrosswalkEndpointValidationType0Status(StrEnum):
    VERIFIED = "verified"

    def __str__(self) -> str:
        return str(self.value)
