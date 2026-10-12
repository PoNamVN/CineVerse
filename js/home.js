/**
 * js/home.js
 * Logic hiển thị danh sách 12 phim nổi tiếng & tìm kiếm phim trên trang chủ (index.html)
 */

// 1. Danh sách 12 mã IMDb ID của các bộ phim kinh điển/nổi tiếng thế giới
const POPULAR_MOVIE_IDS = [
  "tt0111161", // The Shawshank Redemption (1994)
  "tt0468569", // The Dark Knight (2008)
  "tt1375666", // Inception (2010)
  "tt0816692", // Interstellar (2014)
  "tt6751668", // Parasite (2019)
  "tt0110912", // Pulp Fiction (1994)
  "tt0245429", // Spirited Away (2001)
  "tt0499549", // Avatar (2009)
  "tt4154796", // Avengers: Endgame (2019)
  "tt0120338", // Titanic (1997)
  "tt4633694", // Spider-Man: Into the Spider-Verse (2018)
  "tt15398776" // Oppenheimer (2023)
];

// Ảnh poster thay thế dự phòng dạng SVG (hoạt động offline, không lo bị lỗi mạng)
const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
      <rect width="300" height="450" fill="#1e293b"/>
      <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="20">🎬 Không có ảnh</text>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="14">No Poster Available</text>
    </svg>
  `);

// Biến lưu trữ dữ liệu để tối ưu hóa
let cachedPopularMovies = null; // Lưu 12 phim trang chủ để khi xóa tìm kiếm hiển thị lại ngay lập tức
let currentSearchRequestId = 0; // Đánh số lượt tìm kiếm để chống ghi đè kết quả cũ (race condition)

/**
 * 2. Hàm escapeHTML: Làm sạch văn bản để chống lỗi XSS và hiển thị an toàn trên HTML
 * @param {string} str - Chuỗi cần làm sạch
 * @returns {string} - Chuỗi an toàn
 */
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 3. Kỹ thuật Debounce: Hoãn việc thực thi hàm cho đến khi người dùng ngừng gõ một khoảng thời gian
 * @param {Function} func - Hàm cần hoãn
 * @param {number} delay - Thời gian chờ (mili giây), mặc định 500ms
 * @returns {Function}
 */
function debounce(func, delay = 500) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 4. Hàm tạo HTML cho từng thẻ phim
 * @param {Object} movie - Dữ liệu chi tiết phim
 * @returns {string} Chuỗi HTML của thẻ phim
 */
function createMovieCardHTML(movie) {
  const safeTitle = escapeHTML(movie.Title);
  const safeYear = escapeHTML(movie.Year);
  const safeId = escapeHTML(movie.imdbID);

  // Kiểm tra poster
  const posterUrl =
    movie.Poster && movie.Poster !== "N/A" ? movie.Poster : FALLBACK_POSTER;

  // Điểm IMDb
  const rating =
    movie.imdbRating && movie.imdbRating !== "N/A" ? escapeHTML(movie.imdbRating) : "N/A";

  return `
    <a href="movie.html?id=${safeId}" class="movie-card" title="Xem chi tiết ${safeTitle}">
      <div class="poster-wrapper">
        <img
          src="${posterUrl}"
          alt="Poster phim ${safeTitle}"
          loading="lazy"
          onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';"
        />
        <div class="rating-badge">
          <span class="star-icon">⭐</span>
          <span>${rating}</span>
        </div>
      </div>
      <div class="movie-info">
        <h3 class="movie-title">${safeTitle}</h3>
        <div class="movie-meta">
          <span class="movie-year">${safeYear}</span>
          <span class="movie-type-tag">Phim</span>
        </div>
      </div>
    </a>
  `;
}

/**
 * 5. Hàm tải danh sách 12 phim nổi tiếng ban đầu
 */
async function loadPopularMovies() {
  const movieListContainer = document.getElementById("movie-list");
  if (!movieListContainer) return;

  // Nếu đã tải và có dữ liệu trong bộ nhớ tạm (cache), hiển thị ngay lập tức
  if (cachedPopularMovies && cachedPopularMovies.length > 0) {
    movieListContainer.innerHTML = cachedPopularMovies.map(createMovieCardHTML).join("");
    return;
  }

  // Trạng thái đang tải
  movieListContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Đang tải danh sách phim nổi tiếng...</p>
    </div>
  `;

  try {
    const moviePromises = POPULAR_MOVIE_IDS.map(async (imdbID) => {
      try {
        const movie = await getMovieDetail(imdbID);
        if (movie && movie.Response === "True") {
          return movie;
        }
        return null;
      } catch (err) {
        console.warn(`Bỏ qua phim ${imdbID} do lỗi:`, err);
        return null;
      }
    });

    const results = await Promise.all(moviePromises);
    const validMovies = results.filter((movie) => movie !== null);

    if (validMovies.length === 0) {
      movieListContainer.innerHTML = `
        <div class="error-state">
          <p>⚠️ Không thể tải danh sách phim. Vui lòng kiểm tra lại kết nối mạng hoặc API key!</p>
        </div>
      `;
      return;
    }

    cachedPopularMovies = validMovies;
    movieListContainer.innerHTML = validMovies.map(createMovieCardHTML).join("");
  } catch (error) {
    console.error("Lỗi khi tải danh sách phim:", error);
    movieListContainer.innerHTML = `
      <div class="error-state">
        <p>⚠️ Đã xảy ra lỗi khi tải dữ liệu phim. Vui lòng tải lại trang!</p>
      </div>
    `;
  }
}

