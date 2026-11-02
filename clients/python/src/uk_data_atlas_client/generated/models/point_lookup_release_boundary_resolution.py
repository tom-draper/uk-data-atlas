from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_lookup_release_boundary_resolution_basis import (
    PointLookupReleaseBoundaryResolutionBasis,
)
from ..models.point_lookup_release_boundary_resolution_extent import (
    PointLookupReleaseBoundaryResolutionExtent,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="PointLookupReleaseBoundaryResolution")


@_attrs_define
class PointLookupReleaseBoundaryResolution:
    """How much the boundary's lines were generalised, read from the ONS release name. `undeclared` where the name does not
    say.

        Attributes:
            generalisation (str):
            basis (PointLookupReleaseBoundaryResolutionBasis | Unset):
            extent (PointLookupReleaseBoundaryResolutionExtent | Unset):
            tolerance_m (float | Unset):
    """

    generalisation: str
    basis: PointLookupReleaseBoundaryResolutionBasis | Unset = UNSET
    extent: PointLookupReleaseBoundaryResolutionExtent | Unset = UNSET
    tolerance_m: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        generalisation = self.generalisation

        basis: str | Unset = UNSET
        if not isinstance(self.basis, Unset):
            basis = self.basis.value

        extent: str | Unset = UNSET
        if not isinstance(self.extent, Unset):
            extent = self.extent.value

        tolerance_m = self.tolerance_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "generalisation": generalisation,
            }
        )
        if basis is not UNSET:
            field_dict["basis"] = basis
        if extent is not UNSET:
            field_dict["extent"] = extent
        if tolerance_m is not UNSET:
            field_dict["toleranceM"] = tolerance_m

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        generalisation = d.pop("generalisation")

        _basis = d.pop("basis", UNSET)
        basis: PointLookupReleaseBoundaryResolutionBasis | Unset
        if isinstance(_basis, Unset):
            basis = UNSET
        else:
            basis = PointLookupReleaseBoundaryResolutionBasis(_basis)

        _extent = d.pop("extent", UNSET)
        extent: PointLookupReleaseBoundaryResolutionExtent | Unset
        if isinstance(_extent, Unset):
            extent = UNSET
        else:
            extent = PointLookupReleaseBoundaryResolutionExtent(_extent)

        tolerance_m = d.pop("toleranceM", UNSET)

        point_lookup_release_boundary_resolution = cls(
            generalisation=generalisation,
            basis=basis,
            extent=extent,
            tolerance_m=tolerance_m,
        )

        point_lookup_release_boundary_resolution.additional_properties = d
        return point_lookup_release_boundary_resolution

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
