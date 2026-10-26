from enum import StrEnum


class RelationshipCandidateEndpointStatusType0Status(StrEnum):
    VERIFIED = "verified"

    def __str__(self) -> str:
        return str(self.value)
