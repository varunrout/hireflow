"""Tests for core security functions: password hashing and JWT tokens."""
import time

import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_different_from_plaintext(self) -> None:
        plain = "SecurePass123"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_verify_correct_password(self) -> None:
        plain = "SecurePass123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_incorrect_password(self) -> None:
        hashed = hash_password("SecurePass123")
        assert verify_password("WrongPass123", hashed) is False

    def test_same_password_produces_different_hashes(self) -> None:
        plain = "SecurePass123"
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)
        assert hash1 != hash2


class TestJWTTokens:
    def test_access_token_contains_subject(self) -> None:
        token = create_access_token("user-123")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_refresh_token_type(self) -> None:
        token = create_refresh_token("user-456")
        payload = decode_token(token)
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"

    def test_decode_invalid_token_raises(self) -> None:
        with pytest.raises(ValueError):
            decode_token("not.a.valid.token")

    def test_access_token_with_extra_data(self) -> None:
        token = create_access_token("user-789", extra_data={"role": "admin"})
        payload = decode_token(token)
        assert payload["role"] == "admin"
