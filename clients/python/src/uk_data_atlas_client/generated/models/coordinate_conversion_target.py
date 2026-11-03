from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.coordinate_conversion_target_coordinate_conversion_grid_crs import (
    CoordinateConversionTargetCoordinateConversionGridCrs,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.coordinate_conversion_target_grid_reference import (
        CoordinateConversionTargetGridReference,
    )
    from ..models.coordinate_conversion_target_transformation import (
        CoordinateConversionTargetTransformation,
    )


T = TypeVar("T", bound="CoordinateConversionTarget")


@_attrs_define
class CoordinateConversionTarget:
    """Present when `to` requests a national grid. The named EPSG transformation is used in its inverse direction from WGS
    84.

        Attributes:
            crs (CoordinateConversionTargetCoordinateConversionGridCrs):
            easting (float):
            northing (float):
            transformation (CoordinateConversionTargetTransformation):
            uncertainty_m (float): Input uncertainty plus the transformation's stated accuracy, in metres.
            grid_reference (CoordinateConversionTargetGridReference | Unset): A British National Grid cell containing the
                target coordinate, present only for an encodable EPSG:27700 target. Its cell is no finer than the target
                uncertainty permits.
    """

    crs: CoordinateConversionTargetCoordinateConversionGridCrs
    easting: float
    northing: float
    transformation: CoordinateConversionTargetTransformation
    uncertainty_m: float
    grid_reference: CoordinateConversionTargetGridReference | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crs = self.crs.value

        easting = self.easting

        northing = self.northing

        transformation = self.transformation.to_dict()

        uncertainty_m = self.uncertainty_m

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
                "uncertaintyM": uncertainty_m,
            }
        )
        if grid_reference is not UNSET:
            field_dict["gridReference"] = grid_reference

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.coordinate_conversion_target_grid_reference import (
            CoordinateConversionTargetGridReference,
        )
        from ..models.coordinate_conversion_target_transformation import (
            CoordinateConversionTargetTransformation,
        )

        d = dict(src_dict)
        crs = CoordinateConversionTargetCoordinateConversionGridCrs(d.pop("crs"))

        easting = d.pop("easting")

        northing = d.pop("northing")

        transformation = CoordinateConversionTargetTransformation.from_dict(
            d.pop("transformation")
        )

        uncertainty_m = d.pop("uncertaintyM")

        _grid_reference = d.pop("gridReference", UNSET)
        grid_reference: CoordinateConversionTargetGridReference | Unset
        if isinstance(_grid_reference, Unset):
            grid_reference = UNSET
        else:
            grid_reference = CoordinateConversionTargetGridReference.from_dict(
                _grid_reference
            )

        coordinate_conversion_target = cls(
            crs=crs,
            easting=easting,
            northing=northing,
            transformation=transformation,
            uncertainty_m=uncertainty_m,
            grid_reference=grid_reference,
        )

        coordinate_conversion_target.additional_properties = d
        return coordinate_conversion_target

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
