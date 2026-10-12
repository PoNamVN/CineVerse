require("dotenv").config();
const express = require("express");
const cors = require("cors");

const path = require("path");

const PORT = process.env.PORT || 5000;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_BASE = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";

if (!TMDB_TOKEN) {
  throw new Error("Thiếu TMDB_TOKEN trong file backend/.env");
}

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === "null" ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Phục vụ giao diện tĩnh từ thư mục gốc dự án
app.use(express.static(path.join(__dirname, "..")));

// ---------------------------------------------------------------------------
// 1. Cache trong bộ nhớ (Map) lưu kết quả 5 phút theo URL
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setToCache(key, data) {
  // Dọn dẹp các mục đã hết hạn nếu cache lưu nhiều hơn 200 mục
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// 2. Hàm dùng chung tmdbFetch(path, params)
// ---------------------------------------------------------------------------
async function tmdbFetch(path, params = {}) {
  // Tạo query string và loại bỏ các param undefined/null
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  }

  const queryString = searchParams.toString();
  const url = queryString ? `${TMDB_BASE}${path}?${queryString}` : `${TMDB_BASE}${path}`;

  // Kiểm tra cache trước khi gọi
  const cachedData = getFromCache(url);
  if (cachedData) {
    return cachedData;
  }

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    // Không in token ra log
    console.error(`[tmdbFetch] Lỗi mạng khi gọi ${path}:`, err.message || err);
    const networkError = new Error("Không gọi được TMDB");
    networkError.status = 502;
    throw networkError;
  }

  if (!response.ok) {
    let errorDetail = `TMDB trả về mã lỗi ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.status_message || errorDetail;
    } catch (_) {}

    console.error(`[tmdbFetch] Thất bại (${response.status}) tại ${path}:`, errorDetail);
    const apiError = new Error(response.status === 404 ? "Không tìm thấy phim" : "TMDB trả về lỗi");
    apiError.status = response.status;
    throw apiError;
  }

  const data = await response.json();
  setToCache(url, data);
  return data;
}

// ---------------------------------------------------------------------------
// 3. Hàm định dạng danh sách phim rút gọn cho /popular và /search
// ---------------------------------------------------------------------------
function formatMovieList(data) {
  return {
    page: data.page || 1,
    total_pages: data.total_pages || 1,
    results: (data.results || []).map((m) => ({
      id: m.id,
      title: m.title,
      release_date: m.release_date || null,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
      overview: m.overview || "",
      genre_ids: Array.isArray(m.genre_ids) ? m.genre_ids : [],
      vote_average: typeof m.vote_average === "number" ? Math.round(m.vote_average * 10) / 10 : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// 4. Các API Routes
// ---------------------------------------------------------------------------

// GET /api/health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// GET /api/genres
app.get("/api/genres", async (req, res) => {
  try {
    const data = await tmdbFetch("/genre/movie/list", { language: "vi-VN" });
    res.json(data);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Không gọi được TMDB" });
  }
});

// GET /api/movies/popular?page=1&genre=28
app.get("/api/movies/popular", async (req, res) => {
  const pageParam = req.query.page || "1";
  const genreParam = req.query.genre;
  const pageNum = Number(pageParam);

  if (!/^[1-9]\d*$/.test(String(pageParam)) || pageNum < 1 || pageNum > 500) {
    return res.status(400).json({ error: "Số trang (page) phải là số nguyên từ 1 đến 500" });
  }

  try {
    let data;
    if (genreParam && /^[1-9]\d*$/.test(String(genreParam))) {
      data = await tmdbFetch("/discover/movie", {
        language: "vi-VN",
        page: pageNum,
        with_genres: genreParam,
        sort_by: "popularity.desc",
      });
    } else {
      data = await tmdbFetch("/movie/popular", {
        language: "vi-VN",
        page: pageNum,
      });
    }
    res.json(formatMovieList(data));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Không gọi được TMDB" });
  }
});

// GET /api/movies/search?query=...&page=1
app.get("/api/movies/search", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const pageParam = req.query.page || "1";
  const pageNum = Number(pageParam);

  if (!query || query.length > 100) {
    return res.status(400).json({
      error: "Từ khóa tìm kiếm không được để trống và tối đa 100 ký tự",
    });
  }

  if (!/^[1-9]\d*$/.test(String(pageParam)) || pageNum < 1 || pageNum > 500) {
    return res.status(400).json({
      error: "Số trang (page) phải là số nguyên từ 1 đến 500",
    });
  }

  try {
    const data = await tmdbFetch("/search/movie", {
      query,
      page: pageNum,
      language: "vi-VN",
      include_adult: false,
    });
    res.json(formatMovieList(data));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Không gọi được TMDB" });
  }
});

// GET /api/movies/:id
app.get("/api/movies/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(String(id))) {
    return res.status(400).json({ error: "Mã phim (id) phải là số nguyên dương" });
  }

  try {
    // 1. Gọi lấy thông tin tiếng Việt kèm videos và external_ids
    let data = await tmdbFetch(`/movie/${id}`, {
      language: "vi-VN",
      append_to_response: "videos,external_ids",
    });

    let overview = (data.overview || "").trim();

    // 2. Nếu overview rỗng, gọi lại với language=en-US để lấy overview tiếng Anh
    if (!overview) {
      try {
        const enData = await tmdbFetch(`/movie/${id}`, {
          language: "en-US",
          append_to_response: "videos",
        });
        overview = (enData.overview || "").trim();

        // Nếu bản vi-VN không có video, thử lấy video từ bản en-US
        if ((!data.videos?.results || data.videos.results.length === 0) && enData.videos?.results) {
          data.videos = enData.videos;
        }
      } catch (enErr) {
        console.warn(`[movies/:id] Không lấy được overview tiếng Anh cho phim ${id}:`, enErr.message);
      }
    }

    // 3. Tìm YouTube trailer
    let videoList = data.videos?.results || [];
    let trailer = videoList.find((v) => v.site === "YouTube" && v.type === "Trailer");

    // Nếu chưa có trailer (vì vi-VN thường không có video), gọi lấy toàn bộ video quốc tế từ TMDB
    if (!trailer) {
      try {
        const fallbackVideos = await tmdbFetch(`/movie/${id}/videos`, {});
        const list = fallbackVideos.results || [];
        trailer =
          list.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
          list.find((v) => v.site === "YouTube" && v.type === "Teaser") ||
          list.find((v) => v.site === "YouTube" && v.key);
      } catch (vidErr) {
        console.warn(`[movies/:id] Không lấy được video toàn cầu cho phim ${id}:`, vidErr.message);
      }
    }

    // 4. Chỉ trả về đúng các trường được yêu cầu
    const movieDetail = {
      id: data.id,
      title: data.title,
      original_title: data.original_title,
      overview: overview || null,
      release_date: data.release_date || null,
      runtime: data.runtime ?? null,
      genres: Array.isArray(data.genres) ? data.genres.map((g) => ({ id: g.id, name: g.name })) : [],
      vote_average: typeof data.vote_average === "number" ? Math.round(data.vote_average * 10) / 10 : null,
      posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      backdropUrl: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
      imdb_id: data.external_ids?.imdb_id || data.imdb_id || null,
      trailerKey: trailer ? trailer.key : null,
    };

    res.json(movieDetail);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Không gọi được TMDB" });
  }
});

// ---------------------------------------------------------------------------
// 5. Khởi động server
// ---------------------------------------------------------------------------
app.listen(PORT, () => console.log(`Backend chạy tại http://localhost:${PORT}`));