from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.bulk_export_schema_layout import BulkExportSchemaLayout
from ..models.bulk_export_schema_record_type import BulkExportSchemaRecordType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.export_field import ExportField


T = TypeVar("T", bound="BulkExportSchema")


@_attrs_define
class BulkExportSchema:
    """The artifact's shape, read from the artifact. `version` is the artifact's `schemaVersion`, which increments when a
    field is removed, renamed or changes type or meaning, or the layout changes.

        Attributes:
            fields (list[ExportField]):
            layout (BulkExportSchemaLayout): `table` is an artifact several measures share, such as a census table: one row
                per area, the area code and then a value for each measure in `measures` order, null where none is published.
                Each measure's JSON download contains the whole table. CSV and Parquet contain only the named measure.
            record_type (BulkExportSchemaRecordType):
            version (int):
            measures (list[str] | Unset): For a `table`, the measure each value column serves, in order.
    """

    fields: list[ExportField]
    layout: BulkExportSchemaLayout
    record_type: BulkExportSchemaRecordType
    version: int
    measures: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        fields = []
        for fields_item_data in self.fields:
            fields_item = fields_item_data.to_dict()
            fields.append(fields_item)

        layout = self.layout.value

        record_type = self.record_type.value

        version = self.version

        measures: list[str] | Unset = UNSET
        if not isinstance(self.measures, Unset):
            measures = self.measures

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fields": fields,
                "layout": layout,
                "recordType": record_type,
                "version": version,
            }
        )
        if measures is not UNSET:
            field_dict["measures"] = measures

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.export_field import ExportField

        d = dict(src_dict)
        fields = []
        _fields = d.pop("fields")
        for fields_item_data in _fields:
            fields_item = ExportField.from_dict(fields_item_data)

            fields.append(fields_item)

        layout = BulkExportSchemaLayout(d.pop("layout"))

        record_type = BulkExportSchemaRecordType(d.pop("recordType"))

        version = d.pop("version")

        measures = cast(list[str], d.pop("measures", UNSET))

        bulk_export_schema = cls(
            fields=fields,
            layout=layout,
            record_type=record_type,
            version=version,
            measures=measures,
        )

        bulk_export_schema.additional_properties = d
        return bulk_export_schema

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
