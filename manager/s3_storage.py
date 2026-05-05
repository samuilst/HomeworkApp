import uuid

from decouple import config
from werkzeug.utils import secure_filename


class S3Storage:
    @staticmethod
    def _client():
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 uploads. Install it with: pip install boto3") from exc

        region = config("AWS_REGION_NAME", default="eu-central-1")
        client_kwargs = {"region_name": region}
        access_key = config("AWS_ACCESS_KEY_ID", default=None)
        secret_key = config("AWS_SECRET_ACCESS_KEY", default=None)
        if access_key and secret_key:
            client_kwargs["aws_access_key_id"] = access_key
            client_kwargs["aws_secret_access_key"] = secret_key

        return boto3.client("s3", **client_kwargs)

    @staticmethod
    def bucket_name():
        bucket = config("AWS_S3_BUCKET_NAME", default=None)
        if not bucket:
            raise RuntimeError("AWS_S3_BUCKET_NAME is not configured")
        return bucket

    @staticmethod
    def split_s3_path(file_path):
        if not file_path or not file_path.startswith("s3://"):
            return None, None

        without_scheme = file_path[5:]
        bucket, _, key = without_scheme.partition("/")
        if not bucket or not key:
            return None, None

        return bucket, key

    @staticmethod
    def _storage_error_message(error):
        try:
            from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError
        except ImportError:
            return str(error)

        if isinstance(error, NoCredentialsError):
            return "AWS credentials were not found. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."

        if isinstance(error, PartialCredentialsError):
            return "AWS credentials are incomplete. Check both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."

        if isinstance(error, ClientError):
            response = error.response or {}
            details = response.get("Error", {})
            code = details.get("Code", "AWS error")
            message = details.get("Message", str(error))
            return f"S3 upload failed: {code} - {message}"

        return f"S3 upload failed: {error}"

    @staticmethod
    def upload(file_storage, prefix):
        filename = secure_filename(file_storage.filename or "")
        if not filename:
            raise ValueError("Uploaded file must have a filename")

        bucket = S3Storage.bucket_name()
        key = f"{prefix.rstrip('/')}/{uuid.uuid4()}-{filename}"

        try:
            file_storage.stream.seek(0)
            S3Storage._client().upload_fileobj(
                file_storage.stream,
                bucket,
                key,
                ExtraArgs={"ContentType": file_storage.mimetype or "application/octet-stream"},
            )
        except Exception as exc:
            raise RuntimeError(S3Storage._storage_error_message(exc)) from exc

        return f"s3://{bucket}/{key}"

    @staticmethod
    def delete(file_path):
        bucket, key = S3Storage.split_s3_path(file_path)
        if not bucket or not key:
            return

        try:
            S3Storage._client().delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise RuntimeError(S3Storage._storage_error_message(exc)) from exc

    @staticmethod
    def presigned_url(file_path, expires_in=3600):
        bucket, key = S3Storage.split_s3_path(file_path)
        if not bucket or not key:
            return None

        try:
            return S3Storage._client().generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except Exception as exc:
            raise RuntimeError(S3Storage._storage_error_message(exc)) from exc

    @staticmethod
    def get_object(file_path):
        bucket, key = S3Storage.split_s3_path(file_path)
        if not bucket or not key:
            raise ValueError("Invalid S3 file path")

        try:
            response = S3Storage._client().get_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise RuntimeError(S3Storage._storage_error_message(exc)) from exc

        return response, key
