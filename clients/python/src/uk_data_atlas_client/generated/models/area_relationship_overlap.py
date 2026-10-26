from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaRelationshipOverlap")


@_attrs_define
class AreaRelationshipOverlap:
    """Present only for `overlaps` relationships. Each share is seen from this area's side: `shareOfArea` is the overlap as
    a share of this area and `shareOfCounterpart` as a share of the counterpart.

        Attributes:
            area_m2 (int):
            share_of_area (float):
            share_of_counterpart (float):
    """

    area_m2: int
    share_of_area: float
    share_of_counterpart: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_m2 = self.area_m2

        share_of_area = self.share_of_area

        share_of_counterpart = self.share_of_counterpart

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaM2": area_m2,
                "shareOfArea": share_of_area,
                "shareOfCounterpart": share_of_counterpart,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        area_m2 = d.pop("areaM2")

        share_of_area = d.pop("shareOfArea")

        share_of_counterpart = d.pop("shareOfCounterpart")

        area_relationship_overlap = cls(
            area_m2=area_m2,
            share_of_area=share_of_area,
            share_of_counterpart=share_of_counterpart,
        )

        area_relationship_overlap.additional_properties = d
        return area_relationship_overlap

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
