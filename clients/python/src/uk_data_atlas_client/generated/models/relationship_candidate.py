from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.relationship_candidate_status import RelationshipCandidateStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.relationship_candidate_side import RelationshipCandidateSide
    from ..models.relationship_candidate_target import RelationshipCandidateTarget
    from ..models.relationship_candidate_validation import (
        RelationshipCandidateValidation,
    )


T = TypeVar("T", bound="RelationshipCandidate")


@_attrs_define
class RelationshipCandidate:
    """
    Attributes:
        from_ (RelationshipCandidateSide):
        id (str):
        input_ (str):
        status (RelationshipCandidateStatus):
        to (RelationshipCandidateTarget): `boundaryRelease` (and sometimes `geography`) are present only when exactly
            one compiled area release already uses this code/name property pair.
        validation (RelationshipCandidateValidation):
        published_crosswalk_id (str | Unset): Set when a published crosswalk already covers this candidate.
    """

    from_: RelationshipCandidateSide
    id: str
    input_: str
    status: RelationshipCandidateStatus
    to: RelationshipCandidateTarget
    validation: RelationshipCandidateValidation
    published_crosswalk_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_.to_dict()

        id = self.id

        input_ = self.input_

        status = self.status.value

        to = self.to.to_dict()

        validation = self.validation.to_dict()

        published_crosswalk_id = self.published_crosswalk_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "from": from_,
                "id": id,
                "input": input_,
                "status": status,
                "to": to,
                "validation": validation,
            }
        )
        if published_crosswalk_id is not UNSET:
            field_dict["publishedCrosswalkId"] = published_crosswalk_id

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.relationship_candidate_side import RelationshipCandidateSide
        from ..models.relationship_candidate_target import RelationshipCandidateTarget
        from ..models.relationship_candidate_validation import (
            RelationshipCandidateValidation,
        )

        d = dict(src_dict)
        from_ = RelationshipCandidateSide.from_dict(d.pop("from"))

        id = d.pop("id")

        input_ = d.pop("input")

        status = RelationshipCandidateStatus(d.pop("status"))

        to = RelationshipCandidateTarget.from_dict(d.pop("to"))

        validation = RelationshipCandidateValidation.from_dict(d.pop("validation"))

        published_crosswalk_id = d.pop("publishedCrosswalkId", UNSET)

        relationship_candidate = cls(
            from_=from_,
            id=id,
            input_=input_,
            status=status,
            to=to,
            validation=validation,
            published_crosswalk_id=published_crosswalk_id,
        )

        relationship_candidate.additional_properties = d
        return relationship_candidate

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
