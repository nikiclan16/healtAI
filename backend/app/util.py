import re
import unicodedata

CARGO_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{2,31}$")


def slugify_code(label: str) -> str:
    """'Trabajo Social' -> 'trabajo_social' (código estable de un rol)."""
    ascii_text = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    if not slug or not slug[0].isalpha():
        slug = f"rol_{slug}"
    return slug[:32].rstrip("_")
