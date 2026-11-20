# MongoDB persistence migration

Application data is stored in MongoDB collections defined in `lib/models.ts`.
Set `MONGODB_URI` to a reachable MongoDB deployment before running the app.
The connection must have permission to create collections and indexes. MongoDB
Atlas or another replica set is recommended for high availability; the current
CRUD operations use atomic single-document updates and do not require
multi-document transactions.

## Import existing JSON files

Keep the existing `data/*.json` files as a backup. The importer does not delete
or rewrite them and does not overwrite documents already present in MongoDB.
It hashes legacy OTPs, reset tokens, and plaintext staff PINs before insertion;
chat image data URLs are moved into `data/uploads` and messages keep only the
file URL.

Run a validation-only pass first:

```powershell
npm run migrate:mongodb
```

After reviewing the row counts and fixing any reported invalid or duplicate
rows, apply the import:

```powershell
npm run migrate:mongodb -- --apply
```

The operation is safe to retry: existing MongoDB rows are left unchanged. Back
up both the JSON files and the `data/uploads` directory before the import.
Do not remove the JSON backup until counts and critical records have been
verified against MongoDB.

## Secrets and deployment

`OTP_HASH_SECRET` and `RESET_TOKEN_HASH_SECRET` should be independent random
secrets of at least 32 characters. If omitted, the corresponding token hashes
use `NEXTAUTH_SECRET`. Keep these keys stable: rotating them invalidates active
OTP and reset tokens. Never print their values or the MongoDB URI in logs.

`STAFF_RECOVERY_CODE` must be set to a private six-digit code to enable staff
PIN recovery. The recovery endpoint remains disabled when it is not configured.
It is a single code shared by every staff account, so treat it as an
organisation-wide secret: rotate it whenever it may have leaked and when someone
with access leaves. It is only useful together with a fresh OTP — the endpoint
verifies the email OTP before comparing the recovery code, and the OTP is
single-use — so a guessed code cannot be tested without also holding the
mailbox.

### OTP collection: run the per-purpose migration

`lib/dbOtp.ts` now keeps one live OTP per **email + purpose**, so a password
reset no longer destroys an in-flight registration code. On an existing
database the old `email_1` unique index must be dropped, or the second purpose
insert is rejected. Schema init creates the new `email_1_purpose_1` index but
never drops the old one, so run:

```powershell
npm run migrate:otp-purpose            # dry run: report what would change
npm run migrate:otp-purpose -- --apply  # drop the legacy index + backfill purpose
```

The script refuses to apply if two rows already share an (email, purpose) pair.

`MONGODB_URI` must resolve from the runtime environment. A configured URI is
not proof that the database is reachable; verify DNS/network access and TLS
from the application host before switching traffic. MongoDB initialization
creates the declared unique, TTL, and query indexes. Existing duplicate values
must be resolved before unique indexes can be built.

Chat and medical attachments are separate files rather than MongoDB documents.
The current upload implementation uses the local `data/uploads` directory;
multi-instance deployments must use shared durable object storage before
serving uploads across instances.
