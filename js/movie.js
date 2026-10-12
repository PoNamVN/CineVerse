/**
 * js/movie.js
 * Logic hiển thị trang chi tiết phim (movie.html) từ backend TMDB chuẩn Netflix
 * Thiết kế tối giản, loại bỏ icon rườm rà, tập trung thông tin điện ảnh chính xác
 */

// Ảnh poster thay thế dự phòng dạng SVG tối giản
const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
      <rect width="300" height="450" fill="#181818"/>
      <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#E50914" font-family="sans-serif" font-size="28" font-weight="bold">CINEFLIX</text>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#737373" font-family="sans-serif" font-size="14">Không có hình ảnh</text>
    </svg>
  `);

/**
 * 1. Hàm làm sạch chuỗi chống lỗi XSS
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
 * 2. Lấy tham số "id" từ thanh địa chỉ URL (ví dụ: movie.html?id=550)
 * @returns {string|null}
 */
function getMovieIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

/**
 * 3. Tạo HTML hiển thị toàn bộ chi tiết bộ phim chuẩn phong cách Netflix
 * @param {Object} movie - Dữ liệu chi tiết từ GET /api/movies/:id
 * @returns {string} Chuỗi HTML
 */
function createMovieDetailHTML(movie) {
  const safeTitle = escapeHTML(movie.title);
  const safeOriginalTitle = movie.original_title ? escapeHTML(movie.original_title) : "";
  const safeOverview = movie.overview ? escapeHTML(movie.overview) : "Hiện chưa có bài tóm tắt tiếng Việt chính thức cho tác phẩm này.";

  const posterSrc = movie.posterUrl || FALLBACK_POSTER;

  // Năm & ngày phát hành
  const releaseYear = movie.release_date && movie.release_date.length >= 4 ? movie.release_date.slice(0, 4) : "Chưa rõ";
  const releaseDateText = movie.release_date || "Chưa rõ";

  // Thời lượng phim
  const runtimeText = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m (${movie.runtime} phút)` : "Tiêu chuẩn";

  // Điểm đánh giá
  let ratingText = "Chưa có";
  if (typeof movie.vote_average === "number" && movie.vote_average > 0) {
    ratingText = `${(Math.round(movie.vote_average * 10) / 10).toFixed(1)} / 10`;
  }

  // Danh sách thể loại
  const genresHTML = (movie.genres || [])
    .map((g) => `<span class="genre-tag">${escapeHTML(g.name)}</span>`)
    .join("");

  // Nút liên kết IMDb
  const imdbBtnHTML = movie.imdb_id
    ? `<a href="https://www.imdb.com/title/${escapeHTML(movie.imdb_id)}" target="_blank" rel="noopener noreferrer" class="imdb-link-btn">
         Mở Trên IMDb
       </a>`
    : "";

  // Khung Trailer YouTube nếu có
  const trailerHTML = movie.trailerKey
    ? `
      <div class="trailer-section" id="trailer-section">
        <h3 class="section-subheading">Trailer Chính Thức</h3>
        <div class="video-responsive">
          <iframe
            src="https://www.youtube.com/embed/${escapeHTML(movie.trailerKey)}?autoplay=0&rel=0"
            title="Trailer ${safeTitle}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    `
    : `
      <div class="no-trailer-text">
        <p>Chưa có video trailer nhúng trực tiếp từ TMDB cho tựa phim này.</p>
        <a
          href="https://www.youtube.com/results?search_query=${encodeURIComponent(safeTitle + " trailer")}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-youtube-search"
        >
          Mở Tìm Trailer Trên YouTube &rarr;
        </a>
      </div>
    `;

  return `
    <div class="movie-detail-card">
      <!-- Cột trái: Poster phim nổi bật -->
      <div class="detail-poster-wrapper">
        <img
          src="${posterSrc}"
          alt="Poster ${safeTitle}"
          class="detail-poster-img"
          onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';"
        />
      </div>

      <!-- Cột phải: Thông tin chi tiết -->
      <div class="detail-content">
        <div class="netflix-detail-tag">
          <span class="n-logo">N</span>
          <span>PHIM ĐIỆN ẢNH</span>
        </div>

        <h1 class="detail-title">${safeTitle}</h1>
        ${
          safeOriginalTitle && safeOriginalTitle !== safeTitle
            ? `<p class="detail-original-title">${safeOriginalTitle} (${releaseYear})</p>`
            : `<p class="detail-original-title">Phát hành: ${releaseYear}</p>`
        }

        <!-- Các huy hiệu thông số chuẩn Netflix -->
        <div class="detail-badges">
          <span class="badge rating-badge-detail">Điểm TMDB: ${ratingText}</span>
          <span class="badge">Thời lượng: ${runtimeText}</span>
          <span class="badge">Khởi chiếu: ${releaseDateText}</span>
          ${imdbBtnHTML}
        </div>

        <!-- Thể loại phim -->
        <div class="genre-list">
          ${genresHTML || '<span class="genre-tag">Điện ảnh</span>'}
        </div>

        <!-- Tóm tắt cốt truyện -->
        <div class="overview-section">
          <h3 class="section-subheading">Tóm Tắt Cốt Truyện</h3>
          <p class="overview-text">${safeOverview}</p>
        </div>

        <!-- Phần Trailer Video -->
        ${trailerHTML}
      </div>
    </div>
  `;
}

