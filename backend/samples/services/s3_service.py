import os
import uuid
import boto3
from botocore.config import Config
from django.conf import settings

_ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls'}


def get_s3_client():
    region = settings.AWS_S3_REGION_NAME
    kwargs = {
        'region_name': region,
        # Browser uploads must not be redirected from s3.amazonaws.com to the
        # regional bucket endpoint: redirects break the CORS preflight.
        'endpoint_url': f'https://s3.{region}.amazonaws.com',
        'config': Config(signature_version='s3v4', s3={'addressing_style': 'virtual'}),
    }
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs['aws_access_key_id'] = settings.AWS_ACCESS_KEY_ID
        kwargs['aws_secret_access_key'] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client('s3', **kwargs)


def generate_upload_url(username: str, filename: str, content_type: str) -> dict:
    """
    Frontend เรียกก่อน upload — ได้ URL แล้ว PUT ตรงไป S3
    ไฟล์ไม่ผ่าน Django/Railway เลย
    Path: mycotoxin-sample/{username}/{filename}
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValueError(f"ไฟล์ประเภท '{ext}' ไม่รองรับ ใช้: {', '.join(_ALLOWED_EXTENSIONS)}")

    s3 = get_s3_client()
    safe_filename = os.path.basename(filename)
    key = f"mycotoxin-sample/{username}/{safe_filename}"

    url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
            'Key': key,
            'ContentType': content_type,
        },
        ExpiresIn=300,  # 5 นาที
    )
    return {'upload_url': url, 'key': key}


def generate_dashboard_import_upload_url(username: str, filename: str, content_type: str) -> dict:
    """Generate a single-use destination for a dashboard CSV import."""
    ext = os.path.splitext(filename)[1].lower()
    if ext != '.csv':
        raise ValueError("Dashboard imports must be CSV files.")

    safe_filename = os.path.basename(filename)
    key = f"dashboard-imports/{username}/{uuid.uuid4().hex}-{safe_filename}"
    s3 = get_s3_client()
    url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
            'Key': key,
            'ContentType': content_type,
        },
        ExpiresIn=300,
    )
    return {'upload_url': url, 'key': key}


def generate_download_url(key: str, expires: int = 3600) -> str:
    """Signed URL สำหรับ download — expire ใน 1 ชั่วโมง"""
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
            'Key': key,
        },
        ExpiresIn=expires,
    )
