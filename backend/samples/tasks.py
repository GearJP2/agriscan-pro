import csv
import io
import logging

import boto3
import openpyxl
from celery import shared_task
from django.conf import settings

from .models import Sample, ProcessLog

logger = logging.getLogger('agriscan.samples')


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_sample_file(self, key: str, uploaded_by_username: str):
    """
    Download CSV/Excel from S3 and bulk-create samples.
    เรียกหลัง Frontend PUT ไฟล์ขึ้น S3 สำเร็จแล้ว
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(username=uploaded_by_username)
    except User.DoesNotExist:
        logger.error('task.process_sample_file.user_not_found', extra={'username': uploaded_by_username})
        return {'status': 'error', 'detail': 'User not found'}

    # Download file from S3
    try:
        s3 = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        file_bytes = obj['Body'].read()
    except Exception as exc:
        logger.error('task.process_sample_file.s3_error', extra={'key': key, 'error': str(exc)})
        raise self.retry(exc=exc)

    # Parse rows
    if key.endswith('.csv'):
        rows = _parse_csv(file_bytes)
    else:
        rows = _parse_excel(file_bytes)

    created = 0
    errors = []

    # Fetch all existing sample_ids in one query to avoid N+1 in loop
    incoming_ids = [str(row.get('sample_id', '')).strip() for row in rows if row.get('sample_id')]
    existing_ids = set(
        Sample.objects.filter(sample_id__in=incoming_ids).values_list('sample_id', flat=True)
    )

    for i, row in enumerate(rows):
        sample_id = str(row.get('sample_id', '')).strip()
        if not sample_id:
            errors.append({'row': i + 2, 'detail': 'sample_id ว่างเปล่า'})
            continue
        if sample_id in existing_ids:
            errors.append({'row': i + 2, 'detail': f"sample_id '{sample_id}' มีอยู่แล้ว"})
            continue

        try:
            sample = Sample.objects.create(
                sample_id=sample_id,
                region=str(row.get('region', '')).strip(),
                province=str(row.get('province', '')).strip(),
                district=str(row.get('district', '')).strip(),
                vegetation_variety=str(row.get('vegetation_variety', '')).strip(),
                status=str(row.get('status', 'pending')).strip() or 'pending',
                collection_date=row.get('collection_date') or None,
                purpose=str(row.get('purpose', 'routine')).strip() or 'routine',
                sample_type=str(row.get('sample_type', 'field')).strip() or 'field',
                processing_type=str(row.get('processing_type', 'raw')).strip() or 'raw',
                collected_by=str(row.get('collected_by', uploaded_by_username)).strip() or uploaded_by_username,
                updated_by=user,
            )
            ProcessLog.objects.create(
                sample=sample,
                state='registered',
                notes=f'Imported from file: {key}',
                conducted_by=uploaded_by_username,
            )
            created += 1
        except Exception as e:
            errors.append({'row': i + 2, 'detail': str(e)})

    logger.info(
        'task.process_sample_file.done',
        extra={'key': key, 'created': created, 'error_count': len(errors), 'user': uploaded_by_username},
    )
    return {'status': 'ok', 'created': created, 'errors': errors}


def _parse_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode('utf-8-sig')  # รองรับ BOM
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def _parse_excel(file_bytes: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else '' for h in rows[0]]
    return [
        dict(zip(headers, row))
        for row in rows[1:]
        if any(cell is not None for cell in row)
    ]
