/**
 * js/home.js
 * Logic giao diện CineFlix chuẩn phong cách Netflix:
 * - Không sử dụng icon/emoji rườm rà, tập trung giao diện hiện đại & tính năng cao
 * - Tính năng sắp xếp: Phổ biến, Điểm cao nhất, Mới nhất, A - Z
 * - Bộ lọc thể loại trực quan
 * - Quản lý Danh sách yêu thích (Watchlist localStorage) & Nút xóa toàn bộ
 * - Hero Billboard toàn cảnh động
 * - Dãy Top 10 số khổng lồ
 * - Hộp thoại phát Trailer YouTube (Modal Video)
 * - Tìm kiếm Debounce chống race condition
 */

// Ảnh poster dự phòng dạng SVG tối giản
const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
      <rect width="300" height="450" fill="#181818"/>
      <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#E50914" font-family="sans-serif" font-size="28" font-weight="bold">CINEFLIX</text>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#737373" font-family="sans-serif" font-size="14">Không có poster</text>
    </svg>
  `);

// Quản lý trạng thái ứng dụng
let popularPage = 1;
let popularTotalPages = 1;
let allLoadedMovies = []; // Lưu trữ tất cả phim đã tải
let currentSortType = "default";
let currentGenreFilter = "";

let isSearchMode = false;
let currentSearchQuery = "";
let searchPage = 1;
let searchTotalPages = 1;
let currentSearchRequestId = 0;

let currentHeroMovie = null;
let heroTimer = null;
// Mọi phim đã render (lưới, hàng thể loại, tìm kiếm) để nút Lưu có đủ poster/tên
const movieCache = new Map();

const GENRE_ROWS = [
  { id: 28, name: "Hành Động" },
  { id: 878, name: "Khoa Học Viễn Tưởng" },
  { id: 16, name: "Hoạt Hình" },
  { id: 27, name: "Kinh Dị" },
  { id: 35, name: "Hài Hước" },
];

// ============================================================================
// 1. CÁC HÀM TIỆN ÍCH CƠ BẢN
// ============================================================================

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function debounce(func, delay = 500) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// ============================================================================
// 2. QUẢN LÝ DANH SÁCH YÊU THÍCH (WATCHLIST LOCALSTORAGE)
// ============================================================================

function getWatchlist() {
  try {
    const list = localStorage.getItem("cineflix_watchlist");
    return list ? JSON.parse(list) : [];
  } catch (_) {
    return [];
  }
}

function saveWatchlist(list) {
  try {
    localStorage.setItem("cineflix_watchlist", JSON.stringify(list));
  } catch (_) {}
}

function isInWatchlist(movieId) {
  const list = getWatchlist();
  return list.some((item) => String(item.id) === String(movieId));
}

function toggleWatchlistMovie(movie) {
  let list = getWatchlist();
  const exists = list.some((item) => String(item.id) === String(movie.id));

  if (exists) {
    list = list.filter((item) => String(item.id) !== String(movie.id));
  } else {
    list.push({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterUrl,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
    });
  }

  saveWatchlist(list);
  updateWatchlistBadge();
  renderWatchlistSection();
  return !exists;
}

function updateWatchlistBadge() {
  const badge = document.getElementById("watchlist-count");
  if (badge) {
    badge.textContent = getWatchlist().length;
  }
}

function renderWatchlistSection() {
  const section = document.getElementById("watchlist-section");
  const grid = document.getElementById("watchlist-grid");
  if (!section || !grid) return;

  const list = getWatchlist();
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <p>Danh sách của bạn đang trống. Nhấn dấu (+) trên các phim để lưu vào đây nhé.</p>
      </div>
    `;
    return;
  }

  section.hidden = false;
  grid.innerHTML = list.map((movie) => createMovieCardHTML(movie)).join("");
}

// ============================================================================
// 3. RENDER THẺ PHIM (CARD) - THIẾT KẾ TỐI GIẢN CHUẨN ĐIỆN ẢNH
// ============================================================================

