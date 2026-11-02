from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaMetricsMethod")


@_attrs_define
class AreaMetricsMethod:
    """The projection and rule behind each figure, carried with the response so a measurement can be read on its own.

    Attributes:
        area (str):
        caveat (str):
        centroid (str):
        label_point (str):
        perimeter (str):
    """

    area: str
    caveat: str
    centroid: str
    label_point: str
    perimeter: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area = self.area

        caveat = self.caveat

        centroid = self.centroid

        label_point = self.label_point

        perimeter = self.perimeter

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "area": area,
                "caveat": caveat,
                "centroid": centroid,
                "labelPoint": label_point,
                "perimeter": perimeter,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        area = d.pop("area")

        caveat = d.pop("caveat")

        centroid = d.pop("centroid")

        label_point = d.pop("labelPoint")

        perimeter = d.pop("perimeter")

        area_metrics_method = cls(
            area=area,
            caveat=caveat,
            centroid=centroid,
            label_point=label_point,
            perimeter=perimeter,
        )

        area_metrics_method.additional_properties = d
        return area_metrics_method

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
