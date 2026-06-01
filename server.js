import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const WORD_LENGTH = 5;
const BOARD_COUNT = 16;

const WORDS_FILE = path.join("words5.txt");
const USED_WORDS_FILE = path.join(__dirname, "used_words.txt");
const DAILY_FILE = path.join(__dirname, "daily_words.json");

app.use(express.json());

ensureFileExists(USED_WORDS_FILE, "");
ensureFileExists(DAILY_FILE, "{}");

function ensureFileExists(filePath, defaultContent) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, defaultContent, "utf8");
    }
}

function normalizeWord(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("pl-PL")
        .normalize("NFC");
}

function getDateKey() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function readAllWords() {
    const text = fs.readFileSync(WORDS_FILE, "utf8");

    const words = text
        .split(/\r?\n/)
        .map(normalizeWord)
        .filter(word => [...word].length === WORD_LENGTH)
        .filter(word => /^[a-ząćęłńóśźż]+$/iu.test(word));

    return [...new Set(words)];
}

function readUsedWords() {
    const text = fs.readFileSync(USED_WORDS_FILE, "utf8");

    const words = text
        .split(/\r?\n/)
        .map(normalizeWord)
        .filter(Boolean);

    return new Set(words);
}

function saveUsedWords(usedWordsSet) {
    const sorted = [...usedWordsSet].sort((a, b) => a.localeCompare(b, "pl"));
    fs.writeFileSync(USED_WORDS_FILE, sorted.join("\n") + "\n", "utf8");
}

function readDailyFile() {
    try {
        const raw = fs.readFileSync(DAILY_FILE, "utf8");
        return JSON.parse(raw || "{}");
    } catch {
        return {};
    }
}

function saveDailyFile(data) {
    fs.writeFileSync(DAILY_FILE, JSON.stringify(data, null, 2), "utf8");
}

function hashStringToNumber(text) {
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return hash >>> 0;
}

function seededRandom(seed) {
    let value = seed >>> 0;

    return function () {
        value += 0x6D2B79F5;

        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickDailyWords(allWords, usedWords, dateKey) {
    const availableWords = allWords.filter(word => !usedWords.has(word));

    if (availableWords.length < BOARD_COUNT) {
        throw new Error(
            `Za mało nieużytych słów. Potrzeba ${BOARD_COUNT}, dostępne: ${availableWords.length}.`
        );
    }

    const seed = hashStringToNumber(dateKey);
    const random = seededRandom(seed);

    const shuffled = [...availableWords];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, BOARD_COUNT);
}

function getTodayWords() {
    const today = getDateKey();

    const dailyData = readDailyFile();

    if (dailyData[today] && Array.isArray(dailyData[today]) && dailyData[today].length === BOARD_COUNT) {
        return dailyData[today];
    }

    const allWords = readAllWords();
    const usedWords = readUsedWords();

    const todayWords = pickDailyWords(allWords, usedWords, today);

    for (const word of todayWords) {
        usedWords.add(word);
    }

    saveUsedWords(usedWords);

    dailyData[today] = todayWords;
    saveDailyFile(dailyData);

    return todayWords;
}

app.get("/api/daily", (req, res) => {
    try {
        const words = getTodayWords();

        res.json({
            date: getDateKey(),
            words,
            wordLength: WORD_LENGTH,
            boardCount: BOARD_COUNT
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

app.post("/api/validate", (req, res) => {
    const guess = normalizeWord(req.body.guess);
    const allWords = readAllWords();

    res.json({
        valid: allWords.includes(guess)
    });
});

app.get("/api/used", (req, res) => {
    const usedWords = [...readUsedWords()].sort((a, b) => a.localeCompare(b, "pl"));

    res.json({
        count: usedWords.length,
        words: usedWords
    });
});

app.post("/api/reset-used", (req, res) => {
    fs.writeFileSync(USED_WORDS_FILE, "", "utf8");
    fs.writeFileSync(DAILY_FILE, "{}", "utf8");

    res.json({
        ok: true
    });
});

app.listen(PORT, () => {
    console.log(`Wordle działa: http://localhost:${PORT}`);
});