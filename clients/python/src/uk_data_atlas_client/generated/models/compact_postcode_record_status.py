from enum import StrEnum


class CompactPostcodeRecordStatus(StrEnum):
    LIVE = "live"
    TERMINATED = "terminated"

    def __str__(self) -> str:
        return str(self.value)
