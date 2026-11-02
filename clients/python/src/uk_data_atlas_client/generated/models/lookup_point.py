from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lookup_point_crs import LookupPointCrs
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point_input import LookupPointInput
    from ..models.lookup_point_precision import LookupPointPrecision


T = TypeVar("T", bound="LookupPoint")


@_attrs_define
class LookupPoint:
    """
    Attributes:
        crs (LookupPointCrs):
        lat (float):
        lng (float):
        precision (LookupPointPrecision):
        input_ (LookupPointInput | Unset): Present when British National Grid or Irish Grid input was transformed to WGS
            84.
    """

    crs: LookupPointCrs
    lat: float
    lng: float
    precision: LookupPointPrecision
    input_: LookupPointInput | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crs = self.crs.value

        lat = self.lat

        lng = self.lng

        precision = self.precision.to_dict()

        input_: dict[str, Any] | Unset = UNSET
        if not isinstance(self.input_, Unset):
            input_ = self.input_.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crs": crs,
                "lat": lat,
                "lng": lng,
                "precision": precision,
            }
        )
        if input_ is not UNSET:
            field_dict["input"] = input_

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point_input import LookupPointInput
        from ..models.lookup_point_precision import LookupPointPrecision

        d = dict(src_dict)
        crs = LookupPointCrs(d.pop("crs"))

        lat = d.pop("lat")

        lng = d.pop("lng")

        precision = LookupPointPrecision.from_dict(d.pop("precision"))

        _input_ = d.pop("input", UNSET)
        input_: LookupPointInput | Unset
        if isinstance(_input_, Unset):
            input_ = UNSET
        else:
            input_ = LookupPointInput.from_dict(_input_)

        lookup_point = cls(
            crs=crs,
            lat=lat,
            lng=lng,
            precision=precision,
            input_=input_,
        )

        lookup_point.additional_properties = d
        return lookup_point

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
