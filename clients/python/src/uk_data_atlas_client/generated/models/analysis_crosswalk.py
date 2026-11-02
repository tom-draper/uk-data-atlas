from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.crosswalk_method import CrosswalkMethod
from ..models.crosswalk_quality import CrosswalkQuality

T = TypeVar("T", bound="AnalysisCrosswalk")


@_attrs_define
class AnalysisCrosswalk:
    """
    Attributes:
        id (str):
        method (CrosswalkMethod): `official-lookup` and `clean-containment` read an explicit code pair from a published
            file. `area-overlap` intersects the two releases' boundary geometries and weights each source by the area it
            shares with each target. `population-overlap` reweights an area-overlap crosswalk's pairs by the residents of
            the building blocks in each. `geometric-containment` derives a hierarchy from geometry where no publisher lookup
            carries it. `best-fit` names, for each child, the one parent holding most of its area where the two do not nest.
            `extent-continuity` pairs the codes two releases of one geography share, as identity only where their geometries
            differ by no more than generalisation slivers.
        quality (CrosswalkQuality): `publisher-supplied` mappings restate a publisher's own correspondence. `derived`
            mappings are computed by the Atlas.
    """

    id: str
    method: CrosswalkMethod
    quality: CrosswalkQuality
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        method = self.method.value

        quality = self.quality.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "method": method,
                "quality": quality,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        id = d.pop("id")

        method = CrosswalkMethod(d.pop("method"))

        quality = CrosswalkQuality(d.pop("quality"))

        analysis_crosswalk = cls(
            id=id,
            method=method,
            quality=quality,
        )

        analysis_crosswalk.additional_properties = d
        return analysis_crosswalk

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
