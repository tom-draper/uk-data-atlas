from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.crosswalk_weighting_type_1_basis import CrosswalkWeightingType1Basis
from ..models.crosswalk_weighting_type_1_normalisation import (
    CrosswalkWeightingType1Normalisation,
)
from ..models.crosswalk_weighting_type_1_status import CrosswalkWeightingType1Status

T = TypeVar("T", bound="CrosswalkWeightingType1")


@_attrs_define
class CrosswalkWeightingType1:
    """Each record's target weights are shares of the source's area covered by its published targets, and sum to 1 within
    rounding.

        Attributes:
            basis (CrosswalkWeightingType1Basis):
            normalisation (CrosswalkWeightingType1Normalisation):
            status (CrosswalkWeightingType1Status):
    """

    basis: CrosswalkWeightingType1Basis
    normalisation: CrosswalkWeightingType1Normalisation
    status: CrosswalkWeightingType1Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        basis = self.basis.value

        normalisation = self.normalisation.value

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "basis": basis,
                "normalisation": normalisation,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        basis = CrosswalkWeightingType1Basis(d.pop("basis"))

        normalisation = CrosswalkWeightingType1Normalisation(d.pop("normalisation"))

        status = CrosswalkWeightingType1Status(d.pop("status"))

        crosswalk_weighting_type_1 = cls(
            basis=basis,
            normalisation=normalisation,
            status=status,
        )

        crosswalk_weighting_type_1.additional_properties = d
        return crosswalk_weighting_type_1

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
