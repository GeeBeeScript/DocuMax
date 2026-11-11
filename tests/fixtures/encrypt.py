"""Writes pdf/password-protected.pdf (user password required) from the digital invoice. Needs pypdf."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter

here = Path(__file__).parent
writer = PdfWriter(clone_from=PdfReader(here / "pdf" / "digital-invoice.pdf"))
writer.encrypt(user_password="s3cret", owner_password="owner-s3cret", algorithm="RC4-128")
with open(here / "pdf" / "password-protected.pdf", "wb") as f:
    writer.write(f)
print("password-protected.pdf written")
