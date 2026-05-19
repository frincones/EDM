"""
Configura los GitHub Actions Secrets necesarios para el workflow deploy-lambda.yml.

Usa la API de GitHub con libsodium para encriptar los valores.

Secrets configurados:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations
import base64
import json
import os
import sys
import urllib.request
import urllib.error

try:
    from nacl import encoding, public
except ImportError:
    print("pynacl no instalado. Instalando...", file=sys.stderr)
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pynacl"], check=True)
    from nacl import encoding, public


OWNER = "frincones"
REPO = "EDM"

TOKEN = os.environ["GITHUB_TOKEN"]
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "edm-demo",
}

SECRETS_TO_SET = {
    "AWS_ACCESS_KEY_ID":         os.environ["AWS_ACCESS_KEY_ID"],
    "AWS_SECRET_ACCESS_KEY":     os.environ["AWS_SECRET_ACCESS_KEY"],
    "SUPABASE_URL":              os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
}


def _req(method: str, url: str, body: bytes | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def get_public_key() -> dict:
    status, body = _req("GET", f"https://api.github.com/repos/{OWNER}/{REPO}/actions/secrets/public-key")
    if status >= 300:
        raise SystemExit(f"Error fetching public key: HTTP {status} {body!r}")
    return json.loads(body)


def encrypt(public_key_b64: str, secret_value: str) -> str:
    pub_key = public.PublicKey(public_key_b64.encode(), encoding.Base64Encoder())
    sealed_box = public.SealedBox(pub_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def set_secret(name: str, value: str, pk: dict):
    encrypted = encrypt(pk["key"], value)
    body = json.dumps({"encrypted_value": encrypted, "key_id": pk["key_id"]}).encode()
    status, resp = _req(
        "PUT",
        f"https://api.github.com/repos/{OWNER}/{REPO}/actions/secrets/{name}",
        body,
    )
    return status, resp


def main():
    print(f"== Setting secrets in {OWNER}/{REPO} ==")
    pk = get_public_key()
    print(f"   public key ID: {pk['key_id']}")

    for name, value in SECRETS_TO_SET.items():
        if not value:
            print(f"   ⚠️  {name}: valor vacio, salteando")
            continue
        status, resp = set_secret(name, value, pk)
        if status in (201, 204):
            action = "creado" if status == 201 else "actualizado"
            print(f"   ✅ {name}: {action}")
        else:
            print(f"   ❌ {name}: HTTP {status} -- {resp[:200]}")

    # List secrets to verify
    print("\n== Secrets registrados en el repo ==")
    status, body = _req("GET", f"https://api.github.com/repos/{OWNER}/{REPO}/actions/secrets")
    if status < 300:
        data = json.loads(body)
        for s in data.get("secrets", []):
            print(f"   - {s['name']} (updated_at: {s.get('updated_at','?')})")


if __name__ == "__main__":
    main()
