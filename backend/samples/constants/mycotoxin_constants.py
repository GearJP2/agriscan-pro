"""Mycotoxin registry and EU threshold helpers."""

TOXIN_CHOICES = [
    ("AFB1", "Aflatoxin B1"),
    ("DON", "Deoxynivalenol"),
    ("FB1", "Fumonisin B1"),
    ("ZEA", "Zearalenone"),
    ("OTA", "Ochratoxin A"),
    ("T-2", "T-2 Toxin"),
    ("AFG1", "Aflatoxin G1"),
    ("AFG2", "Aflatoxin G2"),
    ("AFM1", "Aflatoxin M1"),
    ("UNKNOWN", "Unknown toxin"),
]

VALID_TOXINS = {code for code, _label in TOXIN_CHOICES}
TOXIN_LABELS = dict(TOXIN_CHOICES)

TOXIN_GROUPS = {
    "Aflatoxins": ["AFB1", "AFG1", "AFG2", "AFM1"],
    "Fusarium": ["DON", "FB1", "ZEA"],
    "Others": ["OTA", "T-2"],
    "Unknown": ["UNKNOWN"],
}

TOXIN_ALIASES = {
    "aflatoxinb1": "AFB1",
    "afb1": "AFB1",
    "deoxynivalenol": "DON",
    "don": "DON",
    "fumonisinb1": "FB1",
    "fb1": "FB1",
    "zearalenone": "ZEA",
    "zea": "ZEA",
    "ochratoxina": "OTA",
    "ota": "OTA",
    "t2toxin": "T-2",
    "t2": "T-2",
    "aflatoxing1": "AFG1",
    "afg1": "AFG1",
    "aflatoxing2": "AFG2",
    "afg2": "AFG2",
    "aflatoxinm1": "AFM1",
    "afm1": "AFM1",
}

# Threshold source: Gruber-Dorninger et al. 2019, Toxins 11, 375, Table 2.
EU_THRESHOLDS = {
    "AFB1": {
        "low": 5,
        "high": 20,
        "unit": "ug/kg",
        "has_data": True,
        "flagged": False,
        "source": "EU max level - Table 2, Gruber-Dorninger et al. 2019",
    },
    "DON": {
        "low": 900,
        "high": 8000,
        "unit": "ug/kg",
        "has_data": True,
        "flagged": False,
        "source": "EU guidance value - Table 2, Gruber-Dorninger et al. 2019",
    },
    "FB1": {
        "low": 5000,
        "high": 60000,
        "unit": "ug/kg",
        "has_data": True,
        "flagged": True,
        "flag_note": (
            "Paper uses total fumonisins (B1+B2+B3), not FB1 alone; "
            "this threshold may overstate the safe range for isolated FB1."
        ),
        "source": (
            "EU guidance value (total FUM) - Table 2, "
            "Gruber-Dorninger et al. 2019"
        ),
    },
    "ZEA": {
        "low": 100,
        "high": 2000,
        "unit": "ug/kg",
        "has_data": True,
        "flagged": False,
        "source": "EU guidance value - Table 2, Gruber-Dorninger et al. 2019",
    },
    "OTA": {
        "low": 50,
        "high": 250,
        "unit": "ug/kg",
        "has_data": True,
        "flagged": False,
        "source": "EU guidance value - Table 2, Gruber-Dorninger et al. 2019",
    },
    "T-2": {
        "low": 0,
        "high": 0,
        "unit": "ug/kg",
        "has_data": False,
        "flagged": True,
        "flag_note": "Threshold data is not available in the selected source table.",
        "source": None,
    },
    "AFG1": {
        "low": 0,
        "high": 0,
        "unit": "ug/kg",
        "has_data": False,
        "flagged": True,
        "flag_note": "Not present in the selected source dataset.",
        "source": None,
    },
    "AFG2": {
        "low": 0,
        "high": 0,
        "unit": "ug/kg",
        "has_data": False,
        "flagged": True,
        "flag_note": "Not present in the selected source dataset.",
        "source": None,
    },
    "AFM1": {
        "low": 0,
        "high": 0,
        "unit": "ug/kg",
        "has_data": False,
        "flagged": True,
        "flag_note": "No threshold value is available in the selected source table.",
        "source": None,
    },
    "UNKNOWN": {
        "low": 0,
        "high": 0,
        "unit": "ug/kg",
        "has_data": False,
        "flagged": True,
        "flag_note": "Original toxin name could not be resolved during migration.",
        "source": None,
    },
}


def normalize_toxin_token(value: str | None) -> str:
    """Normalize display labels and CSV headers into compact lookup tokens."""
    return "".join(ch for ch in str(value or "").lower() if ch.isalnum())


def resolve_toxin_type(value: str | None) -> str | None:
    """Return a canonical toxin code for a user label/header, if one is known."""
    raw = str(value or "").strip().upper()
    if raw in VALID_TOXINS:
        return raw

    token = normalize_toxin_token(value)
    if token in TOXIN_ALIASES:
        return TOXIN_ALIASES[token]

    for alias, toxin_type in TOXIN_ALIASES.items():
        if alias in token:
            return toxin_type
    return None


def get_threshold(toxin_type: str) -> dict:
    """Return threshold metadata for the given toxin type."""
    return EU_THRESHOLDS.get(
        toxin_type,
        {
            "low": 0,
            "high": 0,
            "unit": "ug/kg",
            "has_data": False,
            "flagged": True,
            "flag_note": "Unknown toxin",
            "source": None,
        },
    )


def get_risk_level(toxin_type: str, value: float | None) -> str:
    """Return safe, detected, high, critical, or unclassified."""
    threshold = EU_THRESHOLDS.get(toxin_type)
    if not threshold or not threshold["has_data"] or value is None:
        return "unclassified"
    if value > threshold["high"]:
        return "critical"
    if value > threshold["low"]:
        return "high"
    if value > 0:
        return "detected"
    return "safe"


FLAGGED_TOXINS = {
    code: threshold["flag_note"]
    for code, threshold in EU_THRESHOLDS.items()
    if threshold.get("flagged")
}
