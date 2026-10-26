from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.crosswalk_method import CrosswalkMethod
from ..models.crosswalk_quality import CrosswalkQuality

if TYPE_CHECKING:
    from ..models.crosswalk_side import CrosswalkSide
    from ..models.crosswalk_weighting_type_0 import CrosswalkWeightingType0
    from ..models.crosswalk_weighting_type_1 import CrosswalkWeightingType1
    from ..models.crosswalk_weighting_type_2 import CrosswalkWeightingType2


T = TypeVar("T", bound="CrosswalkSummary")


@_attrs_define
class CrosswalkSummary:
    """
    Attributes:
        artifact (str):
        content_hash (str):
        from_ (CrosswalkSide):
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
        record_count (int):
        to (CrosswalkSide):
        weighting (CrosswalkWeightingType0 | CrosswalkWeightingType1 | CrosswalkWeightingType2):
    """

    artifact: str
    content_hash: str
    from_: CrosswalkSide
    id: str
    method: CrosswalkMethod
    quality: CrosswalkQuality
    record_count: int
    to: CrosswalkSide
    weighting: (
        CrosswalkWeightingType0 | CrosswalkWeightingType1 | CrosswalkWeightingType2
    )
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.crosswalk_weighting_type_0 import CrosswalkWeightingType0
        from ..models.crosswalk_weighting_type_1 import CrosswalkWeightingType1

        artifact = self.artifact

        content_hash = self.content_hash

        from_ = self.from_.to_dict()

        id = self.id

        method = self.method.value

        quality = self.quality.value

        record_count = self.record_count

        to = self.to.to_dict()

        weighting: dict[str, Any]
        if isinstance(self.weighting, CrosswalkWeightingType0) or isinstance(
            self.weighting, CrosswalkWeightingType1
        ):
            weighting = self.weighting.to_dict()
        else:
            weighting = self.weighting.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "artifact": artifact,
                "contentHash": content_hash,
                "from": from_,
                "id": id,
                "method": method,
                "quality": quality,
                "recordCount": record_count,
                "to": to,
                "weighting": weighting,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_side import CrosswalkSide
        from ..models.crosswalk_weighting_type_0 import CrosswalkWeightingType0
        from ..models.crosswalk_weighting_type_1 import CrosswalkWeightingType1
        from ..models.crosswalk_weighting_type_2 import CrosswalkWeightingType2

        d = dict(src_dict)
        artifact = d.pop("artifact")

        content_hash = d.pop("contentHash")

        from_ = CrosswalkSide.from_dict(d.pop("from"))

        id = d.pop("id")

        method = CrosswalkMethod(d.pop("method"))

        quality = CrosswalkQuality(d.pop("quality"))

        record_count = d.pop("recordCount")

        to = CrosswalkSide.from_dict(d.pop("to"))

        def _parse_weighting(
            data: object,
        ) -> (
            CrosswalkWeightingType0 | CrosswalkWeightingType1 | CrosswalkWeightingType2
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_crosswalk_weighting_type_0 = (
                    CrosswalkWeightingType0.from_dict(data)
                )

                return componentsschemas_crosswalk_weighting_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_crosswalk_weighting_type_1 = (
                    CrosswalkWeightingType1.from_dict(data)
                )

                return componentsschemas_crosswalk_weighting_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_crosswalk_weighting_type_2 = (
                CrosswalkWeightingType2.from_dict(data)
            )

            return componentsschemas_crosswalk_weighting_type_2

        weighting = _parse_weighting(d.pop("weighting"))

        crosswalk_summary = cls(
            artifact=artifact,
            content_hash=content_hash,
            from_=from_,
            id=id,
            method=method,
            quality=quality,
            record_count=record_count,
            to=to,
            weighting=weighting,
        )

        crosswalk_summary.additional_properties = d
        return crosswalk_summary

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