function createMovieCardHTML(movie) {
  const safeTitle = escapeHTML(movie.title);
  const movieId = movie.id;
  const isSaved = isInWatchlist(movieId);

  movieCache.set(String(movieId), movie);

  const yearText = typeof movie.release_date === "string" ? escapeHTML(movie.release_date.slice(0, 4)) : "";

  // Điểm đánh giá
  let ratingText = "Chưa có";
  if (typeof movie.vote_average === "number" && movie.vote_average > 0) {
    ratingText = (Math.round(movie.vote_average * 10) / 10).toFixed(1);
  }

  const posterSrc = movie.posterUrl ? movie.posterUrl : FALLBACK_POSTER;

  return `
    <div class="netflix-card" data-id="${movieId}">
      <div class="poster-container">
        <a href="movie.html?id=${movieId}" class="poster-link" title="${safeTitle}">
          <img
            src="${posterSrc}"
            alt="${safeTitle}"
            class="card-poster-img"
            loading="lazy"
            onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';"
          />
          <div class="poster-gradient-overlay"></div>
        </a>

        <!-- Huy hiệu điểm số góc trên (không dùng icon emoji) -->
        <div class="card-badge-rating">
          <span class="rating-label">TMDB</span>
          <span class="rating-num">${ratingText}</span>
        </div>

        <!-- Lớp phủ hành động nhanh khi rê chuột -->
        <div class="card-hover-overlay">
          <div class="hover-actions-bar">
            <a href="movie.html?id=${movieId}" class="card-action-chip primary" title="Xem Chi Tiết Phim">
              Chi Tiết
            </a>
            <button type="button" class="card-action-chip secondary ${isSaved ? 'added' : ''}" onclick="handleCardWatchlistClick(event, ${movieId})" title="Lưu danh sách">
              ${isSaved ? '✓ Đã Lưu' : '+ Lưu'}
            </button>
          </div>
        </div>
      </div>

      <!-- Thông tin tên phim và metadata bên dưới -->
      <a href="movie.html?id=${movieId}" class="card-details-link">
        <div class="card-details">
          <h3 class="card-movie-title" title="${safeTitle}">${safeTitle}</h3>
          <div class="card-meta-row">
            <span class="meta-year">${yearText}</span>
          </div>
        </div>
      </a>
    </div>
  `;
}

// Bắt sự kiện bấm nút Watchlist trên thẻ
window.handleCardWatchlistClick = function (event, movieId) {
  event.preventDefault();
  event.stopPropagation();

  const movie = movieCache.get(String(movieId)) || { id: movieId, title: "Phim" };
  const added = toggleWatchlistMovie(movie);

  const btn = event.currentTarget;
  if (btn) {
    btn.textContent = added ? "✓ Đã Lưu" : "+ Lưu";
    btn.classList.toggle("added", added);
  }
};

// ============================================================================
// 4. DÃY TOP 10 VỚI SỐ KHỔNG LỒ (NETFLIX NUMBERED ROW)
// ============================================================================

