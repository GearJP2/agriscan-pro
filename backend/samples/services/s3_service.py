import boto3
from django.conf import settings


def get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )


def generate_upload_url(filename: str, content_type: str) -> dict:
    """
    Frontend เรียกก่อน upload — ได้ URL แล้ว PUT ตรงไป S3
    ไฟล์ไม่ผ่าน Django/Railway เลย
    """
    s3 = get_s3_client()
    key = f"uploads/raw/{filename}"

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
