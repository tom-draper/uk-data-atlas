from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.bulk_export_format import BulkExportFormat
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.bulk_export_formats_item import BulkExportFormatsItem
    from ..models.bulk_export_provenance import BulkExportProvenance
    from ..models.bulk_export_record_count_by_period import (
        BulkExportRecordCountByPeriod,
    )
    from ..models.bulk_export_schema import BulkExportSchema
    from ..models.bulk_export_source_geography import BulkExportSourceGeography


T = TypeVar("T", bound="BulkExport")


@_attrs_define
class BulkExport:
    """
    Attributes:
        artifact (str):
        bytes_ (int):
        content_hash (str):
        dataset_id (str):
        format_ (BulkExportFormat):
        href (str):
        id (str):
        measure_id (str):
        periods (list[str]):
        provenance (BulkExportProvenance):
        record_count (int): Records in the artifact, counted from it.
        record_count_by_period (BulkExportRecordCountByPeriod):
        schema (BulkExportSchema): The artifact's shape, read from the artifact. `version` is the artifact's
            `schemaVersion`, which increments when a field is removed, renamed or changes type or meaning, or the layout
            changes.
        source_geography (BulkExportSourceGeography):
        formats (list[BulkExportFormatsItem] | Unset): Prebuilt flat files of the named measure, schema version 1. Sizes
            are file bytes before HTTP compression; hashes identify those bytes.
    """

    artifact: str
    bytes_: int
    content_hash: str
    dataset_id: str
    format_: BulkExportFormat
    href: str
    id: str
    measure_id: str
    periods: list[str]
    provenance: BulkExportProvenance
    record_count: int
    record_count_by_period: BulkExportRecordCountByPeriod
    schema: BulkExportSchema
    source_geography: BulkExportSourceGeography
    formats: list[BulkExportFormatsItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        artifact = self.artifact

        bytes_ = self.bytes_

        content_hash = self.content_hash

        dataset_id = self.dataset_id

        format_ = self.format_.value

        href = self.href

        id = self.id

        measure_id = self.measure_id

        periods = self.periods

        provenance = self.provenance.to_dict()

        record_count = self.record_count

        record_count_by_period = self.record_count_by_period.to_dict()

        schema = self.schema.to_dict()

        source_geography = self.source_geography.to_dict()

        formats: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.formats, Unset):
            formats = []
            for formats_item_data in self.formats:
                formats_item = formats_item_data.to_dict()
                formats.append(formats_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "artifact": artifact,
                "bytes": bytes_,
                "contentHash": content_hash,
                "datasetId": dataset_id,
                "format": format_,
                "href": href,
                "id": id,
                "measureId": measure_id,
                "periods": periods,
                "provenance": provenance,
                "recordCount": record_count,
                "recordCountByPeriod": record_count_by_period,
                "schema": schema,
                "sourceGeography": source_geography,
            }
        )
        if formats is not UNSET:
            field_dict["formats"] = formats

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.bulk_export_formats_item import BulkExportFormatsItem
        from ..models.bulk_export_provenance import BulkExportProvenance
        from ..models.bulk_export_record_count_by_period import (
            BulkExportRecordCountByPeriod,
        )
        from ..models.bulk_export_schema import BulkExportSchema
        from ..models.bulk_export_source_geography import BulkExportSourceGeography

        d = dict(src_dict)
        artifact = d.pop("artifact")

        bytes_ = d.pop("bytes")

        content_hash = d.pop("contentHash")

        dataset_id = d.pop("datasetId")

        format_ = BulkExportFormat(d.pop("format"))

        href = d.pop("href")

        id = d.pop("id")

        measure_id = d.pop("measureId")

        periods = cast(list[str], d.pop("periods"))

        provenance = BulkExportProvenance.from_dict(d.pop("provenance"))

        record_count = d.pop("recordCount")

        record_count_by_period = BulkExportRecordCountByPeriod.from_dict(
            d.pop("recordCountByPeriod")
        )

        schema = BulkExportSchema.from_dict(d.pop("schema"))

        source_geography = BulkExportSourceGeography.from_dict(d.pop("sourceGeography"))

        _formats = d.pop("formats", UNSET)
        formats: list[BulkExportFormatsItem] | Unset = UNSET
        if _formats is not UNSET:
            formats = []
            for formats_item_data in _formats:
                formats_item = BulkExportFormatsItem.from_dict(formats_item_data)

                formats.append(formats_item)

        bulk_export = cls(
            artifact=artifact,
            bytes_=bytes_,
            content_hash=content_hash,
            dataset_id=dataset_id,
            format_=format_,
            href=href,
            id=id,
            measure_id=measure_id,
            periods=periods,
            provenance=provenance,
            record_count=record_count,
            record_count_by_period=record_count_by_period,
            schema=schema,
            source_geography=source_geography,
            formats=formats,
        )

        bulk_export.additional_properties = d
        return bulk_export

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