function renderTop10Row(movies) {
  const track = document.getElementById("top10-track");
  if (!track) return;

  const top10List = movies.slice(0, 10);
  if (top10List.length === 0) return;

  track.innerHTML = top10List
    .map((movie, index) => {
      const rank = index + 1;
      const safeTitle = escapeHTML(movie.title);
      const posterSrc = movie.posterUrl || FALLBACK_POSTER;

      return `
        <div class="top10-item" data-id="${movie.id}">
          <div class="rank-number">${rank}</div>
          <div class="top10-poster-wrap">
            <a href="movie.html?id=${movie.id}" title="${safeTitle}">
              <img
                src="${posterSrc}"
                alt="${safeTitle}"
                class="top10-poster-img"
                loading="lazy"
                onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';"
              />
              <div class="top10-hover-badge">Chi Tiết</div>
            </a>
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================================================================
// 4b. HÀNG PHIM CUỘN NGANG THEO THỂ LOẠI + SKELETON + HIỆU ỨNG XUẤT HIỆN
// ============================================================================

function skeletonCards(count) {
  return '<div class="skeleton-card" aria-hidden="true"></div>'.repeat(count);
}

function rowSectionHTML(title, innerHTML, genreId = "") {
  return `
    <section class="netflix-row-section" data-genre-row="${genreId}">
      <div class="row-header">
        <h2 class="row-title"><span class="red-bar"></span>${title}</h2>
      </div>
      <div class="row-carousel">
        <button type="button" class="carousel-arrow arrow-left" aria-label="Cuộn sang trái">‹</button>
        <div class="row-track">${innerHTML}</div>
        <button type="button" class="carousel-arrow arrow-right" aria-label="Cuộn sang phải">›</button>
      </div>
    </section>
  `;
}

async function renderGenreRows(trendingMovies) {
  const container = document.getElementById("genre-rows");
  if (!container || container.children.length) return; // đã render rồi thì giữ nguyên

  container.innerHTML =
    rowSectionHTML("Phim Thịnh Hành", trendingMovies.map((m) => createMovieCardHTML(m)).join("")) +
    GENRE_ROWS.map((g) => rowSectionHTML(`Phim ${g.name}`, skeletonCards(6), g.id)).join("");
  observeReveal(container);

  await Promise.all(
    GENRE_ROWS.map(async (g) => {
      const section = container.querySelector(`[data-genre-row="${g.id}"]`);
      try {
        const data = await getPopularMovies(1, g.id);
        section.querySelector(".row-track").innerHTML = (data.results || []).map((m) => createMovieCardHTML(m)).join("");
      } catch (_) {
        section.remove();
      }
    })
  );
}

const revealObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      )
    : null;

function observeReveal(root) {
  if (!revealObserver) return;
  root.querySelectorAll(".netflix-row-section:not(.reveal)").forEach((section) => {
    section.classList.add("reveal");
    revealObserver.observe(section);
  });
}

// ============================================================================
// 5. SIÊU BANNER SLIDESHOW (5 PHIM NỔI BẬT, TỰ CHUYỂN 8 GIÂY)
// ============================================================================

const HERO_INTERVAL_MS = 8000;

function updateHeroBillboard(movie) {
  if (!movie) return;
  currentHeroMovie = movie;

  const content = document.querySelector(".billboard-content");
  const bg = document.getElementById("billboard-bg");
  const addBtn = document.getElementById("billboard-add-btn");

  // Khởi động lại animation fade mỗi lần đổi phim
  content.classList.remove("hero-fade");
  void content.offsetWidth;
  content.classList.add("hero-fade");

  document.getElementById("billboard-title").textContent = movie.title;
  document.getElementById("billboard-info-btn").href = `movie.html?id=${movie.id}`;
  document.getElementById("billboard-year").textContent = (movie.release_date || "").slice(0, 4);
  document.getElementById("billboard-rating").textContent =
    movie.vote_average > 0 ? `${movie.vote_average.toFixed(1)} / 10 TMDB` : "";
  document.getElementById("billboard-overview").textContent = movie.overview || "";

  const image = movie.backdropUrl || movie.posterUrl;
  if (image) bg.style.backgroundImage = `url('${image}')`;

  const syncSaveButton = () => {
    const isSaved = isInWatchlist(movie.id);
    addBtn.querySelector(".round-icon").textContent = isSaved ? "✓" : "+";
    addBtn.querySelector(".save-text").textContent = isSaved ? "Đã Lưu" : "Lưu Danh Sách";
    addBtn.classList.toggle("saved", isSaved);
  };
  syncSaveButton();
  addBtn.onclick = () => {
    toggleWatchlistMovie(movie);
    syncSaveButton();
  };
}

function startHeroSlideshow(movies) {
  const slides = movies.filter((m) => m.backdropUrl).slice(0, 5);
  const dots = document.getElementById("hero-dots");
  clearInterval(heroTimer);
  if (slides.length === 0) return;

  let index = 0;
  const show = (i) => {
    index = i;
    updateHeroBillboard(slides[i]);
    dots.querySelectorAll(".hero-dot").forEach((dot, j) => {
      dot.classList.toggle("active", j === i);
      dot.setAttribute("aria-selected", j === i);
    });
  };
  const restart = () => {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => show((index + 1) % slides.length), HERO_INTERVAL_MS);
  };

  dots.innerHTML = slides
    .map((m, i) => `<button type="button" class="hero-dot" role="tab" data-index="${i}" aria-label="${escapeHTML(m.title)}"></button>`)
    .join("");
  dots.onclick = (e) => {
    const dot = e.target.closest(".hero-dot");
    if (!dot) return;
    show(Number(dot.dataset.index));
    restart();
  };

  show(0);
  restart();
}

// ============================================================================
// 7. TÍNH NĂNG SẮP XẾP VÀ LỌC PHIM
// ============================================================================

function getDisplayedMovies() {
  let list = [...allLoadedMovies];

  // Lọc theo thể loại nếu đang chọn
  if (currentGenreFilter) {
    list = list.filter(
      (m) => Array.isArray(m.genre_ids) && m.genre_ids.includes(Number(currentGenreFilter))
    );
  }

  // Sắp xếp
  switch (currentSortType) {
    case "rating":
      list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      break;
    case "latest":
      list.sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      });
      break;
    case "az":
      list.sort((a, b) => (a.title || "").localeCompare(b.title || "", "vi"));
      break;
    default:
      // Mặc định: theo thứ tự API TMDB trả về
      break;
  }

  return list;
}

function renderCurrentMovieGrid() {
  const movieListContainer = document.getElementById("movie-list");
  if (!movieListContainer) return;

  const movies = getDisplayedMovies();
  if (movies.length === 0) {
    movieListContainer.innerHTML = `
      <div class="empty-state">
        <h3>Chưa có phim phù hợp với tiêu chí lọc</h3>
        <p>Thử đổi thể loại hoặc nhấn nút "Phổ Biến" để xem tất cả phim.</p>
      </div>
    `;
    return;
  }

  movieListContainer.innerHTML = movies.map((m) => createMovieCardHTML(m)).join("");
}

// ============================================================================
// 8. TẢI PHIM PHỔ BIẾN & TÌM KIẾM
// ============================================================================

async function loadPopularMovies(isInitial = true) {
  const movieListContainer = document.getElementById("movie-list");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const heading = document.getElementById("section-heading");
  const heroBillboard = document.getElementById("hero-billboard");
  const top10Section = document.getElementById("top10-section");
  const genreSection = document.querySelector(".genre-section");
  const sortToolbar = document.getElementById("sort-toolbar");
  const genreRows = document.getElementById("genre-rows");
  const trendingSection = document.getElementById("trending-section");

  if (!movieListContainer) return;

  isSearchMode = false;
  if (heroBillboard) heroBillboard.hidden = false;
  if (top10Section) top10Section.hidden = false;
  if (genreSection) genreSection.hidden = false;
  if (sortToolbar) sortToolbar.hidden = false;
  // Trang chủ mặc định: các hàng cuộn ngang; chọn thể loại: lưới đầy đủ có sắp xếp + tải thêm
  if (genreRows) genreRows.hidden = Boolean(currentGenreFilter);
  if (trendingSection) trendingSection.hidden = !currentGenreFilter;
  if (heading) heading.innerHTML = '<span class="red-bar"></span> Phim Thịnh Hành Trên CineFlix';

  if (isInitial) {
    popularPage = 1;
    movieListContainer.innerHTML = skeletonCards(10);
    if (loadMoreBtn) loadMoreBtn.hidden = true;
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.querySelector(".more-text").textContent = "ĐANG TẢI THÊM...";
    }
  }

  try {
    const data = await getPopularMovies(popularPage, currentGenreFilter);
    const movies = data.results || [];
    popularTotalPages = data.total_pages || 1;

    if (isInitial) {
      allLoadedMovies = [...movies];

      // Chế độ "Tất Cả": slideshow 5 phim, Top 10, hàng thịnh hành (phim 11-20) + hàng thể loại
      if (!currentGenreFilter && movies.length > 0) {
        startHeroSlideshow(movies);
        renderTop10Row(movies);
        renderGenreRows(movies.slice(10));
      }

      // Hiển thị danh sách chính
      renderCurrentMovieGrid();
    } else {
      allLoadedMovies = [...allLoadedMovies, ...movies];
      renderCurrentMovieGrid();
    }

    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.querySelector(".more-text").textContent = "TẢI THÊM PHIM BOM TẤN";
      loadMoreBtn.hidden = popularPage >= popularTotalPages;
    }
  } catch (error) {
    console.error("Lỗi khi nạp phim:", error);
    if (isInitial) {
      movieListContainer.innerHTML = `
        <div class="error-state">
          <h3>Không thể kết nối với máy chủ</h3>
          <p>Vui lòng đảm bảo backend đang chạy tại <code>http://localhost:5000</code>.</p>
        </div>
      `;
    }
  }
}

// Tìm kiếm phim với Debounce
async function executeSearch(query, pageToLoad = 1, isInitial = true) {
  const movieListContainer = document.getElementById("movie-list");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const heading = document.getElementById("section-heading");
  const heroBillboard = document.getElementById("hero-billboard");
  const top10Section = document.getElementById("top10-section");
  const genreSection = document.querySelector(".genre-section");
  const sortToolbar = document.getElementById("sort-toolbar");

  if (!movieListContainer) return;

  const thisRequestId = ++currentSearchRequestId;
  isSearchMode = true;
  currentSearchQuery = query;

  if (heroBillboard) heroBillboard.hidden = true;
  if (top10Section) top10Section.hidden = true;
  if (genreSection) genreSection.hidden = true;
  if (sortToolbar) sortToolbar.hidden = true;
  const genreRows = document.getElementById("genre-rows");
  const trendingSection = document.getElementById("trending-section");
  if (genreRows) genreRows.hidden = true;
  if (trendingSection) trendingSection.hidden = false;
  if (heading) heading.innerHTML = `<span class="red-bar"></span> Kết Quả Tìm Kiếm Cho: "${escapeHTML(query)}"`;

  if (isInitial) {
    searchPage = 1;
    movieListContainer.innerHTML = skeletonCards(10);
    if (loadMoreBtn) loadMoreBtn.hidden = true;
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.querySelector(".more-text").textContent = "ĐANG TÌM THÊM...";
    }
  }

  try {
    const data = await searchMovies(query, pageToLoad);
    if (thisRequestId !== currentSearchRequestId) return;

    const movies = data.results || [];
    searchTotalPages = data.total_pages || 1;

    if (isInitial) {
      if (movies.length === 0) {
        movieListContainer.innerHTML = `
          <div class="empty-state">
            <h3>Không tìm thấy phim phù hợp</h3>
            <p>Thử tìm với từ khóa khác như <em>Batman, Avatar, Marvel, Người Nhện...</em></p>
          </div>
        `;
        if (loadMoreBtn) loadMoreBtn.hidden = true;
        return;
      }
      movieListContainer.innerHTML = movies.map((m) => createMovieCardHTML(m)).join("");
    } else {
      const newCardsHTML = movies.map((m) => createMovieCardHTML(m)).join("");
      movieListContainer.insertAdjacentHTML("beforeend", newCardsHTML);
    }

    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.querySelector(".more-text").textContent = "TẢI THÊM KẾT QUẢ";
      loadMoreBtn.hidden = searchPage >= searchTotalPages;
    }
  } catch (error) {
    if (thisRequestId !== currentSearchRequestId) return;
    movieListContainer.innerHTML = `
      <div class="error-state">
        <h3>Lỗi khi tìm kiếm phim</h3>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;
  }
}

// ============================================================================
// 9. KHỞI CHẠY VÀ GẮN SỰ KIỆN TOÀN CỤC
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const header = document.getElementById("site-header");
  const searchToggleBtn = document.getElementById("search-toggle-btn");
  const searchBox = document.getElementById("search-box");
  const clearWatchlistBtn = document.getElementById("clear-watchlist-btn");

  // A. Header kính mờ khi cuộn
  window.addEventListener("scroll", () => {
    if (window.scrollY > 40) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // A2. Mũi tên cuộn cho mọi hàng ngang (Top 10 + hàng thể loại)
  document.addEventListener("click", (e) => {
    const arrow = e.target.closest(".carousel-arrow");
    if (!arrow) return;
    const track = arrow.parentElement.querySelector(".row-track, .top10-track");
    const direction = arrow.classList.contains("arrow-left") ? -1 : 1;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  });

  // A3. Hiệu ứng xuất hiện dần cho các section tĩnh
  observeReveal(document);
  const top10Track = document.getElementById("top10-track");
  if (top10Track) top10Track.innerHTML = skeletonCards(6);

  // B. Bật mở ô tìm kiếm
  if (searchToggleBtn && searchBox && searchInput) {
    searchToggleBtn.onclick = () => {
      searchBox.classList.toggle("open");
      if (searchBox.classList.contains("open")) {
        searchInput.focus();
      }
    };
  }

  // C. Tìm kiếm với Debounce
  const handleSearchDebounced = debounce((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      loadPopularMovies(true);
    } else {
      executeSearch(trimmed, 1, true);
    }
  }, 500);

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (clearSearchBtn) clearSearchBtn.hidden = !val;
      handleSearchDebounced(val);
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearSearchBtn.hidden = true;
      searchInput.focus();
      loadPopularMovies(true);
    });
  }

  // D. Nút Tải thêm
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      if (isSearchMode) {
        searchPage++;
        executeSearch(currentSearchQuery, searchPage, false);
      } else {
        popularPage++;
        loadPopularMovies(false);
      }
    });
  }

  // E. Bộ lọc thể loại
  const genrePills = document.querySelectorAll(".genre-pill");
  const heading = document.getElementById("section-heading");
  genrePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      genrePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      currentGenreFilter = pill.getAttribute("data-genre") || "";
      const genreName = pill.textContent.trim();

      if (heading) {
        if (!currentGenreFilter) {
          heading.innerHTML = '<span class="red-bar"></span> Phim Thịnh Hành Trên CineFlix';
        } else {
          heading.innerHTML = `<span class="red-bar"></span> Phim ${escapeHTML(genreName)} Thịnh Hành`;
        }
      }

      // Tải trực tiếp phim theo thể loại từ TMDB
      popularPage = 1;
      loadPopularMovies(true);

      const target = document.getElementById(currentGenreFilter ? "trending-section" : "genre-rows");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // F. Thanh công cụ sắp xếp
  const sortPills = document.querySelectorAll(".sort-pill");
  sortPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      sortPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      currentSortType = pill.getAttribute("data-sort") || "default";
      renderCurrentMovieGrid();
    });
  });

  // G. Xóa toàn bộ Watchlist
  if (clearWatchlistBtn) {
    clearWatchlistBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc muốn xóa toàn bộ danh sách đã lưu không?")) {
        saveWatchlist([]);
        updateWatchlistBadge();
        renderWatchlistSection();
      }
    });
  }

  // H. Bấm nút "Danh Sách Của Tôi" trên thanh điều hướng
  const navWatchlistBtn = document.getElementById("nav-watchlist-btn");
  if (navWatchlistBtn) {
    navWatchlistBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const section = document.getElementById("watchlist-section");
      if (section) {
        section.hidden = false;
        renderWatchlistSection();
        section.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // I. Cập nhật Watchlist và tải phim ban đầu
  updateWatchlistBadge();
  renderWatchlistSection();
  loadPopularMovies(true);
});
