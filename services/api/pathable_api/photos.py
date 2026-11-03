"""Report photos: re-encoded on the server and stored privately.

The browser already re-encodes photos through a canvas, which drops EXIF.
The server does it again rather than trusting the client: it decodes the
image, applies the EXIF orientation, and writes a fresh JPEG with no
metadata at all. Photos are stored in a private bucket and never served.
Face and licence-plate blurring is required before any photo could be shown
publicly (docs/decisions/0003); until then nothing is shown.
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_EDGE_PX = 1600


class InvalidPhoto(Exception):
    pass


def clean_jpeg(data: bytes) -> bytes:
    """Decode, orient, downscale and re-encode with no metadata."""
    if len(data) > MAX_BYTES:
        raise InvalidPhoto("too large")
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX))
            out = io.BytesIO()
            # A new image object carries no EXIF/XMP/ICC unless asked; save it bare.
            Image.frombytes("RGB", img.size, img.tobytes()).save(out, "JPEG", quality=85, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidPhoto("not an image") from exc


class LocalStorage:
    """Directory storage for development and tests."""

    def __init__(self, root: str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, data: bytes) -> str:
        photo_id = uuid.uuid4().hex
        (self.root / f"{photo_id}.jpg").write_bytes(data)
        return photo_id


class S3Storage:
    """Any S3-compatible store (SeaweedFS locally). The bucket is private."""

    def __init__(self, endpoint: str | None, bucket: str, access_key: str | None, secret_key: str | None):
        import boto3

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key or "any",
            aws_secret_access_key=secret_key or "any",
            region_name="us-east-1",
        )
        # Several workers start at once; whichever creates the bucket first wins,
        # and "already exists" is success for everyone else.
        from botocore.exceptions import ClientError

        try:
            self.client.create_bucket(Bucket=bucket)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise

    def put(self, data: bytes) -> str:
        photo_id = uuid.uuid4().hex
        self.client.put_object(Bucket=self.bucket, Key=f"reports/{photo_id}.jpg", Body=data, ContentType="image/jpeg")
        return photo_id
