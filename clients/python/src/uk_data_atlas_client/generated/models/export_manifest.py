from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_manifest_schema_version import ExportManifestSchemaVersion
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.bulk_export import BulkExport
    from ..models.export_manifest_datasets import ExportManifestDatasets
    from ..models.export_manifest_fields import ExportManifestFields


T = TypeVar("T", bound="ExportManifest")


@_attrs_define
class ExportManifest:
    """
    Attributes:
        content_hash (str):
        data_catalog_hash (str):
        datasets (ExportManifestDatasets):
        exports (list[BulkExport]):
        fields (ExportManifestFields): What each record field means.
        schema_version (ExportManifestSchemaVersion):
        note (str | Unset):
    """

    content_hash: str
    data_catalog_hash: str
    datasets: ExportManifestDatasets
    exports: list[BulkExport]
    fields: ExportManifestFields
    schema_version: ExportManifestSchemaVersion
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        data_catalog_hash = self.data_catalog_hash

        datasets = self.datasets.to_dict()

        exports = []
        for exports_item_data in self.exports:
            exports_item = exports_item_data.to_dict()
            exports.append(exports_item)

        fields = self.fields.to_dict()

        schema_version = self.schema_version.value

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "dataCatalogHash": data_catalog_hash,
                "datasets": datasets,
                "exports": exports,
                "fields": fields,
                "schemaVersion": schema_version,
            }
        )
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.bulk_export import BulkExport
        from ..models.export_manifest_datasets import ExportManifestDatasets
        from ..models.export_manifest_fields import ExportManifestFields

        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        data_catalog_hash = d.pop("dataCatalogHash")

        datasets = ExportManifestDatasets.from_dict(d.pop("datasets"))

        exports = []
        _exports = d.pop("exports")
        for exports_item_data in _exports:
            exports_item = BulkExport.from_dict(exports_item_data)

            exports.append(exports_item)

        fields = ExportManifestFields.from_dict(d.pop("fields"))

        schema_version = ExportManifestSchemaVersion(d.pop("schemaVersion"))

        note = d.pop("note", UNSET)

        export_manifest = cls(
            content_hash=content_hash,
            data_catalog_hash=data_catalog_hash,
            datasets=datasets,
            exports=exports,
            fields=fields,
            schema_version=schema_version,
            note=note,
        )

        export_manifest.additional_properties = d
        return export_manifest

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
