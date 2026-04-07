import os
import boto3
from django.conf import settings

_ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls'}


def get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )


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
