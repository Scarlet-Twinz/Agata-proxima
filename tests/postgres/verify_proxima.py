#!/usr/bin/env python3
import hashlib
import hmac
import socket
import struct
import sys

HOST = "127.0.0.1"
PORT = 6432
SECRET = b"01234567890123456789012345678901"
EXPIRY = 4102444800


def token_for(tenant):
    payload = f"v1.{tenant}.{EXPIRY}".encode()
    signature = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()
    return f"v1.{tenant}.{EXPIRY}.{signature}"


def frame(tag, payload=b""):
    return tag + struct.pack("!I", len(payload) + 4) + payload


def startup(tenant, token=None):
    token = token or token_for(tenant)
    params = (
        b"user\0client\0"
        b"database\0proxima_dev\0"
        + b"proxima_tenant_token\0"
        + token.encode()
        + b"\0"
    )
    body = struct.pack("!I", 196608) + params
    return struct.pack("!I", len(body) + 4) + body


def recv_exact(sock, size):
    data = bytearray()
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise EOFError("connection closed")
        data.extend(chunk)
    return bytes(data)


def recv_message(sock):
    tag = recv_exact(sock, 1)
    length = struct.unpack("!I", recv_exact(sock, 4))[0]
    if length < 4 or length > 16 * 1024 * 1024:
        raise AssertionError(f"invalid backend frame length: {length}")
    return tag, recv_exact(sock, length - 4)


def connect(tenant):
    sock = socket.create_connection((HOST, PORT), timeout=5)
    sock.sendall(startup(tenant))

    saw_auth_ok = False
    while True:
        tag, payload = recv_message(sock)
        if tag == b"R":
            code = struct.unpack("!I", payload[:4])[0]
            if code != 0:
                raise AssertionError(f"unexpected client-facing auth code: {code}")
            saw_auth_ok = True
        elif tag == b"E":
            raise AssertionError("startup rejected: " + error_text(payload))
        elif tag == b"Z":
            if not saw_auth_ok:
                raise AssertionError("startup reached ReadyForQuery without AuthenticationOk")
            return sock


def error_text(payload):
    fields = []
    for field in payload.split(b"\0"):
        if len(field) > 1:
            fields.append(field[1:].decode("utf-8", "replace"))
    return " ".join(fields)


def query(sock, sql):
    sock.sendall(frame(b"Q", sql.encode() + b"\0"))
    rows = []
    error = None
    while True:
        tag, payload = recv_message(sock)
        if tag == b"D":
            count = struct.unpack("!H", payload[:2])[0]
            offset = 2
            row = []
            for _ in range(count):
                size = struct.unpack("!i", payload[offset:offset + 4])[0]
                offset += 4
                if size == -1:
                    row.append(None)
                else:
                    row.append(payload[offset:offset + size].decode("utf-8"))
                    offset += size
            rows.append(row)
        elif tag == b"E":
            error = error_text(payload)
        elif tag == b"Z":
            return rows, error


def assert_equal(expected, actual, label):
    if expected != actual:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")
    print(f"PASS: {label}")


def verify_tenant(tenant, expected_secret, forbidden_secret):
    sock = connect(tenant)
    try:
        rows, error = query(sock, "SELECT current_user, session_user")
        if error:
            raise AssertionError(error)
        assert_equal(
            [[f"proxima_{tenant}", f"proxima_{tenant}"]],
            rows,
            f"{tenant} session is bound to the expected PostgreSQL role",
        )

        rows, error = query(
            sock,
            "SELECT string_agg(secret, ',' ORDER BY secret) "
            "FROM proxima_test.records",
        )
        if error:
            raise AssertionError(error)
        assert_equal([[expected_secret]], rows, f"{tenant} cannot read the other tenant")

        rows, error = query(
            sock,
            "SELECT secret FROM proxima_test.records "
            f"WHERE secret = '{forbidden_secret}'",
        )
        if error:
            raise AssertionError(error)
        assert_equal([], rows, f"{tenant} cannot target the other tenant")

        rows, error = query(
            sock,
            "PREPARE tenant_lookup(text) AS "
            "SELECT string_agg(secret, ',' ORDER BY secret) "
            "FROM proxima_test.records WHERE tenant_id = $1; "
            f"EXECUTE tenant_lookup('{forbidden_secret[0]}-secret')",
        )
        if error:
            raise AssertionError(error)
        assert_equal([[None]], rows, f"{tenant} prepared statements remain isolated")

        rows, error = query(
            sock,
            "BEGIN; "
            f"INSERT INTO proxima_test.records (tenant_id, secret) "
            f"VALUES ('{tenant}', 'temporary-{tenant}'); "
            "ROLLBACK; "
            f"SELECT count(*) FROM proxima_test.records "
            f"WHERE secret = 'temporary-{tenant}'",
        )
        if error:
            raise AssertionError(error)
        assert_equal([["0"]], rows, f"{tenant} rollback leaves no tenant state behind")

        _, error = query(
            sock,
            "INSERT INTO proxima_test.records (tenant_id, secret) "
            f"VALUES ('{forbidden_secret[0]}', 'forbidden-from-{tenant}')",
        )
        if not error or "row-level security" not in error.lower():
            raise AssertionError(
                f"{tenant} cross-tenant INSERT was not rejected by RLS: {error!r}"
            )
        print(f"PASS: {tenant} cross-tenant INSERT rejected")

        _, error = query(sock, "SET ROLE proxima_tenant_b")
        if not error or "permission denied to set role" not in error.lower():
            raise AssertionError(
                f"{tenant} was able to switch database identity: {error!r}"
            )
        print(f"PASS: {tenant} cannot switch database identity")
    finally:
        sock.close()


def verify_bad_token():
    sock = socket.create_connection((HOST, PORT), timeout=5)
    bad = startup("tenant_a", "v1.tenant_b.4102444800.bad")
    sock.sendall(bad)
    try:
        while True:
            tag, _ = recv_message(sock)
            if tag == b"R":
                raise AssertionError("tampered tenant token unexpectedly authenticated")
    except (EOFError, ConnectionResetError):
        print("PASS: invalid tenant token is rejected before session establishment")
    finally:
        sock.close()


def main():
    verify_tenant("tenant_a", "A-secret", "B-secret")
    verify_tenant("tenant_b", "B-secret", "A-secret")
    verify_bad_token()
    print("Proxima PostgreSQL integration verification: PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
