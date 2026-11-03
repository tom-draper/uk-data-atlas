from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.postcode_batch_boundary_rule import PostcodeBatchBoundaryRule
from ..models.postcode_batch_date_basis import PostcodeBatchDateBasis

if TYPE_CHECKING:
    from ..models.point_lookup_release import PointLookupRelease
    from ..models.postcode_batch_postcodes_item import PostcodeBatchPostcodesItem
    from ..models.postcode_batch_source import PostcodeBatchSource
    from ..models.postcode_batch_summary import PostcodeBatchSummary


T = TypeVar("T", bound="PostcodeBatch")


@_attrs_define
class PostcodeBatch:
    """
    Attributes:
        boundary_rule (PostcodeBatchBoundaryRule):
        date (str):
        date_basis (PostcodeBatchDateBasis):
        note (str):
        postcodes (list[PostcodeBatchPostcodesItem]):
        releases (list[PointLookupRelease]):
        source (PostcodeBatchSource):
        summary (PostcodeBatchSummary):
    """

    boundary_rule: PostcodeBatchBoundaryRule
    date: str
    date_basis: PostcodeBatchDateBasis
    note: str
    postcodes: list[PostcodeBatchPostcodesItem]
    releases: list[PointLookupRelease]
    source: PostcodeBatchSource
    summary: PostcodeBatchSummary
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_rule = self.boundary_rule.value

        date = self.date

        date_basis = self.date_basis.value

        note = self.note

        postcodes = []
        for postcodes_item_data in self.postcodes:
            postcodes_item = postcodes_item_data.to_dict()
            postcodes.append(postcodes_item)

        releases = []
        for releases_item_data in self.releases:
            releases_item = releases_item_data.to_dict()
            releases.append(releases_item)

        source = self.source.to_dict()

        summary = self.summary.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRule": boundary_rule,
                "date": date,
                "dateBasis": date_basis,
                "note": note,
                "postcodes": postcodes,
                "releases": releases,
                "source": source,
                "summary": summary,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.point_lookup_release import PointLookupRelease
        from ..models.postcode_batch_postcodes_item import PostcodeBatchPostcodesItem
        from ..models.postcode_batch_source import PostcodeBatchSource
        from ..models.postcode_batch_summary import PostcodeBatchSummary

        d = dict(src_dict)
        boundary_rule = PostcodeBatchBoundaryRule(d.pop("boundaryRule"))

        date = d.pop("date")

        date_basis = PostcodeBatchDateBasis(d.pop("dateBasis"))

        note = d.pop("note")

        postcodes = []
        _postcodes = d.pop("postcodes")
        for postcodes_item_data in _postcodes:
            postcodes_item = PostcodeBatchPostcodesItem.from_dict(postcodes_item_data)

            postcodes.append(postcodes_item)

        releases = []
        _releases = d.pop("releases")
        for releases_item_data in _releases:
            releases_item = PointLookupRelease.from_dict(releases_item_data)

            releases.append(releases_item)

        source = PostcodeBatchSource.from_dict(d.pop("source"))

        summary = PostcodeBatchSummary.from_dict(d.pop("summary"))

        postcode_batch = cls(
            boundary_rule=boundary_rule,
            date=date,
            date_basis=date_basis,
            note=note,
            postcodes=postcodes,
            releases=releases,
            source=source,
            summary=summary,
        )

        postcode_batch.additional_properties = d
        return postcode_batch

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
