require("dotenv").config();
const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 5000;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_BASE = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
if (!TMDB_TOKEN) throw new Error("Thiếu TMDB_TOKEN trong file backend/.env");

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN || "").split(",") }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/movies/popular", async (req, res) => {
    try {
        const r = await fetch(`${TMDB_BASE}/movie/popular?language=vi-VN`, {
            headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
        });
        if (!r.ok) return res.status(r.status).json({ error: "TMDB trả về lỗi" });
        res.json(await r.json());
    } catch (err) {
        console.error("Lỗi gọi TMDB:", err.cause || err);
        res.status(502).json({ error: "Không gọi được TMDB" });
    }
});

app.listen(PORT, () => console.log(`Backend chạy tại http://localhost:${PORT}`));