from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_children_geometry_collection_tier import (
    AreaChildrenGeometryCollectionTier,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_children_geometry_collection_generalisation_method import (
        AreaChildrenGeometryCollectionGeneralisationMethod,
    )


T = TypeVar("T", bound="AreaChildrenGeometryCollection")


@_attrs_define
class AreaChildrenGeometryCollection:
    """What the collection holds and on what terms. `generalisationMethod` is present only above the `full` tier.

    Attributes:
        members (int): Areas the crosswalk names as contained by the parent.
        min_effective_area_m2 (float):
        tier (AreaChildrenGeometryCollectionTier):
        tolerance_m (float):
        vertices (int):
        with_geometry (int): Of those, how many could be drawn.
        generalisation_method (AreaChildrenGeometryCollectionGeneralisationMethod | Unset):
    """

    members: int
    min_effective_area_m2: float
    tier: AreaChildrenGeometryCollectionTier
    tolerance_m: float
    vertices: int
    with_geometry: int
    generalisation_method: (
        AreaChildrenGeometryCollectionGeneralisationMethod | Unset
    ) = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        members = self.members

        min_effective_area_m2 = self.min_effective_area_m2

        tier = self.tier.value

        tolerance_m = self.tolerance_m

        vertices = self.vertices

        with_geometry = self.with_geometry

        generalisation_method: dict[str, Any] | Unset = UNSET
        if not isinstance(self.generalisation_method, Unset):
            generalisation_method = self.generalisation_method.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "members": members,
                "minEffectiveAreaM2": min_effective_area_m2,
                "tier": tier,
                "toleranceM": tolerance_m,
                "vertices": vertices,
                "withGeometry": with_geometry,
            }
        )
        if generalisation_method is not UNSET:
            field_dict["generalisationMethod"] = generalisation_method

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_children_geometry_collection_generalisation_method import (
            AreaChildrenGeometryCollectionGeneralisationMethod,
        )

        d = dict(src_dict)
        members = d.pop("members")

        min_effective_area_m2 = d.pop("minEffectiveAreaM2")

        tier = AreaChildrenGeometryCollectionTier(d.pop("tier"))

        tolerance_m = d.pop("toleranceM")

        vertices = d.pop("vertices")

        with_geometry = d.pop("withGeometry")

        _generalisation_method = d.pop("generalisationMethod", UNSET)
        generalisation_method: (
            AreaChildrenGeometryCollectionGeneralisationMethod | Unset
        )
        if isinstance(_generalisation_method, Unset):
            generalisation_method = UNSET
        else:
            generalisation_method = (
                AreaChildrenGeometryCollectionGeneralisationMethod.from_dict(
                    _generalisation_method
                )
            )

        area_children_geometry_collection = cls(
            members=members,
            min_effective_area_m2=min_effective_area_m2,
            tier=tier,
            tolerance_m=tolerance_m,
            vertices=vertices,
            with_geometry=with_geometry,
            generalisation_method=generalisation_method,
        )

        area_children_geometry_collection.additional_properties = d
        return area_children_geometry_collection

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
