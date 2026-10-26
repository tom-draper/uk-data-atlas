from enum import StrEnum


class CrosswalkEndpointValidationType1Status(StrEnum):
    NOT_AVAILABLE = "not-available"

    def __str__(self) -> str:
        return str(self.value)
