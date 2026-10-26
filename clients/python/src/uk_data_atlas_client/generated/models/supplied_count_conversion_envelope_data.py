from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.supplied_count_conversion_envelope_data_method import (
    SuppliedCountConversionEnvelopeDataMethod,
)
from ..models.supplied_count_conversion_envelope_data_semantics import (
    SuppliedCountConversionEnvelopeDataSemantics,
)

if TYPE_CHECKING:
    from ..models.crosswalk_side import CrosswalkSide
    from ..models.supplied_count_conversion_envelope_data_coverage import (
        SuppliedCountConversionEnvelopeDataCoverage,
    )
    from ..models.supplied_count_conversion_envelope_data_crosswalk import (
        SuppliedCountConversionEnvelopeDataCrosswalk,
    )
    from ..models.supplied_count_conversion_envelope_data_input import (
        SuppliedCountConversionEnvelopeDataInput,
    )
    from ..models.supplied_count_conversion_envelope_data_records_item import (
        SuppliedCountConversionEnvelopeDataRecordsItem,
    )


T = TypeVar("T", bound="SuppliedCountConversionEnvelopeData")


@_attrs_define
class SuppliedCountConversionEnvelopeData:
    """
    Attributes:
        coverage (SuppliedCountConversionEnvelopeDataCoverage):
        crosswalk (SuppliedCountConversionEnvelopeDataCrosswalk):
        from_ (CrosswalkSide):
        input_ (SuppliedCountConversionEnvelopeDataInput):
        input_total (float):
        method (SuppliedCountConversionEnvelopeDataMethod):
        note (str):
        output_total (float):
        records (list[SuppliedCountConversionEnvelopeDataRecordsItem]):
        semantics (SuppliedCountConversionEnvelopeDataSemantics):
        to (CrosswalkSide):
    """

    coverage: SuppliedCountConversionEnvelopeDataCoverage
    crosswalk: SuppliedCountConversionEnvelopeDataCrosswalk
    from_: CrosswalkSide
    input_: SuppliedCountConversionEnvelopeDataInput
    input_total: float
    method: SuppliedCountConversionEnvelopeDataMethod
    note: str
    output_total: float
    records: list[SuppliedCountConversionEnvelopeDataRecordsItem]
    semantics: SuppliedCountConversionEnvelopeDataSemantics
    to: CrosswalkSide
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        coverage = self.coverage.to_dict()

        crosswalk = self.crosswalk.to_dict()

        from_ = self.from_.to_dict()

        input_ = self.input_.to_dict()

        input_total = self.input_total

        method = self.method.value

        note = self.note

        output_total = self.output_total

        records = []
        for records_item_data in self.records:
            records_item = records_item_data.to_dict()
            records.append(records_item)

        semantics = self.semantics.value

        to = self.to.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coverage": coverage,
                "crosswalk": crosswalk,
                "from": from_,
                "input": input_,
                "inputTotal": input_total,
                "method": method,
                "note": note,
                "outputTotal": output_total,
                "records": records,
                "semantics": semantics,
                "to": to,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_side import CrosswalkSide
        from ..models.supplied_count_conversion_envelope_data_coverage import (
            SuppliedCountConversionEnvelopeDataCoverage,
        )
        from ..models.supplied_count_conversion_envelope_data_crosswalk import (
            SuppliedCountConversionEnvelopeDataCrosswalk,
        )
        from ..models.supplied_count_conversion_envelope_data_input import (
            SuppliedCountConversionEnvelopeDataInput,
        )
        from ..models.supplied_count_conversion_envelope_data_records_item import (
            SuppliedCountConversionEnvelopeDataRecordsItem,
        )

        d = dict(src_dict)
        coverage = SuppliedCountConversionEnvelopeDataCoverage.from_dict(
            d.pop("coverage")
        )

        crosswalk = SuppliedCountConversionEnvelopeDataCrosswalk.from_dict(
            d.pop("crosswalk")
        )

        from_ = CrosswalkSide.from_dict(d.pop("from"))

        input_ = SuppliedCountConversionEnvelopeDataInput.from_dict(d.pop("input"))

        input_total = d.pop("inputTotal")

        method = SuppliedCountConversionEnvelopeDataMethod(d.pop("method"))

        note = d.pop("note")

        output_total = d.pop("outputTotal")

        records = []
        _records = d.pop("records")
        for records_item_data in _records:
            records_item = SuppliedCountConversionEnvelopeDataRecordsItem.from_dict(
                records_item_data
            )

            records.append(records_item)

        semantics = SuppliedCountConversionEnvelopeDataSemantics(d.pop("semantics"))

        to = CrosswalkSide.from_dict(d.pop("to"))

        supplied_count_conversion_envelope_data = cls(
            coverage=coverage,
            crosswalk=crosswalk,
            from_=from_,
            input_=input_,
            input_total=input_total,
            method=method,
            note=note,
            output_total=output_total,
            records=records,
            semantics=semantics,
            to=to,
        )

        supplied_count_conversion_envelope_data.additional_properties = d
        return supplied_count_conversion_envelope_data

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
