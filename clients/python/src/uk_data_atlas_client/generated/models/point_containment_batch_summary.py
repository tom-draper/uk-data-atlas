from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PointContainmentBatchSummary")


@_attrs_define
class PointContainmentBatchSummary:
    """
    Attributes:
        lookups (int):
        matched (int):
        near_boundary (int):
        no_match (int):
        outside_coverage (int):
        points (int):
        unresolved (int): Lookups with no answer about the point, such as an ambiguous release.
    """

    lookups: int
    matched: int
    near_boundary: int
    no_match: int
    outside_coverage: int
    points: int
    unresolved: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        lookups = self.lookups

        matched = self.matched

        near_boundary = self.near_boundary

        no_match = self.no_match

        outside_coverage = self.outside_coverage

        points = self.points

        unresolved = self.unresolved

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "lookups": lookups,
                "matched": matched,
                "nearBoundary": near_boundary,
                "noMatch": no_match,
                "outsideCoverage": outside_coverage,
                "points": points,
                "unresolved": unresolved,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        lookups = d.pop("lookups")

        matched = d.pop("matched")

        near_boundary = d.pop("nearBoundary")

        no_match = d.pop("noMatch")

        outside_coverage = d.pop("outsideCoverage")

        points = d.pop("points")

        unresolved = d.pop("unresolved")

        point_containment_batch_summary = cls(
            lookups=lookups,
            matched=matched,
            near_boundary=near_boundary,
            no_match=no_match,
            outside_coverage=outside_coverage,
            points=points,
            unresolved=unresolved,
        )

        point_containment_batch_summary.additional_properties = d
        return point_containment_batch_summary

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
