"""Query-string filter helpers for the SampleViewSet.

Keeps the viewset thin by isolating each query parameter's filter logic in a
dedicated function. Risk-level filtering is the most involved branch because
it derives from MycotoxinResult rows rather than a column on Sample itself.
"""

from django.db.models import Exists, OuterRef, Q

from .models import MycotoxinResult


def _filter_status(queryset, value: str):
    """Filter by one or more comma-separated status values."""
    statuses = [s for s in value.split(",") if s]
    return queryset.filter(status__in=statuses) if statuses else queryset


def _filter_date_range(queryset, date_from: str | None, date_to: str | None):
    """Apply inclusive collection_date range bounds when present."""
    if date_from:
        queryset = queryset.filter(collection_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(collection_date__lte=date_to)
    return queryset


def _filter_risk_level(queryset, value: str):
    """Filter by threshold-derived risk levels (high/low/medium/safe)."""
    requested = {token for token in value.split(",") if token}
    if not requested:
        return queryset

    risk_filter = Q()
    if "high" in requested:
        risk_filter |= Exists(
            MycotoxinResult.objects.filter(
                sample=OuterRef("pk"),
                risk_level__in=["high", "critical"],
            )
        )
    if requested.intersection({"low", "medium"}):
        risk_filter |= Exists(
            MycotoxinResult.objects.filter(
                sample=OuterRef("pk"),
                risk_level="detected",
            )
        )
    if "safe" in requested:
        risk_filter |= (
            Exists(
                MycotoxinResult.objects.filter(
                    sample=OuterRef("pk"),
                    risk_level="safe",
                )
            )
            | ~Exists(MycotoxinResult.objects.filter(sample=OuterRef("pk")))
        )

    return queryset.filter(risk_filter) if risk_filter else queryset


def apply_sample_filters(queryset, params):
    """Apply every supported query-param filter to a Sample queryset."""
    if status_param := params.get("status"):
        queryset = _filter_status(queryset, status_param)

    for field in ("region", "province"):
        if value := params.get(field):
            queryset = queryset.filter(**{field: value})

    if vegetation := params.get("vegetation"):
        queryset = queryset.filter(vegetation_variety=vegetation)

    queryset = _filter_date_range(
        queryset,
        params.get("date_from"),
        params.get("date_to"),
    )

    if risk_level := params.get("risk_level"):
        queryset = _filter_risk_level(queryset, risk_level)

    return queryset
