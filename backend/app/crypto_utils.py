"""
CryptoJS-compatible AES encryption/decryption.
Original JS uses: CryptoJS.AES.encrypt(e, key, {iv, mode: ECB, padding: Pkcs7})
- Key: "SenZQ" (5 chars)
- IV: "9527" (4 chars, used in key derivation)
- Mode: ECB
- Padding: PKCS7
"""
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import os


def _evp_bytes_to_key(password: str, salt: bytes, key_len: int = 32, iv_len: int = 16):
    """
    Replicate OpenSSL's EVP_BytesToKey (used by CryptoJS for passphrase-based keys).
    Uses MD5 iteratively until enough key material is generated.
    """
    dtot = b""
    d = b""
    while len(dtot) < key_len + iv_len:
        d = hashlib.md5(d + password.encode() + salt).digest()
        dtot += d
    return dtot[:key_len], dtot[key_len : key_len + iv_len]


def encrypt(plaintext: str, password: str = "SenZQ") -> str:
    """
    Encrypt plaintext using AES-ECB-PKCS7, compatible with CryptoJS.
    Returns base64-encoded ciphertext with "Salted__" prefix.
    """
    salt = os.urandom(8)
    key, _ = _evp_bytes_to_key(password, salt, key_len=32)
    cipher = AES.new(key, AES.MODE_ECB)
    ciphertext = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
    result = b"Salted__" + salt + ciphertext
    return base64.b64encode(result).decode()


def decrypt(ciphertext_b64: str, password: str = "SenZQ") -> str:
    """
    Decrypt CryptoJS-compatible ciphertext (base64, with "Salted__" prefix).
    """
    raw = base64.b64decode(ciphertext_b64)
    if raw[:8] != b"Salted__":
        raise ValueError("Not a valid CryptoJS salted ciphertext")
    salt = raw[8:16]
    ciphertext = raw[16:]
    key, _ = _evp_bytes_to_key(password, salt, key_len=32)
    cipher = AES.new(key, AES.MODE_ECB)
    plaintext = unpad(cipher.decrypt(ciphertext), AES.block_size)
    return plaintext.decode("utf-8", errors="replace")