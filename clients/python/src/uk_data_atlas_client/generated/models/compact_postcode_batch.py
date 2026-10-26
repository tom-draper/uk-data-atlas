from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.compact_postcode_batch_postcodes_item import (
        CompactPostcodeBatchPostcodesItem,
    )
    from ..models.compact_postcode_batch_releases_item import (
        CompactPostcodeBatchReleasesItem,
    )
    from ..models.compact_postcode_source import CompactPostcodeSource
    from ..models.postcode_batch_summary import PostcodeBatchSummary


T = TypeVar("T", bound="CompactPostcodeBatch")


@_attrs_define
class CompactPostcodeBatch:
    """A postcode batch with `view=compact`.

    Attributes:
        date (str):
        postcodes (list[CompactPostcodeBatchPostcodesItem]):
        releases (list[CompactPostcodeBatchReleasesItem]):
        source (CompactPostcodeSource):
        summary (PostcodeBatchSummary):
    """

    date: str
    postcodes: list[CompactPostcodeBatchPostcodesItem]
    releases: list[CompactPostcodeBatchReleasesItem]
    source: CompactPostcodeSource
    summary: PostcodeBatchSummary
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        date = self.date

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
                "date": date,
                "postcodes": postcodes,
                "releases": releases,
                "source": source,
                "summary": summary,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compact_postcode_batch_postcodes_item import (
            CompactPostcodeBatchPostcodesItem,
        )
        from ..models.compact_postcode_batch_releases_item import (
            CompactPostcodeBatchReleasesItem,
        )
        from ..models.compact_postcode_source import CompactPostcodeSource
        from ..models.postcode_batch_summary import PostcodeBatchSummary

        d = dict(src_dict)
        date = d.pop("date")

        postcodes = []
        _postcodes = d.pop("postcodes")
        for postcodes_item_data in _postcodes:
            postcodes_item = CompactPostcodeBatchPostcodesItem.from_dict(
                postcodes_item_data
            )

            postcodes.append(postcodes_item)

        releases = []
        _releases = d.pop("releases")
        for releases_item_data in _releases:
            releases_item = CompactPostcodeBatchReleasesItem.from_dict(
                releases_item_data
            )

            releases.append(releases_item)

        source = CompactPostcodeSource.from_dict(d.pop("source"))

        summary = PostcodeBatchSummary.from_dict(d.pop("summary"))

        compact_postcode_batch = cls(
            date=date,
            postcodes=postcodes,
            releases=releases,
            source=source,
            summary=summary,
        )

        compact_postcode_batch.additional_properties = d
        return compact_postcode_batch

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
