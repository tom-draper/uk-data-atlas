from enum import StrEnum


class LookupManifestLookupsItemColumnsItemType(StrEnum):
    NUMBER = "number"
    STRING = "string[]"

    def __str__(self) -> str:
        return str(self.value)
