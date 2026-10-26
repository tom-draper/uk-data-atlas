from enum import StrEnum


class PostcodeLookupDateBasis(StrEnum):
    DIRECTORY_EDITION = "directory-edition"
    REQUESTED = "requested"

    def __str__(self) -> str:
        return str(self.value)
