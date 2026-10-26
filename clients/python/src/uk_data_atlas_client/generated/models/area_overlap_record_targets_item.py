from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaOverlapRecordTargetsItem")


@_attrs_define
class AreaOverlapRecordTargetsItem:
    """
    Attributes:
        code (str):
        labels (list[str]): Non-canonical name candidates. More than one entry means the source disagreed with itself
            about this area's name; it is not an alias list to pick from arbitrarily.
        overlap_area_m2 (int):
        source_share (float): Overlap as a share of the whole source area.
        target_share (float): Overlap as a share of the whole target area.
        weight (float): Share of the source's covered area. A record's weights sum to 1 within rounding, so they
            apportion a whole source quantity across its targets.
    """

    code: str
    labels: list[str]
    overlap_area_m2: int
    source_share: float
    target_share: float
    weight: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        labels = self.labels

        overlap_area_m2 = self.overlap_area_m2

        source_share = self.source_share

        target_share = self.target_share

        weight = self.weight

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "labels": labels,
                "overlapAreaM2": overlap_area_m2,
                "sourceShare": source_share,
                "targetShare": target_share,
                "weight": weight,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        labels = cast(list[str], d.pop("labels"))

        overlap_area_m2 = d.pop("overlapAreaM2")

        source_share = d.pop("sourceShare")

        target_share = d.pop("targetShare")

        weight = d.pop("weight")

        area_overlap_record_targets_item = cls(
            code=code,
            labels=labels,
            overlap_area_m2=overlap_area_m2,
            source_share=source_share,
            target_share=target_share,
            weight=weight,
        )

        area_overlap_record_targets_item.additional_properties = d
        return area_overlap_record_targets_item

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
