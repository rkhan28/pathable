# 0003. Local S3-compatible storage: SeaweedFS instead of MinIO

- Status: accepted
- Date: 2026-11-03

## Context

The spec names MinIO for local S3-compatible photo storage. On 2026-11-03,
neither `minio/minio` on Docker Hub nor `quay.io/minio/minio` could be pulled.
MinIO stopped publishing free community images in 2025.

## Options considered

- **Build MinIO from source.** Possible under AGPL-3.0, but it adds a build step
  and licence obligations for a development convenience.
- **SeaweedFS** (`chrislusf/seaweedfs`, Apache-2.0). A single binary with an S3
  gateway, and multi-arch images.
- **Garage** (`dxflrs/garage`, AGPL-3.0). It is S3-compatible but needs
  cluster layout setup.

## Decision

Use SeaweedFS in `infra/compose.yaml`. The API speaks plain S3, so production
can use any S3 provider.

## Consequences

- The photo pipeline was not built when this was decided. Since then:
  - upload (`POST /v1/photos`) and server-side re-encoding without metadata
    are built and tested; a report's `photoId` must name a stored photo;
  - the local bucket has an S3 identity, so it refuses anonymous reads;
  - face and licence-plate blurring is still not built, so no photo is ever
    served publicly.

  Client-side EXIF removal also runs first (`src/lib/photo.ts`).
- Blurring needs a licensed detector. It will be evaluated under the same rules
  as `ML_PLAN.md`.