/**
 * 4. Hàm tải và hiển thị chi tiết phim
 */
async function loadMovieDetail() {
  const detailContainer = document.getElementById("movie-detail");
  if (!detailContainer) return;

  const movieId = getMovieIdFromURL();

  // Kiểm tra nếu URL không có ID hoặc ID sai định dạng
  if (!movieId || !/^[1-9]\d*$/.test(movieId)) {
    detailContainer.innerHTML = `
      <div class="error-state">
        <h3>Không tìm thấy mã phim</h3>
        <p>Đường dẫn không hợp lệ hoặc thiếu mã phim cần xem.</p>
        <a href="index.html" class="btn-netflix-back" style="margin-top: 1.5rem;">Quay lại Trang Chủ</a>
      </div>
    `;
    return;
  }

  // Hiển thị vòng xoay đang tải
  detailContainer.innerHTML = `
    <div class="loading-state">
      <div class="netflix-spinner"></div>
      <p>Đang giải mã thông tin phim từ TMDB...</p>
    </div>
  `;

  try {
    const movie = await getMovieDetail(movieId);

    if (!movie) {
      detailContainer.innerHTML = `
        <div class="error-state">
          <h3>Không tìm thấy bộ phim này</h3>
          <p>Có thể phim đã bị gỡ hoặc mã ID không chính xác.</p>
          <a href="index.html" class="btn-netflix-back" style="margin-top: 1.5rem;">Quay lại Trang Chủ</a>
        </div>
      `;
      return;
    }

    // Đổi tiêu đề tab trình duyệt theo tên phim
    document.title = `${movie.title} - CineFlix`;

    // Ảnh backdrop mờ phủ toàn màn hình phía sau nội dung
    const backdrop = document.getElementById("detail-backdrop");
    if (movie.backdropUrl && backdrop) {
      backdrop.style.backgroundImage = `url('${movie.backdropUrl}')`;
      backdrop.classList.add("loaded");
    }

    // Đổ nội dung chi tiết vào giao diện
    detailContainer.innerHTML = createMovieDetailHTML(movie);
  } catch (error) {
    console.error("Lỗi khi tải chi tiết phim:", error);
    detailContainer.innerHTML = `
      <div class="error-state">
        <h3>Không kết nối được máy chủ</h3>
        <p>Hãy đảm bảo backend đang hoạt động (<code>npm start</code> trong thư mục backend).</p>
        <a href="index.html" class="btn-netflix-back" style="margin-top: 1.5rem;">Quay lại Trang Chủ</a>
      </div>
    `;
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", loadMovieDetail);
