from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_containment_batch_boundary_rule import (
    PointContainmentBatchBoundaryRule,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.point_containment_batch_points_item import (
        PointContainmentBatchPointsItem,
    )
    from ..models.point_containment_batch_summary import PointContainmentBatchSummary
    from ..models.point_lookup_release import PointLookupRelease


T = TypeVar("T", bound="PointContainmentBatch")


@_attrs_define
class PointContainmentBatch:
    """
    Attributes:
        boundary_rule (PointContainmentBatchBoundaryRule):
        note (str):
        points (list[PointContainmentBatchPointsItem]):
        releases (list[PointLookupRelease]):
        summary (PointContainmentBatchSummary):
        date (str | Unset):
    """

    boundary_rule: PointContainmentBatchBoundaryRule
    note: str
    points: list[PointContainmentBatchPointsItem]
    releases: list[PointLookupRelease]
    summary: PointContainmentBatchSummary
    date: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_rule = self.boundary_rule.value

        note = self.note

        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)

        releases = []
        for releases_item_data in self.releases:
            releases_item = releases_item_data.to_dict()
            releases.append(releases_item)

        summary = self.summary.to_dict()

        date = self.date

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRule": boundary_rule,
                "note": note,
                "points": points,
                "releases": releases,
                "summary": summary,
            }
        )
        if date is not UNSET:
            field_dict["date"] = date

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.point_containment_batch_points_item import (
            PointContainmentBatchPointsItem,
        )
        from ..models.point_containment_batch_summary import (
            PointContainmentBatchSummary,
        )
        from ..models.point_lookup_release import PointLookupRelease

        d = dict(src_dict)
        boundary_rule = PointContainmentBatchBoundaryRule(d.pop("boundaryRule"))

        note = d.pop("note")

        points = []
        _points = d.pop("points")
        for points_item_data in _points:
            points_item = PointContainmentBatchPointsItem.from_dict(points_item_data)

            points.append(points_item)

        releases = []
        _releases = d.pop("releases")
        for releases_item_data in _releases:
            releases_item = PointLookupRelease.from_dict(releases_item_data)

            releases.append(releases_item)

        summary = PointContainmentBatchSummary.from_dict(d.pop("summary"))

        date = d.pop("date", UNSET)

        point_containment_batch = cls(
            boundary_rule=boundary_rule,
            note=note,
            points=points,
            releases=releases,
            summary=summary,
            date=date,
        )

        point_containment_batch.additional_properties = d
        return point_containment_batch

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
