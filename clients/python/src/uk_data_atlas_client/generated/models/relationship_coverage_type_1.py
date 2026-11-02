from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.relationship_coverage_type_1_status import RelationshipCoverageType1Status

T = TypeVar("T", bound="RelationshipCoverageType1")


@_attrs_define
class RelationshipCoverageType1:
    """
    Attributes:
        reason (str):
        status (RelationshipCoverageType1Status):
    """

    reason: str
    status: RelationshipCoverageType1Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        reason = self.reason

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "reason": reason,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        reason = d.pop("reason")

        status = RelationshipCoverageType1Status(d.pop("status"))

        relationship_coverage_type_1 = cls(
            reason=reason,
            status=status,
        )

        relationship_coverage_type_1.additional_properties = d
        return relationship_coverage_type_1

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
