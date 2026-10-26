from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_relationship_relation import AreaRelationshipRelation
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_relationship_counterpart import AreaRelationshipCounterpart
    from ..models.area_relationship_crosswalk import AreaRelationshipCrosswalk
    from ..models.area_relationship_overlap import AreaRelationshipOverlap


T = TypeVar("T", bound="AreaRelationship")


@_attrs_define
class AreaRelationship:
    """
    Attributes:
        counterpart (AreaRelationshipCounterpart):
        crosswalk (AreaRelationshipCrosswalk):
        relation (AreaRelationshipRelation):
        overlap (AreaRelationshipOverlap | Unset): Present only for `overlaps` relationships. Each share is seen from
            this area's side: `shareOfArea` is the overlap as a share of this area and `shareOfCounterpart` as a share of
            the counterpart.
    """

    counterpart: AreaRelationshipCounterpart
    crosswalk: AreaRelationshipCrosswalk
    relation: AreaRelationshipRelation
    overlap: AreaRelationshipOverlap | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        counterpart = self.counterpart.to_dict()

        crosswalk = self.crosswalk.to_dict()

        relation = self.relation.value

        overlap: dict[str, Any] | Unset = UNSET
        if not isinstance(self.overlap, Unset):
            overlap = self.overlap.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "counterpart": counterpart,
                "crosswalk": crosswalk,
                "relation": relation,
            }
        )
        if overlap is not UNSET:
            field_dict["overlap"] = overlap

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_relationship_counterpart import AreaRelationshipCounterpart
        from ..models.area_relationship_crosswalk import AreaRelationshipCrosswalk
        from ..models.area_relationship_overlap import AreaRelationshipOverlap

        d = dict(src_dict)
        counterpart = AreaRelationshipCounterpart.from_dict(d.pop("counterpart"))

        crosswalk = AreaRelationshipCrosswalk.from_dict(d.pop("crosswalk"))

        relation = AreaRelationshipRelation(d.pop("relation"))

        _overlap = d.pop("overlap", UNSET)
        overlap: AreaRelationshipOverlap | Unset
        if isinstance(_overlap, Unset):
            overlap = UNSET
        else:
            overlap = AreaRelationshipOverlap.from_dict(_overlap)

        area_relationship = cls(
            counterpart=counterpart,
            crosswalk=crosswalk,
            relation=relation,
            overlap=overlap,
        )

        area_relationship.additional_properties = d
        return area_relationship

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
