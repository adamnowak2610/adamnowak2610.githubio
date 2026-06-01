from pathlib import Path
import re
import unicodedata

INPUT_FILE = Path("odm.txt")
OUTPUT_FILE = Path("allowed_5_letters.txt")

POLISH_WORD_RE = re.compile(r"^[a-ząćęłńóśźż]+$", re.IGNORECASE)

def normalize_word(word: str) -> str:
    word = word.strip().lower()
    word = unicodedata.normalize("NFC", word)
    return word

words = set()

with INPUT_FILE.open("r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        # SJP często ma w jednej linii formę podstawową i odmiany.
        # Dlatego bierzemy wszystkie "tokeny", a nie tylko całą linię.
        tokens = re.split(r"[\s,;:|]+", line)

        for token in tokens:
            word = normalize_word(token)

            if len(word) != 5:
                continue

            if not POLISH_WORD_RE.match(word):
                continue

            words.add(word)

sorted_words = sorted(words, key=lambda x: x.casefold())

with OUTPUT_FILE.open("w", encoding="utf-8", newline="\n") as f:
    for word in sorted_words:
        f.write(word + "\n")

print(f"Zapisano {len(sorted_words)} słów do {OUTPUT_FILE}")