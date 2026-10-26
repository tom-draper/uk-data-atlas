from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_lookup_result_matches_item_containment import (
    PointLookupResultMatchesItemContainment,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source import GeometrySource
    from ..models.point_lookup_result_matches_item_corrections_item import (
        PointLookupResultMatchesItemCorrectionsItem,
    )


T = TypeVar("T", bound="PointLookupResultMatchesItem")


@_attrs_define
class PointLookupResultMatchesItem:
    """
    Attributes:
        code (str):
        containment (PointLookupResultMatchesItemContainment):
        distance_to_boundary_m (float): Metres from the point to the area's nearest edge.
        id (str):
        name (str):
        near_boundary (bool): The edge lies within `positionalToleranceM`.
        aliases (list[str] | Unset):
        corrections (list[PointLookupResultMatchesItemCorrectionsItem] | Unset):
        geometry_source (GeometrySource | Unset): Where the served WGS84 geometry came from. `transformation` is present
            only when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
            direct source reads omit it.
    """

    code: str
    containment: PointLookupResultMatchesItemContainment
    distance_to_boundary_m: float
    id: str
    name: str
    near_boundary: bool
    aliases: list[str] | Unset = UNSET
    corrections: list[PointLookupResultMatchesItemCorrectionsItem] | Unset = UNSET
    geometry_source: GeometrySource | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        containment = self.containment.value

        distance_to_boundary_m = self.distance_to_boundary_m

        id = self.id

        name = self.name

        near_boundary = self.near_boundary

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        corrections: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.corrections, Unset):
            corrections = []
            for corrections_item_data in self.corrections:
                corrections_item = corrections_item_data.to_dict()
                corrections.append(corrections_item)

        geometry_source: dict[str, Any] | Unset = UNSET
        if not isinstance(self.geometry_source, Unset):
            geometry_source = self.geometry_source.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "containment": containment,
                "distanceToBoundaryM": distance_to_boundary_m,
                "id": id,
                "name": name,
                "nearBoundary": near_boundary,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if corrections is not UNSET:
            field_dict["corrections"] = corrections
        if geometry_source is not UNSET:
            field_dict["geometrySource"] = geometry_source

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source import GeometrySource
        from ..models.point_lookup_result_matches_item_corrections_item import (
            PointLookupResultMatchesItemCorrectionsItem,
        )

        d = dict(src_dict)
        code = d.pop("code")

        containment = PointLookupResultMatchesItemContainment(d.pop("containment"))

        distance_to_boundary_m = d.pop("distanceToBoundaryM")

        id = d.pop("id")

        name = d.pop("name")

        near_boundary = d.pop("nearBoundary")

        aliases = cast(list[str], d.pop("aliases", UNSET))

        _corrections = d.pop("corrections", UNSET)
        corrections: list[PointLookupResultMatchesItemCorrectionsItem] | Unset = UNSET
        if _corrections is not UNSET:
            corrections = []
            for corrections_item_data in _corrections:
                corrections_item = (
                    PointLookupResultMatchesItemCorrectionsItem.from_dict(
                        corrections_item_data
                    )
                )

                corrections.append(corrections_item)

        _geometry_source = d.pop("geometrySource", UNSET)
        geometry_source: GeometrySource | Unset
        if isinstance(_geometry_source, Unset):
            geometry_source = UNSET
        else:
            geometry_source = GeometrySource.from_dict(_geometry_source)

        point_lookup_result_matches_item = cls(
            code=code,
            containment=containment,
            distance_to_boundary_m=distance_to_boundary_m,
            id=id,
            name=name,
            near_boundary=near_boundary,
            aliases=aliases,
            corrections=corrections,
            geometry_source=geometry_source,
        )

        point_lookup_result_matches_item.additional_properties = d
        return point_lookup_result_matches_item

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
