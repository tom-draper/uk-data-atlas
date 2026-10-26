from enum import IntEnum


class UnknownReleaseProblemStatus(IntEnum):
    VALUE_404 = 404

    def __str__(self) -> str:
        return str(self.value)
