"""Generate a bcrypt Admin hash without exposing the plaintext in shell history."""

from getpass import getpass
import sys

import bcrypt


password = getpass("Parola inițială Admin: ")
confirmation = getpass("Confirmă parola: ")
if password != confirmation:
    raise SystemExit("Parolele nu coincid.")
if len(password) < 14:
    raise SystemExit("Parola trebuie să aibă cel puțin 14 caractere.")

encoded = password.encode("utf-8")
if len(encoded) > 72:
    raise SystemExit("Parola depășește limita bcrypt de 72 bytes UTF-8.")

print(bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("utf-8"))
