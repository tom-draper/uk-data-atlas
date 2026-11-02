from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.coordinate_conversion_target_crs import CoordinateConversionTargetCrs
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.coordinate_conversion_target import CoordinateConversionTarget
    from ..models.lookup_point import LookupPoint


T = TypeVar("T", bound="CoordinateConversion")


@_attrs_define
class CoordinateConversion:
    """
    Attributes:
        note (str):
        point (LookupPoint):
        target_crs (CoordinateConversionTargetCrs):
        target (CoordinateConversionTarget | Unset): Present when `to` requests a national grid. The named EPSG
            transformation is used in its inverse direction from WGS 84.
    """

    note: str
    point: LookupPoint
    target_crs: CoordinateConversionTargetCrs
    target: CoordinateConversionTarget | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        note = self.note

        point = self.point.to_dict()

        target_crs = self.target_crs.value

        target: dict[str, Any] | Unset = UNSET
        if not isinstance(self.target, Unset):
            target = self.target.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "note": note,
                "point": point,
                "targetCrs": target_crs,
            }
        )
        if target is not UNSET:
            field_dict["target"] = target

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.coordinate_conversion_target import CoordinateConversionTarget
        from ..models.lookup_point import LookupPoint

        d = dict(src_dict)
        note = d.pop("note")

        point = LookupPoint.from_dict(d.pop("point"))

        target_crs = CoordinateConversionTargetCrs(d.pop("targetCrs"))

        _target = d.pop("target", UNSET)
        target: CoordinateConversionTarget | Unset
        if isinstance(_target, Unset):
            target = UNSET
        else:
            target = CoordinateConversionTarget.from_dict(_target)

        coordinate_conversion = cls(
            note=note,
            point=point,
            target_crs=target_crs,
            target=target,
        )

        coordinate_conversion.additional_properties = d
        return coordinate_conversion

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
