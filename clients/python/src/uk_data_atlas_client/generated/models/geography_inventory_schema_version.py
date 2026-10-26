from enum import IntEnum


class GeographyInventorySchemaVersion(IntEnum):
    VALUE_1 = 1

    def __str__(self) -> str:
        return str(self.value)
