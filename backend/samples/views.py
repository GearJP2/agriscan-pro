import logging
import csv
import re
from io import TextIOWrapper
from django.db import IntegrityError
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from celery.result import AsyncResult
from .models import Sample, ProcessLog, MycotoxinResult
from .serializers import (
    SampleSerializer,
    SampleListSerializer,
    SampleCreateUpdateSerializer,
    ProcessLogSerializer,
    MycotoxinResultSerializer,
)
from core.exceptions import SampleAlreadyExists
from .services.s3_service import generate_upload_url
from .tasks import process_sample_file

logger = logging.getLogger('agriscan.samples')

TOXIN_DEFAULTS = {
    'AFB1': {'threshold': 5.0, 'unit': 'ppb'},
    'AFB2': {'threshold': 5.0, 'unit': 'ppb'},
    'AFG1': {'threshold': 5.0, 'unit': 'ppb'},
    'AFG2': {'threshold': 5.0, 'unit': 'ppb'},
    'AFM1': {'threshold': 0.5, 'unit': 'ppb'},
    'AF': {'threshold': 5.0, 'unit': 'ppb'},
    'DON': {'threshold': 1000.0, 'unit': 'ppb'},
    'FB1': {'threshold': 2000.0, 'unit': 'ppb'},
    'T-2': {'threshold': 100.0, 'unit': 'ppb'},
    'ZEA': {'threshold': 200.0, 'unit': 'ppb'},
    'OTA': {'threshold': 5.0, 'unit': 'ppb'},
}

TOXIN_ALIASES = {
    'don': 'DON',
    'deoxynivalenol': 'DON',
    'afb1': 'AFB1',
    'aflatoxinb1': 'AFB1',
    'aflatoxin b1': 'AFB1',
    'afb2': 'AFB2',
    'aflatoxinb2': 'AFB2',
    'aflatoxin b2': 'AFB2',
    'afg1': 'AFG1',
    'aflatoxing1': 'AFG1',
    'aflatoxin g1': 'AFG1',
    'afg2': 'AFG2',
    'aflatoxing2': 'AFG2',
    'aflatoxin g2': 'AFG2',
    'afm1': 'AFM1',
    'aflatoxinm1': 'AFM1',
    'aflatoxin m1': 'AFM1',
    'af': 'AF',
    'aflatoxin': 'AF',
    'fb1': 'FB1',
    'fumonisinb1': 'FB1',
    'fumonisin b1': 'FB1',
    't2': 'T-2',
    't-2': 'T-2',
    't 2': 'T-2',
    't2toxin': 'T-2',
    't-2 toxin': 'T-2',
    'zea': 'ZEA',
    'zearalenone': 'ZEA',
    'ota': 'OTA',
    'ochratoxina': 'OTA',
    'ochratoxin a': 'OTA',
}


class SampleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing samples.
    Provides CRUD operations and filtering capabilities.
    """
    queryset = Sample.objects.prefetch_related('process_logs', 'mycotoxin_results').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sample_id', 'region', 'vegetation_variety']
    ordering_fields = ['collection_date', 'created_at', 'status']
    ordering = ['-collection_date']
    lookup_field = 'sample_id'

    @staticmethod
    def _normalize_token(value):
        return re.sub(r'[^a-z0-9]+', '', str(value or '').strip().lower())

    @classmethod
    def _row_value(cls, row, candidate_keys):
        """Read a CSV row value using normalized header matching."""
        normalized_map = {}
        for key, value in (row or {}).items():
            key_norm = cls._normalize_token(key)
            if key_norm and key_norm not in normalized_map:
                normalized_map[key_norm] = value

        for key in candidate_keys:
            direct = row.get(key)
            if direct is not None:
                return direct
            matched = normalized_map.get(cls._normalize_token(key))
            if matched is not None:
                return matched
        return None

    @staticmethod
    def _normalize_sample_id(value):
        if value is None:
            return ''
        text = str(value).strip().upper()
        # Normalize common Unicode dashes to plain hyphen.
        text = text.replace('\u2010', '-').replace('\u2011', '-').replace('\u2012', '-').replace('\u2013', '-').replace('\u2014', '-')
        # Remove all internal whitespace that often comes from Excel copy/paste.
        text = re.sub(r'\s+', '', text)

        # Normalize numeric segments so 073 and 73 are treated the same.
        parts = text.split('-')
        normalized_parts = []
        for part in parts:
            if part.isdigit():
                normalized_parts.append(str(int(part)))
            else:
                normalized_parts.append(part)
        text = '-'.join(normalized_parts)

        return text

    @staticmethod
    def _is_header_like_sample_id(value):
        token = re.sub(r'[^A-Z0-9]+', '', str(value or '').upper())
        return token in {
            '',
            'NAME',
            'SAMPLE',
            'SAMPLEID',
            'SAMPLECODE',
            'ACQDATETIME',
            'DATE',
            'DATETIME',
        }

    @staticmethod
    def _is_datetime_like(value):
        text = str(value or '').strip()
        if not text:
            return False
        # Common datetime patterns from lab exports: 3/13/26 11:46, 2026-03-13 11:46
        return bool(
            re.match(r'^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$', text)
            or re.match(r'^\d{1,2}:\d{2}(:\d{2})?$', text)
        )

    @staticmethod
    def _looks_like_sample_id(value):
        text = str(value or '').strip().upper()
        if not text:
            return False
        if SampleViewSet._is_datetime_like(text):
            return False
        # Typical IDs have at least one letter and one digit.
        return bool(re.search(r'[A-Z]', text) and re.search(r'\d', text))

    @classmethod
    def _extract_row_sample_id(cls, row):
        candidates = []

        key_groups = [
            ['sample_id', 'sample id', 'sampleid', 'sample_code', 'sample code'],
            ['name'],
            ['sample'],
            [''],
        ]

        for keys in key_groups:
            value = cls._row_value(row, keys)
            display = str(value or '').strip()
            if not display:
                continue
            normalized = cls._normalize_sample_id(display)
            if cls._is_header_like_sample_id(normalized):
                continue
            candidates.append((display, normalized))

        if not candidates:
            return '', ''

        for display, normalized in candidates:
            if cls._looks_like_sample_id(display):
                return display, normalized

        for display, normalized in candidates:
            if not cls._is_datetime_like(display):
                return display, normalized

        return candidates[0]

    @classmethod
    def _resolve_toxin_name(cls, value):
        raw = str(value or '').strip()
        if not raw:
            return None

        direct = raw.upper()
        if direct in TOXIN_DEFAULTS:
            return direct

        normalized = cls._normalize_token(raw)
        if normalized in TOXIN_ALIASES:
            return TOXIN_ALIASES[normalized]

        for alias, canonical in TOXIN_ALIASES.items():
            if alias in normalized:
                return canonical
        return None

    @staticmethod
    def _parse_numeric(value, below_lod_as_zero=False):
        text = str(value or '').strip()
        if not text:
            return None

        lowered = text.lower()
        if lowered in {'nd', 'bdl', '<lod', 'lod', 'n/a', '-', '#value!'}:
            return 0.0 if below_lod_as_zero else None
        if lowered.startswith('<'):
            return 0.0 if below_lod_as_zero else None

        normalized = text.replace(',', '.') if (',' in text and '.' not in text) else text.replace(',', '')
        match = re.search(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', normalized)
        if not match:
            return None

        try:
            return float(match.group(0))
        except ValueError:
            return None

    @staticmethod
    def _parse_bool(value):
        lowered = str(value or '').strip().lower()
        if lowered in {'true', 'yes', 'y', '1', 'danger', 'dangerous', 'positive', 'detected'}:
            return True
        if lowered in {'false', 'no', 'n', '0', 'safe', 'negative', 'not detected', 'nondetected'}:
            return False
        return None

    @classmethod
    def _extract_results_from_row(cls, row):
        # Long format: one toxin per row
        toxin_key = cls._row_value(row, ['mycotoxin', 'mycotoxin_name', 'toxin', 'name'])
        if toxin_key:
            toxin_name = cls._resolve_toxin_name(toxin_key) or str(toxin_key).strip().upper()
            threshold_default = TOXIN_DEFAULTS.get(toxin_name, {}).get('threshold', 0.0)
            unit_default = TOXIN_DEFAULTS.get(toxin_name, {}).get('unit', 'ppb')
            intensity = cls._parse_numeric(
                cls._row_value(row, ['intensity', 'result', 'value', 'concentration']),
                below_lod_as_zero=True,
            )
            if intensity is None:
                return []

            threshold = cls._parse_numeric(cls._row_value(row, ['threshold', 'limit']))
            threshold = threshold if threshold is not None else threshold_default
            dangerous = cls._parse_bool(cls._row_value(row, ['dangerous', 'risk', 'detected', 'is_detected']))
            if dangerous is None:
                dangerous = bool(threshold and intensity > threshold)
            is_detected = intensity > 0

            return [{
                'name': toxin_name,
                'intensity': intensity,
                'is_detected': is_detected,
                'threshold': threshold,
                'unit': str(cls._row_value(row, ['unit']) or unit_default or 'ppb').strip() or 'ppb',
                'dangerous': dangerous,
                'test_method': str(cls._row_value(row, ['test_method', 'method']) or 'Imported CSV').strip(),
            }]

        # Wide format: toxin columns in the same row
        ignored_headers = {
            'sampleid', 'sample_id', 'sample id',
            'region', 'province', 'district', 'variety', 'collection date', 'status',
        }
        results = []
        for key, raw_value in row.items():
            if not key:
                continue
            key_clean = key.strip()
            if cls._normalize_token(key_clean) in {cls._normalize_token(h) for h in ignored_headers}:
                continue

            toxin_name = cls._resolve_toxin_name(key_clean)
            if not toxin_name:
                continue

            intensity = cls._parse_numeric(raw_value, below_lod_as_zero=True)
            if intensity is None:
                continue

            threshold = TOXIN_DEFAULTS.get(toxin_name, {}).get('threshold', 0.0)
            results.append({
                'name': toxin_name,
                'intensity': intensity,
                'is_detected': intensity > 0,
                'threshold': threshold,
                'unit': TOXIN_DEFAULTS.get(toxin_name, {}).get('unit', 'ppb'),
                'dangerous': bool(threshold and intensity > threshold),
                'test_method': 'Imported CSV',
            })

        return results

    def get_serializer_class(self):
        if self.action == 'list':
            return SampleListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SampleCreateUpdateSerializer
        return SampleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        # Filter by region
        region = self.request.query_params.get('region')
        if region:
            queryset = queryset.filter(region=region)
        
        # Filter by vegetation variety
        vegetation = self.request.query_params.get('vegetation')
        if vegetation:
            queryset = queryset.filter(vegetation_variety=vegetation)
        
        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(collection_date__gte=date_from)
        
        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(collection_date__lte=date_to)
        
        return queryset

    def perform_create(self, serializer):
        sample = serializer.save(updated_by=self.request.user)
        logger.info('sample.created', extra={'sample_id': sample.sample_id, 'user': self.request.user.username})
        # Create initial process log for new samples
        if not sample.process_logs.exists():
            ProcessLog.objects.create(
                sample=sample,
                state='registered',
                notes='Sample created',
                conducted_by=self.request.user.username
            )

    def perform_update(self, serializer):
        sample = serializer.save(updated_by=self.request.user)
        logger.info('sample.updated', extra={'sample_id': sample.sample_id, 'user': self.request.user.username})

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'):
            return Response(
                {'detail': 'You do not have permission to delete samples. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        # Collect audit data before CASCADE deletion removes related records
        process_log_count = instance.process_logs.count()
        mycotoxin_count = instance.mycotoxin_results.count()
        sample_id = instance.sample_id
        logger.warning(
            'sample.deleted',
            extra={
                'sample_id': sample_id,
                'region': instance.region,
                'province': instance.province,
                'vegetation_variety': instance.vegetation_variety,
                'collection_date': str(instance.collection_date),
                'process_logs_deleted': process_log_count,
                'mycotoxin_results_deleted': mycotoxin_count,
                'deleted_by': request.user.username,
            },
        )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    RECENT_ALERTS_LIMIT = 10

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get dashboard statistics"""
        stats = Sample.objects.aggregate(
            total_samples=Count('id'),
            completed=Count('id', filter=Q(status='completed')),
            flagged=Count('id', filter=Q(status='flagged')),
            pending=Count('id', filter=Q(status='pending')),
            high_risk=Count('id', filter=Q(mycotoxin_results__dangerous=True), distinct=True),
        )
        return Response(stats)

    @action(detail=False, methods=['get'])
    def recent_alerts(self, request):
        """Get recently flagged samples"""
        recent = Sample.objects.filter(
            status='flagged'
        ).order_by('-updated_at')[:self.RECENT_ALERTS_LIMIT]
        serializer = SampleListSerializer(recent, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_process_log(self, request, sample_id=None):
        """Add a process log entry to a sample"""
        sample = self.get_object()
        serializer = ProcessLogSerializer(data=request.data)
        if serializer.is_valid():
            process_log = serializer.save(sample=sample)
            logger.info('sample.process_log.added', extra={'sample_id': sample.sample_id, 'state': process_log.state})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create samples"""
        data = request.data if isinstance(request.data, list) else [request.data]

        # Check for existing sample_ids before validation (returns 409 instead of 400)
        incoming_ids = [item.get('sample_id') for item in data if isinstance(item, dict) and item.get('sample_id')]
        if incoming_ids:
            existing = list(Sample.objects.filter(sample_id__in=incoming_ids).values_list('sample_id', flat=True))
            if existing:
                raise SampleAlreadyExists(detail=f"Sample ID(s) already exist: {', '.join(existing)}")

        serializer = SampleCreateUpdateSerializer(data=data, many=True)
        if not serializer.is_valid():
            logger.error('sample.bulk_create.validation_error', extra={'error_count': len(serializer.errors), 'user': self.request.user.username})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        samples = []
        for validated_item in serializer.validated_data:
            # Create sample using the serializer's create method to apply defaults
            # Set defaults for empty/null fields
            if not validated_item.get('purpose'):
                validated_item['purpose'] = 'routine'
            if not validated_item.get('sample_type'):
                validated_item['sample_type'] = 'field'
            if not validated_item.get('processing_type'):
                validated_item['processing_type'] = 'raw'
            if not validated_item.get('collected_by'):
                validated_item['collected_by'] = 'Imported'
            if not validated_item.get('additional_info'):
                validated_item['additional_info'] = ''
            
            # Create sample with updated_by field
            try:
                sample = Sample.objects.create(**validated_item, updated_by=request.user)
            except IntegrityError:
                raise SampleAlreadyExists(detail=f"Sample ID '{validated_item.get('sample_id')}' already exists.")
            samples.append(sample)

            # Create initial process log based on imported status.
            initial_state = 'completed' if sample.status == 'completed' else 'registered'
            initial_note = (
                'Bulk imported with recorded results.'
                if initial_state == 'completed'
                else f'Bulk imported - {len(data)} samples'
            )
            ProcessLog.objects.create(
                sample=sample,
                state=initial_state,
                notes=initial_note,
                conducted_by=request.user.username or 'System'
            )

        logger.info('sample.bulk_created', extra={'count': len(samples), 'user': self.request.user.username})
        return Response(SampleSerializer(samples, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_mycotoxin_result(self, request, sample_id=None):
        """Add a mycotoxin test result to a sample"""
        sample = self.get_object()
        serializer = MycotoxinResultSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save(sample=sample)

            # If results are recorded, mark the sample workflow as completed.
            if sample.status != 'completed':
                sample.status = 'completed'
                sample.updated_by = request.user
                sample.save(update_fields=['status', 'updated_by', 'updated_at'])

            latest_log = sample.process_logs.order_by('-timestamp').first()
            if not latest_log or latest_log.state != 'completed':
                ProcessLog.objects.create(
                    sample=sample,
                    state='completed',
                    notes='Mycotoxin result(s) recorded and finalized.',
                    conducted_by=request.user.username or 'System',
                )

            logger.info('sample.mycotoxin_result.added', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'dangerous': result.dangerous})
            if result.dangerous:
                logger.warning('sample.dangerous_result', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'intensity': result.intensity})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_import_results(self, request):
        """Import mycotoxin results from CSV and match rows by sample_id."""
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file is required (CSV).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wrapped = TextIOWrapper(uploaded_file.file, encoding='utf-8-sig')
            rows = list(csv.DictReader(wrapped))
        except Exception:
            return Response({'detail': 'Unable to parse CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({'detail': 'CSV has no data rows.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_ids_for_exact_lookup = []
        normalized_ids = set()
        for row in rows:
            sid_display, sid = self._extract_row_sample_id(row)
            if not sid:
                continue
            raw_ids_for_exact_lookup.append(sid_display)
            normalized_ids.add(sid)

        sample_map = {
            self._normalize_sample_id(sample.sample_id): sample
            for sample in Sample.objects.filter(sample_id__in=set(raw_ids_for_exact_lookup)).all()
        }

        # Fallback: if exact lookup misses (e.g., 073 vs 73), match by normalized ID.
        missing_norm_ids = normalized_ids - set(sample_map.keys())
        if missing_norm_ids:
            for sample in Sample.objects.all():
                norm = self._normalize_sample_id(sample.sample_id)
                if norm in missing_norm_ids and norm not in sample_map:
                    sample_map[norm] = sample

        created_count = 0
        updated_count = 0
        skipped_rows = 0
        unmatched_sample_ids = set()
        touched_samples = set()

        for row in rows:
            sid_display, sid = self._extract_row_sample_id(row)
            if not sid:
                skipped_rows += 1
                continue

            sample = sample_map.get(sid)
            if not sample:
                unmatched_sample_ids.add(sid_display or sid)
                continue

            results = self._extract_results_from_row(row)
            if not results:
                skipped_rows += 1
                continue

            for payload in results:
                _, created = MycotoxinResult.objects.update_or_create(
                    sample=sample,
                    name=payload['name'],
                    defaults={
                        'intensity': payload['intensity'],
                        'is_detected': payload.get('is_detected', payload['intensity'] > 0),
                        'dangerous': payload['dangerous'],
                        'threshold': payload['threshold'],
                        'unit': payload['unit'],
                        'test_method': payload.get('test_method') or 'Imported CSV',
                    },
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                touched_samples.add(sid)

        # Mark matched samples as completed and add completion log where needed.
        for sample_id in touched_samples:
            sample = sample_map[sample_id]
            if sample.status != 'completed':
                sample.status = 'completed'
                sample.updated_by = request.user
                sample.save(update_fields=['status', 'updated_by', 'updated_at'])

            latest_log = sample.process_logs.order_by('-timestamp').first()
            if not latest_log or latest_log.state != 'completed':
                ProcessLog.objects.create(
                    sample=sample,
                    state='completed',
                    notes='Mycotoxin results imported from CSV.',
                    conducted_by=request.user.username or 'System',
                )

        logger.info(
            'sample.bulk_import_results.completed',
            extra={
                'rows': len(rows),
                'matched_samples': len(touched_samples),
                'created_results': created_count,
                'updated_results': updated_count,
                'unmatched_count': len(unmatched_sample_ids),
                'user': request.user.username,
            },
        )

        return Response(
            {
                'rows_processed': len(rows),
                'matched_samples': len(touched_samples),
                'results_created': created_count,
                'results_updated': updated_count,
                'skipped_rows': skipped_rows,
                'unmatched_sample_ids': sorted(unmatched_sample_ids),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'])
    def request_upload(self, request):
        """
        Step 1: Frontend ขอ presigned URL ก่อน upload
        Body: { "filename": "sample.csv", "content_type": "text/csv" }
        Returns: { "upload_url": "...", "key": "mycotoxin-sample/{user}/{filename}" }
        """
        filename = request.data.get('filename', '').strip()
        content_type = request.data.get('content_type', 'application/octet-stream')
        if not filename:
            return Response({'detail': 'filename is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = generate_upload_url(
                username=request.user.username,
                filename=filename,
                content_type=content_type,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)

    @action(detail=False, methods=['post'])
    def confirm_upload(self, request):
        """
        Step 2: Frontend เรียกหลัง PUT ไฟล์ขึ้น S3 สำเร็จ — enqueue Celery task
        Body: { "key": "mycotoxin-sample/{user}/{filename}" }
        Returns: { "task_id": "...", "status": "queued" }
        """
        key = request.data.get('key', '').strip()
        if not key:
            return Response({'detail': 'key is required'}, status=status.HTTP_400_BAD_REQUEST)

        task = process_sample_file.delay(key=key, uploaded_by_username=request.user.username)
        logger.info('sample.upload.confirmed', extra={'key': key, 'task_id': task.id, 'user': request.user.username})
        return Response({'task_id': task.id, 'status': 'queued'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], url_path='task_status/(?P<task_id>[^/.]+)')
    def task_status(self, request, task_id=None):
        """
        Poll Celery task status after confirm_upload
        GET /api/samples/task_status/{task_id}/
        Returns: { "status": "pending|started|success|failure", "result": {...} }
        """
        result = AsyncResult(task_id)
        response = {'task_id': task_id, 'status': result.status}
        if result.ready():
            if result.successful():
                response['result'] = result.get()
            else:
                response['error'] = str(result.result)
        return Response(response)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete samples - admin only"""
        if not (request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'):
            return Response(
                {'detail': 'You do not have permission to delete samples. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        sample_ids = request.data.get('sample_ids', [])
        if not isinstance(sample_ids, list) or not sample_ids:
            return Response(
                {'detail': 'sample_ids must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(sample_ids) > 500:
            return Response(
                {'detail': 'Cannot delete more than 500 samples at once.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        samples_qs = Sample.objects.filter(sample_id__in=sample_ids)
        found_ids = list(samples_qs.values_list('sample_id', flat=True))
        not_found = [sid for sid in sample_ids if sid not in found_ids]
        count = samples_qs.count()
        logger.warning(
            'sample.bulk_deleted',
            extra={
                'sample_ids': found_ids,
                'count': count,
                'deleted_by': request.user.username,
                'not_found': not_found,
            },
        )
        samples_qs.delete()
        return Response({'deleted': count, 'not_found': not_found}, status=status.HTTP_200_OK)

