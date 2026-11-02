from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_validation_envelope_data_schema_version import (
    AnalysisGeographyValidationEnvelopeDataSchemaVersion,
)

if TYPE_CHECKING:
    from ..models.analysis_geography_validation_envelope_data_supports_item import (
        AnalysisGeographyValidationEnvelopeDataSupportsItem,
    )


T = TypeVar("T", bound="AnalysisGeographyValidationEnvelopeData")


@_attrs_define
class AnalysisGeographyValidationEnvelopeData:
    """
    Attributes:
        analysis_geography_inventory_hash (str):
        content_hash (str):
        crosswalk_inventory_hash (str):
        data_catalog_hash (str):
        schema_version (AnalysisGeographyValidationEnvelopeDataSchemaVersion):
        supports (list[AnalysisGeographyValidationEnvelopeDataSupportsItem]):
    """

    analysis_geography_inventory_hash: str
    content_hash: str
    crosswalk_inventory_hash: str
    data_catalog_hash: str
    schema_version: AnalysisGeographyValidationEnvelopeDataSchemaVersion
    supports: list[AnalysisGeographyValidationEnvelopeDataSupportsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        analysis_geography_inventory_hash = self.analysis_geography_inventory_hash

        content_hash = self.content_hash

        crosswalk_inventory_hash = self.crosswalk_inventory_hash

        data_catalog_hash = self.data_catalog_hash

        schema_version = self.schema_version.value

        supports = []
        for supports_item_data in self.supports:
            supports_item = supports_item_data.to_dict()
            supports.append(supports_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "analysisGeographyInventoryHash": analysis_geography_inventory_hash,
                "contentHash": content_hash,
                "crosswalkInventoryHash": crosswalk_inventory_hash,
                "dataCatalogHash": data_catalog_hash,
                "schemaVersion": schema_version,
                "supports": supports,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_geography_validation_envelope_data_supports_item import (
            AnalysisGeographyValidationEnvelopeDataSupportsItem,
        )

        d = dict(src_dict)
        analysis_geography_inventory_hash = d.pop("analysisGeographyInventoryHash")

        content_hash = d.pop("contentHash")

        crosswalk_inventory_hash = d.pop("crosswalkInventoryHash")

        data_catalog_hash = d.pop("dataCatalogHash")

        schema_version = AnalysisGeographyValidationEnvelopeDataSchemaVersion(
            d.pop("schemaVersion")
        )

        supports = []
        _supports = d.pop("supports")
        for supports_item_data in _supports:
            supports_item = (
                AnalysisGeographyValidationEnvelopeDataSupportsItem.from_dict(
                    supports_item_data
                )
            )

            supports.append(supports_item)

        analysis_geography_validation_envelope_data = cls(
            analysis_geography_inventory_hash=analysis_geography_inventory_hash,
            content_hash=content_hash,
            crosswalk_inventory_hash=crosswalk_inventory_hash,
            data_catalog_hash=data_catalog_hash,
            schema_version=schema_version,
            supports=supports,
        )

        analysis_geography_validation_envelope_data.additional_properties = d
        return analysis_geography_validation_envelope_data

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
