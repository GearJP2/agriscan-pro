from datetime import timedelta
import hashlib
import json
import logging

import requests
from django.conf import settings
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_date

from ..models import ExternalDataCache, Sample
from .analytics_service import AnalyticsService


logger = logging.getLogger('agriscan.samples')

NASA_POWER_PARAMETERS = ['T2M', 'RH2M', 'PRECTOTCORR', 'TS']
NASA_POWER_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/hourly/point'
MISSING_VALUE = -999

DEFAULT_COORDINATES = {
    'label': 'Thailand centroid',
    'latitude': 15.8700,
    'longitude': 100.9925,
}

PROVINCE_COORDINATES = {
    'Amnat Charoen': (15.8657, 104.6258),
    'Ang Thong': (14.5896, 100.4551),
    'Ayutthaya': (14.3532, 100.5689),
    'Bangkok': (13.7563, 100.5018),
    'Bueng Kan': (18.3609, 103.6464),
    'Buriram': (14.9951, 103.1116),
    'Chachoengsao': (13.6904, 101.0779),
    'Chai Nat': (15.1852, 100.1251),
    'Chaiyaphum': (15.8068, 102.0315),
    'Chanthaburi': (12.6113, 102.1038),
    'Chiang Mai': (18.7883, 98.9853),
    'Chiang Rai': (19.9105, 99.8406),
    'Chonburi': (13.3611, 100.9847),
    'Chumphon': (10.4930, 99.1800),
    'Kalasin': (16.4314, 103.5059),
    'Kamphaeng Phet': (16.4828, 99.5220),
    'Kanchanaburi': (14.0228, 99.5328),
    'Khon Kaen': (16.4419, 102.8350),
    'Krabi': (8.0863, 98.9063),
    'Lampang': (18.2888, 99.4909),
    'Lamphun': (18.5745, 99.0087),
    'Loei': (17.4860, 101.7223),
    'Lopburi': (14.7995, 100.6534),
    'Mae Hong Son': (19.3020, 97.9654),
    'Maha Sarakham': (16.0132, 103.1615),
    'Mukdahan': (16.5453, 104.7235),
    'Nakhon Nayok': (14.2069, 101.2131),
    'Nakhon Pathom': (13.8199, 100.0622),
    'Nakhon Phanom': (17.3920, 104.7696),
    'Nakhon Ratchasima': (14.9799, 102.0977),
    'Nakhon Sawan': (15.7047, 100.1372),
    'Nakhon Si Thammarat': (8.4304, 99.9631),
    'Nan': (18.7756, 100.7730),
    'Narathiwat': (6.4254, 101.8253),
    'Nong Bua Lam Phu': (17.2218, 102.4260),
    'Nong Khai': (17.8783, 102.7413),
    'Nonthaburi': (13.8621, 100.5144),
    'Pattani': (6.8695, 101.2505),
    'Pathum Thani': (14.0208, 100.5250),
    'Phayao': (19.1665, 99.9019),
    'Phang Nga': (8.4501, 98.5255),
    'Phatthalung': (7.6167, 100.0740),
    'Phichit': (16.4418, 100.3488),
    'Phitsanulok': (16.8211, 100.2659),
    'Phetchaburi': (13.1112, 99.9398),
    'Phetchabun': (16.4190, 101.1606),
    'Phrae': (18.1446, 100.1403),
    'Phuket': (7.8804, 98.3923),
    'Prachinburi': (14.0509, 101.3727),
    'Prachuap Khiri Khan': (11.8124, 99.7973),
    'Ratchaburi': (13.5283, 99.8134),
    'Rayong': (12.6814, 101.2816),
    'Roi Et': (16.0538, 103.6520),
    'Ranong': (9.9529, 98.6085),
    'Sa Kaeo': (13.8240, 102.0646),
    'Sakon Nakhon': (17.1546, 104.1348),
    'Samut Sakhon': (13.5475, 100.2744),
    'Samut Songkhram': (13.4098, 100.0023),
    'Samut Prakan': (13.5991, 100.5998),
    'Saraburi': (14.5289, 100.9101),
    'Satun': (6.6238, 100.0674),
    'Sing Buri': (14.8936, 100.3967),
    'Sisaket': (15.1186, 104.3220),
    'Songkhla': (7.1898, 100.5951),
    'Sukhothai': (17.0056, 99.8264),
    'Suphan Buri': (14.4745, 100.1177),
    'Surat Thani': (9.1382, 99.3215),
    'Surin': (14.8829, 103.4937),
    'Tak': (16.8838, 99.1258),
    'Trang': (7.5594, 99.6114),
    'Trat': (12.2428, 102.5175),
    'Ubon Ratchathani': (15.2448, 104.8473),
    'Udon Thani': (17.4138, 102.7872),
    'Uthai Thani': (15.3835, 100.0246),
    'Uttaradit': (17.6201, 100.0993),
    'Yala': (6.5411, 101.2804),
    'Yasothon': (15.7926, 104.1453),
}

