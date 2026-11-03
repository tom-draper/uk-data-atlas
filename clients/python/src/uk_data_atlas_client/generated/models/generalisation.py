from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.generalisation_tier import GeneralisationTier
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.generalisation_method import GeneralisationMethod


T = TypeVar("T", bound="Generalisation")


@_attrs_define
class Generalisation:
    """What was done to the geometry before it was served, and at what cost. `method` is present only above the `full`
    tier, where something was actually done; it includes the caveat that neighbours generalised separately may disagree
    along a shared border.

        Attributes:
            min_effective_area_m2 (float): The threshold actually applied, in square metres: a vertex is dropped when its
                triangle is smaller than this.
            parts (int):
            parts_at_full_resolution (int):
            tier (GeneralisationTier):
            tolerance_m (float): The side in metres of the smallest square of detail kept.
            vertices (int): Vertices in the geometry as served.
            vertices_at_full_resolution (int):
            method (GeneralisationMethod | Unset):
    """

    min_effective_area_m2: float
    parts: int
    parts_at_full_resolution: int
    tier: GeneralisationTier
    tolerance_m: float
    vertices: int
    vertices_at_full_resolution: int
    method: GeneralisationMethod | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        min_effective_area_m2 = self.min_effective_area_m2

        parts = self.parts

        parts_at_full_resolution = self.parts_at_full_resolution

        tier = self.tier.value

        tolerance_m = self.tolerance_m

        vertices = self.vertices

        vertices_at_full_resolution = self.vertices_at_full_resolution

        method: dict[str, Any] | Unset = UNSET
        if not isinstance(self.method, Unset):
            method = self.method.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "minEffectiveAreaM2": min_effective_area_m2,
                "parts": parts,
                "partsAtFullResolution": parts_at_full_resolution,
                "tier": tier,
                "toleranceM": tolerance_m,
                "vertices": vertices,
                "verticesAtFullResolution": vertices_at_full_resolution,
            }
        )
        if method is not UNSET:
            field_dict["method"] = method

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.generalisation_method import GeneralisationMethod

        d = dict(src_dict)
        min_effective_area_m2 = d.pop("minEffectiveAreaM2")

        parts = d.pop("parts")

        parts_at_full_resolution = d.pop("partsAtFullResolution")

        tier = GeneralisationTier(d.pop("tier"))

        tolerance_m = d.pop("toleranceM")

        vertices = d.pop("vertices")

        vertices_at_full_resolution = d.pop("verticesAtFullResolution")

        _method = d.pop("method", UNSET)
        method: GeneralisationMethod | Unset
        if isinstance(_method, Unset):
            method = UNSET
        else:
            method = GeneralisationMethod.from_dict(_method)

        generalisation = cls(
            min_effective_area_m2=min_effective_area_m2,
            parts=parts,
            parts_at_full_resolution=parts_at_full_resolution,
            tier=tier,
            tolerance_m=tolerance_m,
            vertices=vertices,
            vertices_at_full_resolution=vertices_at_full_resolution,
            method=method,
        )

        generalisation.additional_properties = d
        return generalisation

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
