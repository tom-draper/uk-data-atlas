from enum import StrEnum


class ValidationResourceStatus(StrEnum):
    PASSED = "passed"
    WAIVED = "waived"

    def __str__(self) -> str:
        return str(self.value)