PROVINCE_ALIASES = {
    'Phra Nakhon Si Ayutthaya': 'Ayutthaya',
}


class NasaPowerServiceError(RuntimeError):
    pass


def _clean_number(value):
    if value is None or value == MISSING_VALUE:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _mean(values):
    numbers = [value for value in values if value is not None]
    if not numbers:
        return None
    return round(sum(numbers) / len(numbers), 2)


def _sum(values):
    numbers = [value for value in values if value is not None]
    if not numbers:
        return None
    return round(sum(numbers), 2)


def _normalize_province_name(value: str | None) -> str | None:
    if not value:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    if cleaned in PROVINCE_COORDINATES:
        return cleaned

    alias = PROVINCE_ALIASES.get(cleaned)
    if alias:
        return alias

    normalized = ''.join(ch for ch in cleaned.lower() if ch.isalnum())
    for province in PROVINCE_COORDINATES:
        candidate = ''.join(ch for ch in province.lower() if ch.isalnum())
        if normalized == candidate:
            return province

    for alias_name, province in PROVINCE_ALIASES.items():
        candidate = ''.join(ch for ch in alias_name.lower() if ch.isalnum())
        if normalized == candidate:
            return province

    return cleaned


class NasaPowerService:
    @staticmethod
    def _validate_parameter_data(parameter_data: dict | None) -> None:
        if not isinstance(parameter_data, dict) or not parameter_data:
            raise NasaPowerServiceError('NASA POWER returned an invalid payload.')

        has_hourly_values = any(
            isinstance(parameter_data.get(parameter), dict) and parameter_data.get(parameter)
            for parameter in NASA_POWER_PARAMETERS
        )
        if not has_hourly_values:
            raise NasaPowerServiceError('NASA POWER returned an invalid payload.')

    @staticmethod
    def _cache_key(params: dict) -> str:
        stable = json.dumps(params, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(stable.encode('utf-8')).hexdigest()

    @staticmethod
    def _get_cached_payload(cache_key: str) -> dict | None:
        now = timezone.now()
        cached = ExternalDataCache.objects.filter(
            source='NASA_POWER',
            cache_key=cache_key,
            expires_at__gt=now,
        ).first()
        return cached.payload if cached else None

    @staticmethod
    def _store_cached_payload(cache_key: str, payload: dict) -> None:
        now = timezone.now()
        ExternalDataCache.objects.update_or_create(
            cache_key=cache_key,
            defaults={
                'source': 'NASA_POWER',
                'payload': payload,
                'expires_at': now + timedelta(hours=settings.NASA_POWER_CACHE_TTL_HOURS),
            },
        )

    @staticmethod
    def _date_window(filters: dict) -> tuple[str, str]:
        date_to = (
            parse_date(filters.get('date_to') or '')
            or Sample.objects.order_by('-collection_date').values_list('collection_date', flat=True).first()
        )
        if date_to is None:
            date_to = timezone.now().date()

        date_from = (
            parse_date(filters.get('date_from') or '')
            or date_to - timedelta(days=settings.NASA_POWER_MAX_DAYS - 1)
        )
        max_start = date_to - timedelta(days=settings.NASA_POWER_MAX_DAYS - 1)
        if date_from < max_start:
            date_from = max_start

        return date_from.strftime('%Y%m%d'), date_to.strftime('%Y%m%d')

    @staticmethod
    def _select_location(filters: dict) -> dict:
        if filters.get('province'):
            selected_province = _normalize_province_name(filters.get('province').split(',')[0])
        else:
            qs = AnalyticsService._apply_filters(Sample.objects.all(), filters)
            province = qs.values('province').annotate(count=Count('id')).order_by('-count').first()
            selected_province = _normalize_province_name(province['province']) if province else None

        coordinates = PROVINCE_COORDINATES.get(selected_province or '')
        if coordinates:
            latitude, longitude = coordinates
            return {
                'label': selected_province,
                'latitude': latitude,
                'longitude': longitude,
            }

        return DEFAULT_COORDINATES.copy()

    @staticmethod
    def _build_request_params(filters: dict) -> dict:
        start, end = NasaPowerService._date_window(filters)
        location = NasaPowerService._select_location(filters)

        return {
            'parameters': ','.join(NASA_POWER_PARAMETERS),
            'community': 'AG',
            'longitude': location['longitude'],
            'latitude': location['latitude'],
            'start': start,
            'end': end,
            'format': 'JSON',
        }

    @staticmethod
    def _daily_points(parameter_data: dict) -> list[dict]:
        by_day: dict[str, dict[str, list[float | None]]] = {}

        for parameter in NASA_POWER_PARAMETERS:
            for timestamp, raw_value in parameter_data.get(parameter, {}).items():
                day = timestamp[:8]
                current = by_day.setdefault(day, {key: [] for key in NASA_POWER_PARAMETERS})
                current[parameter].append(_clean_number(raw_value))

        points = []
        for day, values in sorted(by_day.items()):
            points.append({
                'date': f'{day[:4]}-{day[4:6]}-{day[6:]}',
                'temperatureC': _mean(values['T2M']),
                'relativeHumidityPct': _mean(values['RH2M']),
                'precipitationMmHour': _mean(values['PRECTOTCORR']),
                'soilTemperatureC': _mean(values['TS']),
            })

        return points

    @classmethod
    def get_environmental_correlation(cls, filters: dict) -> dict:
        params = cls._build_request_params(filters)
        location = cls._select_location(filters)
        cache_key = cls._cache_key(params)
        cached_payload = cls._get_cached_payload(cache_key)

        if cached_payload is not None:
            return {
                **cached_payload,
                'cache': {
                    'status': 'hit',
                    'ttlHours': settings.NASA_POWER_CACHE_TTL_HOURS,
                },
            }

        try:
            response = requests.get(
                NASA_POWER_ENDPOINT,
                params=params,
                timeout=settings.NASA_POWER_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning(
                'environmental_correlation.nasa_power_request_failed',
                extra={'error': str(exc)},
            )
            raise NasaPowerServiceError('NASA POWER request failed.') from exc

        parameter_data = payload.get('properties', {}).get('parameter')
        cls._validate_parameter_data(parameter_data)
        points = cls._daily_points(parameter_data)

        result = {
            'source': 'NASA POWER',
            'location': location,
            'parameters': {
                'T2M': {'label': 'Air Temperature', 'unit': 'C'},
                'RH2M': {'label': 'Relative Humidity', 'unit': '%'},
                'PRECTOTCORR': {'label': 'Precipitation', 'unit': 'mm/hour'},
                'TS': {'label': 'Earth Skin Temperature', 'unit': 'C'},
            },
            'request': {
                'start': params['start'],
                'end': params['end'],
                'maxDays': settings.NASA_POWER_MAX_DAYS,
            },
            'summary': {
                'temperatureC': _mean(point['temperatureC'] for point in points),
                'relativeHumidityPct': _mean(point['relativeHumidityPct'] for point in points),
                'precipitationMmHour': _mean(point['precipitationMmHour'] for point in points),
                'precipitationTotalMm': _sum(
                    (point['precipitationMmHour'] or 0) * 24
                    for point in points
                    if point['precipitationMmHour'] is not None
                ),
                'soilTemperatureC': _mean(point['soilTemperatureC'] for point in points),
            },
            'points': points,
        }
        cls._store_cached_payload(cache_key, result)

        return {
            **result,
            'cache': {
                'status': 'miss',
                'ttlHours': settings.NASA_POWER_CACHE_TTL_HOURS,
            },
        }
