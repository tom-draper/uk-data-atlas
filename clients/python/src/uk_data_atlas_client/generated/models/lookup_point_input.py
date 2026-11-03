from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lookup_point_input_crs import LookupPointInputCrs
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point_input_grid_reference import LookupPointInputGridReference
    from ..models.lookup_point_input_transformation import (
        LookupPointInputTransformation,
    )


T = TypeVar("T", bound="LookupPointInput")


@_attrs_define
class LookupPointInput:
    """Present when British National Grid or Irish Grid input was transformed to WGS 84.

    Attributes:
        crs (LookupPointInputCrs):
        easting (float):
        northing (float):
        transformation (LookupPointInputTransformation):
        grid_reference (LookupPointInputGridReference | Unset): Present when an Ordnance Survey National Grid reference
            was supplied.
    """

    crs: LookupPointInputCrs
    easting: float
    northing: float
    transformation: LookupPointInputTransformation
    grid_reference: LookupPointInputGridReference | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crs = self.crs.value

        easting = self.easting

        northing = self.northing

        transformation = self.transformation.to_dict()

        grid_reference: dict[str, Any] | Unset = UNSET
        if not isinstance(self.grid_reference, Unset):
            grid_reference = self.grid_reference.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crs": crs,
                "easting": easting,
                "northing": northing,
                "transformation": transformation,
            }
        )
        if grid_reference is not UNSET:
            field_dict["gridReference"] = grid_reference

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point_input_grid_reference import (
            LookupPointInputGridReference,
        )
        from ..models.lookup_point_input_transformation import (
            LookupPointInputTransformation,
        )

        d = dict(src_dict)
        crs = LookupPointInputCrs(d.pop("crs"))

        easting = d.pop("easting")

        northing = d.pop("northing")

        transformation = LookupPointInputTransformation.from_dict(
            d.pop("transformation")
        )

        _grid_reference = d.pop("gridReference", UNSET)
        grid_reference: LookupPointInputGridReference | Unset
        if isinstance(_grid_reference, Unset):
            grid_reference = UNSET
        else:
            grid_reference = LookupPointInputGridReference.from_dict(_grid_reference)

        lookup_point_input = cls(
            crs=crs,
            easting=easting,
            northing=northing,
            transformation=transformation,
            grid_reference=grid_reference,
        )

        lookup_point_input.additional_properties = d
        return lookup_point_input

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
