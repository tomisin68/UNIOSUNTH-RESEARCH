"""Read assessment records out of Cloud Firestore.

The study runs without authentication and the security rules allow anonymous
reads, so the default path needs no credentials at all — just the REST API and
the project id. If a service account is ever configured (via the
GOOGLE_APPLICATION_CREDENTIALS environment variable), it is used automatically
so this keeps working should the rules be tightened later.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

from config import CACHE_PATH, FIREBASE_PROJECT_ID, FIRESTORE_COLLECTION

_BASE = "https://firestore.googleapis.com/v1"
_PAGE_SIZE = 300
_TIMEOUT = 60


# ── Firestore REST value decoding ─────────────────────────────────────────

def _decode_value(value: dict[str, Any]) -> Any:
    """Firestore wraps every field in a type tag; unwrap it to a plain Python value."""
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    if "mapValue" in value:
        return _decode_fields(value["mapValue"].get("fields", {}))
    if "arrayValue" in value:
        return [_decode_value(v) for v in value["arrayValue"].get("values", [])]
    if "bytesValue" in value:
        return value["bytesValue"]
    if "referenceValue" in value:
        return value["referenceValue"]
    if "geoPointValue" in value:
        return value["geoPointValue"]
    raise ValueError(f"Unrecognised Firestore value: {value!r}")


def _decode_fields(fields: dict[str, Any]) -> dict[str, Any]:
    return {k: _decode_value(v) for k, v in fields.items()}


def _decode_document(doc: dict[str, Any]) -> dict[str, Any]:
    record = _decode_fields(doc.get("fields", {}))
    record.setdefault("id", doc["name"].rsplit("/", 1)[-1])
    return record


# ── Optional service-account auth ─────────────────────────────────────────

def _access_token() -> str | None:
    """Return a bearer token if a service account is configured, else None."""
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path or not Path(cred_path).exists():
        return None
    try:
        import google.auth
        import google.auth.transport.requests

        creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/datastore"]
        )
        creds.refresh(google.auth.transport.requests.Request())
        return creds.token
    except ImportError:
        print("  ! GOOGLE_APPLICATION_CREDENTIALS is set but google-auth is not "
              "installed; falling back to anonymous access.")
        return None


# ── Fetch ─────────────────────────────────────────────────────────────────

def fetch_records(project_id: str = FIREBASE_PROJECT_ID,
                  collection: str = FIRESTORE_COLLECTION,
                  verbose: bool = True) -> list[dict[str, Any]]:
    """Download every document in the collection, following pagination."""
    url = f"{_BASE}/projects/{project_id}/databases/(default)/documents/{collection}"
    headers = {}
    token = _access_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
        if verbose:
            print("  using service-account credentials")

    records: list[dict[str, Any]] = []
    page_token: str | None = None
    page = 0

    while True:
        params: dict[str, Any] = {"pageSize": _PAGE_SIZE}
        if page_token:
            params["pageToken"] = page_token

        response = requests.get(url, params=params, headers=headers, timeout=_TIMEOUT)
        if response.status_code == 403:
            raise PermissionError(
                "Firestore denied the read (403). The rules currently allow "
                "anonymous reads, so this usually means App Check enforcement "
                "was switched on. Set GOOGLE_APPLICATION_CREDENTIALS to a "
                "service-account key to read as an admin."
            )
        response.raise_for_status()
        payload = response.json()

        documents = payload.get("documents", [])
        records.extend(_decode_document(d) for d in documents)
        page += 1

        page_token = payload.get("nextPageToken")
        if not page_token:
            break

    if verbose:
        print(f"  fetched {len(records)} record(s) from "
              f"{project_id}/{collection} in {page} page(s)")
    return records


# ── Local cache ───────────────────────────────────────────────────────────

def save_cache(records: list[dict[str, Any]], path: Path = CACHE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def load_cache(path: Path = CACHE_PATH) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(
            f"No cached records at {path}. Run without --cached to download them."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def load_records(cached: bool = False, sample: Path | None = None,
                 verbose: bool = True) -> list[dict[str, Any]]:
    """Resolve the record set from whichever source was requested."""
    if sample is not None:
        if verbose:
            print(f"  reading synthetic sample from {sample}")
        return json.loads(Path(sample).read_text(encoding="utf-8"))
    if cached:
        if verbose:
            print(f"  reading cached records from {CACHE_PATH}")
        return load_cache()
    records = fetch_records(verbose=verbose)
    save_cache(records)
    return records


if __name__ == "__main__":
    recs = fetch_records()
    print(json.dumps(recs[:1], indent=2)[:1500] if recs else "(collection is empty)")
