from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.crosswalk_metadata_provenance_type_1_area_projection import (
    CrosswalkMetadataProvenanceType1AreaProjection,
)

if TYPE_CHECKING:
    from ..models.crosswalk_metadata_provenance_type_1_inputs_item import (
        CrosswalkMetadataProvenanceType1InputsItem,
    )


T = TypeVar("T", bound="CrosswalkMetadataProvenanceType1")


@_attrs_define
class CrosswalkMetadataProvenanceType1:
    """The two boundary geometries an `area-overlap` crosswalk intersects, how areas were measured, and the clipping
    library that computed each intersection.

        Attributes:
            area_projection (CrosswalkMetadataProvenanceType1AreaProjection): Lambert cylindrical equal-area on the WGS 84
                ellipsoid, so every area is an ellipsoidal area in square metres.
            clipping (str): Clipping library and version, e.g. `polygon-clipping@0.15.7`.
            inputs (list[CrosswalkMetadataProvenanceType1InputsItem]):
    """

    area_projection: CrosswalkMetadataProvenanceType1AreaProjection
    clipping: str
    inputs: list[CrosswalkMetadataProvenanceType1InputsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_projection = self.area_projection.value

        clipping = self.clipping

        inputs = []
        for inputs_item_data in self.inputs:
            inputs_item = inputs_item_data.to_dict()
            inputs.append(inputs_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaProjection": area_projection,
                "clipping": clipping,
                "inputs": inputs,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_metadata_provenance_type_1_inputs_item import (
            CrosswalkMetadataProvenanceType1InputsItem,
        )

        d = dict(src_dict)
        area_projection = CrosswalkMetadataProvenanceType1AreaProjection(
            d.pop("areaProjection")
        )

        clipping = d.pop("clipping")

        inputs = []
        _inputs = d.pop("inputs")
        for inputs_item_data in _inputs:
            inputs_item = CrosswalkMetadataProvenanceType1InputsItem.from_dict(
                inputs_item_data
            )

            inputs.append(inputs_item)

        crosswalk_metadata_provenance_type_1 = cls(
            area_projection=area_projection,
            clipping=clipping,
            inputs=inputs,
        )

        crosswalk_metadata_provenance_type_1.additional_properties = d
        return crosswalk_metadata_provenance_type_1

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
