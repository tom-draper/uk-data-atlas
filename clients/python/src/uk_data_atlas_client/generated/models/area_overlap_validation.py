from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaOverlapValidation")


@_attrs_define
class AreaOverlapValidation:
    """Present only for `area-overlap` crosswalks. Two independently generalised boundaries leave narrow slivers where they
    disagree. A pair whose widest intersecting piece is narrower than `sliverWidthM` (twice its area over its perimeter)
    is dropped as a sliver. The build fails unless every sliver is under half that width and every kept overlap at least
    twice it, and unless every source and target area is at least `minimumCoverage` covered by kept overlaps.

        Attributes:
            candidate_pair_count (int): Pairs whose bounding boxes meet, and so were clipped.
            intersecting_pair_count (int):
            minimum_coverage (float):
            minimum_source_coverage (float):
            minimum_target_coverage (float):
            narrowest_overlap_width_m (float):
            sliver_pair_count (int):
            sliver_width_m (float):
            widest_sliver_width_m (float | None):
    """

    candidate_pair_count: int
    intersecting_pair_count: int
    minimum_coverage: float
    minimum_source_coverage: float
    minimum_target_coverage: float
    narrowest_overlap_width_m: float
    sliver_pair_count: int
    sliver_width_m: float
    widest_sliver_width_m: float | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        candidate_pair_count = self.candidate_pair_count

        intersecting_pair_count = self.intersecting_pair_count

        minimum_coverage = self.minimum_coverage

        minimum_source_coverage = self.minimum_source_coverage

        minimum_target_coverage = self.minimum_target_coverage

        narrowest_overlap_width_m = self.narrowest_overlap_width_m

        sliver_pair_count = self.sliver_pair_count

        sliver_width_m = self.sliver_width_m

        widest_sliver_width_m: float | None
        widest_sliver_width_m = self.widest_sliver_width_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "candidatePairCount": candidate_pair_count,
                "intersectingPairCount": intersecting_pair_count,
                "minimumCoverage": minimum_coverage,
                "minimumSourceCoverage": minimum_source_coverage,
                "minimumTargetCoverage": minimum_target_coverage,
                "narrowestOverlapWidthM": narrowest_overlap_width_m,
                "sliverPairCount": sliver_pair_count,
                "sliverWidthM": sliver_width_m,
                "widestSliverWidthM": widest_sliver_width_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        candidate_pair_count = d.pop("candidatePairCount")

        intersecting_pair_count = d.pop("intersectingPairCount")

        minimum_coverage = d.pop("minimumCoverage")

        minimum_source_coverage = d.pop("minimumSourceCoverage")

        minimum_target_coverage = d.pop("minimumTargetCoverage")

        narrowest_overlap_width_m = d.pop("narrowestOverlapWidthM")

        sliver_pair_count = d.pop("sliverPairCount")

        sliver_width_m = d.pop("sliverWidthM")

        def _parse_widest_sliver_width_m(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        widest_sliver_width_m = _parse_widest_sliver_width_m(
            d.pop("widestSliverWidthM")
        )

        area_overlap_validation = cls(
            candidate_pair_count=candidate_pair_count,
            intersecting_pair_count=intersecting_pair_count,
            minimum_coverage=minimum_coverage,
            minimum_source_coverage=minimum_source_coverage,
            minimum_target_coverage=minimum_target_coverage,
            narrowest_overlap_width_m=narrowest_overlap_width_m,
            sliver_pair_count=sliver_pair_count,
            sliver_width_m=sliver_width_m,
            widest_sliver_width_m=widest_sliver_width_m,
        )

        area_overlap_validation.additional_properties = d
        return area_overlap_validation

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
