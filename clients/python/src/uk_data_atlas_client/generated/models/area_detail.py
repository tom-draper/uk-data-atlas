from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_detail_capabilities import AreaDetailCapabilities
    from ..models.area_detail_citation import AreaDetailCitation
    from ..models.area_detail_dossier import AreaDetailDossier
    from ..models.area_metrics import AreaMetrics
    from ..models.area_postcode_counts import AreaPostcodeCounts


T = TypeVar("T", bound="AreaDetail")


@_attrs_define
class AreaDetail:
    """
    Attributes:
        boundary_release (str):
        code (str):
        geography (str):
        id (str):
        name (str):
        aliases (list[str] | Unset):
        capabilities (AreaDetailCapabilities | Unset): Present only with `include=capabilities`; what the API can serve
            for this exact area: `geometry`, `relationships`, `namedLocations` and `data`.
        citation (AreaDetailCitation | Unset): Present only with `include=citation`; the artifacts that serve this area,
            pinned by content hash, with their attribution and licences.
        dossier (AreaDetailDossier | Unset): Present only with `include=dossier`; boundary evidence, availability and
            links for this exact area identity.
        metrics (AreaMetrics | Unset): Present only with `include=metrics`; measurements of the area's published
            boundary, with the method that produced them.
        postcodes (AreaPostcodeCounts | Unset): Unit postcode centroid counts for this area, compiled from the ONS
            Postcode Directory. `live` is the number with no termination date; `terminated` is retained historical directory
            records; `largeUser` is the live subset marked as serving a single large user. A postcode on a shared area
            boundary may be counted in each area it touches.
    """

    boundary_release: str
    code: str
    geography: str
    id: str
    name: str
    aliases: list[str] | Unset = UNSET
    capabilities: AreaDetailCapabilities | Unset = UNSET
    citation: AreaDetailCitation | Unset = UNSET
    dossier: AreaDetailDossier | Unset = UNSET
    metrics: AreaMetrics | Unset = UNSET
    postcodes: AreaPostcodeCounts | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        code = self.code

        geography = self.geography

        id = self.id

        name = self.name

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        capabilities: dict[str, Any] | Unset = UNSET
        if not isinstance(self.capabilities, Unset):
            capabilities = self.capabilities.to_dict()

        citation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.citation, Unset):
            citation = self.citation.to_dict()

        dossier: dict[str, Any] | Unset = UNSET
        if not isinstance(self.dossier, Unset):
            dossier = self.dossier.to_dict()

        metrics: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metrics, Unset):
            metrics = self.metrics.to_dict()

        postcodes: dict[str, Any] | Unset = UNSET
        if not isinstance(self.postcodes, Unset):
            postcodes = self.postcodes.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "code": code,
                "geography": geography,
                "id": id,
                "name": name,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if capabilities is not UNSET:
            field_dict["capabilities"] = capabilities
        if citation is not UNSET:
            field_dict["citation"] = citation
        if dossier is not UNSET:
            field_dict["dossier"] = dossier
        if metrics is not UNSET:
            field_dict["metrics"] = metrics
        if postcodes is not UNSET:
            field_dict["postcodes"] = postcodes

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_detail_capabilities import AreaDetailCapabilities
        from ..models.area_detail_citation import AreaDetailCitation
        from ..models.area_detail_dossier import AreaDetailDossier
        from ..models.area_metrics import AreaMetrics
        from ..models.area_postcode_counts import AreaPostcodeCounts

        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code = d.pop("code")

        geography = d.pop("geography")

        id = d.pop("id")

        name = d.pop("name")

        aliases = cast(list[str], d.pop("aliases", UNSET))

        _capabilities = d.pop("capabilities", UNSET)
        capabilities: AreaDetailCapabilities | Unset
        if isinstance(_capabilities, Unset):
            capabilities = UNSET
        else:
            capabilities = AreaDetailCapabilities.from_dict(_capabilities)

        _citation = d.pop("citation", UNSET)
        citation: AreaDetailCitation | Unset
        if isinstance(_citation, Unset):
            citation = UNSET
        else:
            citation = AreaDetailCitation.from_dict(_citation)

        _dossier = d.pop("dossier", UNSET)
        dossier: AreaDetailDossier | Unset
        if isinstance(_dossier, Unset):
            dossier = UNSET
        else:
            dossier = AreaDetailDossier.from_dict(_dossier)

        _metrics = d.pop("metrics", UNSET)
        metrics: AreaMetrics | Unset
        if isinstance(_metrics, Unset):
            metrics = UNSET
        else:
            metrics = AreaMetrics.from_dict(_metrics)

        _postcodes = d.pop("postcodes", UNSET)
        postcodes: AreaPostcodeCounts | Unset
        if isinstance(_postcodes, Unset):
            postcodes = UNSET
        else:
            postcodes = AreaPostcodeCounts.from_dict(_postcodes)

        area_detail = cls(
            boundary_release=boundary_release,
            code=code,
            geography=geography,
            id=id,
            name=name,
            aliases=aliases,
            capabilities=capabilities,
            citation=citation,
            dossier=dossier,
            metrics=metrics,
            postcodes=postcodes,
        )

        area_detail.additional_properties = d
        return area_detail

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
