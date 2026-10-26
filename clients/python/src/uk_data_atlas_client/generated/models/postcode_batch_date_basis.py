from enum import StrEnum


class PostcodeBatchDateBasis(StrEnum):
    DIRECTORY_EDITION = "directory-edition"
    REQUESTED = "requested"

    def __str__(self) -> str:
        return str(self.value)
