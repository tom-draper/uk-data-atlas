from enum import IntEnum


class AmbiguousPlaceProblemStatus(IntEnum):
    VALUE_409 = 409

    def __str__(self) -> str:
        return str(self.value)
