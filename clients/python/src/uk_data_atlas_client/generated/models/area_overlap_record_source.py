from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaOverlapRecordSource")


@_attrs_define
class AreaOverlapRecordSource:
    """
    Attributes:
        code (str):
        labels (list[str]): Non-canonical name candidates. More than one entry means the source disagreed with itself
            about this area's name; it is not an alias list to pick from arbitrarily.
        area_m2 (int):
        coverage (float): Share of the source's area covered by its targets.
    """

    code: str
    labels: list[str]
    area_m2: int
    coverage: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        labels = self.labels

        area_m2 = self.area_m2

        coverage = self.coverage

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "labels": labels,
                "areaM2": area_m2,
                "coverage": coverage,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        labels = cast(list[str], d.pop("labels"))

        area_m2 = d.pop("areaM2")

        coverage = d.pop("coverage")

        area_overlap_record_source = cls(
            code=code,
            labels=labels,
            area_m2=area_m2,
            coverage=coverage,
        )

        area_overlap_record_source.additional_properties = d
        return area_overlap_record_source

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