/**
 * 6. Hàm xử lý tìm kiếm phim theo từ khóa
 * @param {string} rawKeyword - Từ khóa do người dùng nhập
 */
async function handleSearch(rawKeyword) {
  const keyword = rawKeyword.trim();
  const movieListContainer = document.getElementById("movie-list");
  const clearBtn = document.getElementById("clear-search-btn");

  if (!movieListContainer) return;

  // Cập nhật ẩn/hiện nút "X" xóa ô tìm kiếm
  if (clearBtn) {
    clearBtn.hidden = keyword === "";
  }

  // Nếu từ khóa rỗng -> quay về danh sách 12 phim nổi tiếng ban đầu
  if (keyword === "") {
    loadPopularMovies();
    return;
  }

  // Tăng ID phiên tìm kiếm để chống kết quả cũ ghi đè kết quả mới
  const requestId = ++currentSearchRequestId;

  // Hiển thị vòng xoay đang tìm kiếm
  movieListContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Đang tìm kiếm phim cho "${escapeHTML(keyword)}"...</p>
    </div>
  `;

  try {
    // 1. Tìm danh sách phim cơ bản theo từ khóa bằng searchMovies
    const searchResults = await searchMovies(keyword);

    // Kiểm tra xem lượt tìm kiếm này còn là lượt mới nhất không
    if (requestId !== currentSearchRequestId) {
      console.log(`Bỏ qua kết quả cũ của từ khóa: "${keyword}"`);
      return;
    }

    // Nếu không tìm thấy phim nào
    if (!searchResults || searchResults.length === 0) {
      movieListContainer.innerHTML = `
        <div class="error-state">
          <div style="font-size: 3rem;">🔍</div>
          <h3>Không tìm thấy bộ phim nào phù hợp</h3>
          <p>Không có kết quả cho từ khóa <strong>"${escapeHTML(keyword)}"</strong>.</p>
          <p style="color: #64748b; font-size: 0.9rem;">Gợi ý: Thử tìm bằng tên tiếng Anh chuẩn xác (ví dụ: Batman, Avatar, Titanic...).</p>
        </div>
      `;
      return;
    }

    // 2. Vì searchMovies không có imdbRating, lấy chi tiết tối đa 10 phim đầu tiên bằng Promise.all
    const topMovies = searchResults.slice(0, 10);
    const detailPromises = topMovies.map(async (item) => {
      try {
        const detail = await getMovieDetail(item.imdbID);
        if (detail && detail.Response === "True") {
          return detail;
        }
        return item; // Fallback nếu chi tiết lỗi thì vẫn giữ thông tin cơ bản
      } catch {
        return item;
      }
    });

    const fullMovies = await Promise.all(detailPromises);

    // Kiểm tra lại lần nữa trước khi render (đề phòng người dùng gõ từ khóa mới trong lúc đang fetch chi tiết)
    if (requestId !== currentSearchRequestId) {
      return;
    }

    // Hiển thị danh sách kết quả tìm kiếm ra giao diện
    movieListContainer.innerHTML = fullMovies.map(createMovieCardHTML).join("");
    console.log(`Đã hiển thị ${fullMovies.length} kết quả tìm kiếm cho: "${keyword}"`);
  } catch (error) {
    if (requestId !== currentSearchRequestId) return;
    console.error("Lỗi khi tìm kiếm:", error);
    movieListContainer.innerHTML = `
      <div class="error-state">
        <p>⚠️ Đã xảy ra lỗi trong quá trình tìm kiếm. Vui lòng thử lại!</p>
      </div>
    `;
  }
}

/**
 * 7. Thiết lập sự kiện khi trang đã tải xong
 */
document.addEventListener("DOMContentLoaded", function () {
  // Tải danh sách phim nổi tiếng ban đầu
  loadPopularMovies();

  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search-btn");

  if (searchInput) {
    // Áp dụng debounce 500ms khi gõ phím
    const debouncedSearch = debounce(function (event) {
      handleSearch(event.target.value);
    }, 500);

    searchInput.addEventListener("input", function (e) {
      // Cập nhật ngay trạng thái nút X khi người dùng bắt đầu gõ
      if (clearBtn) {
        clearBtn.hidden = e.target.value.trim() === "";
      }
      debouncedSearch(e);
    });
  }

  // Xử lý khi nhấn nút "X" để xóa nhanh ô tìm kiếm
  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", function () {
      searchInput.value = "";
      clearBtn.hidden = true;
      handleSearch("");
      searchInput.focus();
    });
  }
});
