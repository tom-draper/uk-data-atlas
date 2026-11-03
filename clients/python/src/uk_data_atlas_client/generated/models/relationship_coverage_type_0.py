from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.relationship_coverage_type_0_status import RelationshipCoverageType0Status

if TYPE_CHECKING:
    from ..models.geography_relationship import GeographyRelationship


T = TypeVar("T", bound="RelationshipCoverageType0")


@_attrs_define
class RelationshipCoverageType0:
    """
    Attributes:
        crosswalks (list[GeographyRelationship]):
        status (RelationshipCoverageType0Status):
    """

    crosswalks: list[GeographyRelationship]
    status: RelationshipCoverageType0Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crosswalks = []
        for crosswalks_item_data in self.crosswalks:
            crosswalks_item = crosswalks_item_data.to_dict()
            crosswalks.append(crosswalks_item)

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crosswalks": crosswalks,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geography_relationship import GeographyRelationship

        d = dict(src_dict)
        crosswalks = []
        _crosswalks = d.pop("crosswalks")
        for crosswalks_item_data in _crosswalks:
            crosswalks_item = GeographyRelationship.from_dict(crosswalks_item_data)

            crosswalks.append(crosswalks_item)

        status = RelationshipCoverageType0Status(d.pop("status"))

        relationship_coverage_type_0 = cls(
            crosswalks=crosswalks,
            status=status,
        )

        relationship_coverage_type_0.additional_properties = d
        return relationship_coverage_type_0

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
