from enum import StrEnum


class RelationshipCandidateStatus(StrEnum):
    ELIGIBLE = "eligible"
    NEEDS_REVIEW = "needs-review"
    NOT_AVAILABLE = "not-available"

    def __str__(self) -> str:
        return str(self.value)
