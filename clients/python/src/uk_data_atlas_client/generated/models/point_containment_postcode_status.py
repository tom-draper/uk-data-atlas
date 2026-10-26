from enum import StrEnum


class PointContainmentPostcodeStatus(StrEnum):
    LIVE = "live"
    TERMINATED = "terminated"

    def __str__(self) -> str:
        return str(self.value)
