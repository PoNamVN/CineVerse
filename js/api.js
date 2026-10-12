/**
 * js/api.js
 * Quản lý các hàm gọi API thông qua backend Express (http://localhost:5000)
 */

const API_BASE = "http://localhost:5000";

/**
 * 1. Lấy danh sách phim phổ biến / theo thể loại từ backend
 * @param {number} page - Số trang cần lấy (mặc định 1)
 * @param {string|number} genre - ID thể loại TMDB nếu cần lọc (ví dụ 28 cho Hành Động)
 * @returns {Promise<{ results: Array, page: number, total_pages: number }>}
 */
async function getPopularMovies(page = 1, genre = "") {
  try {
    const url = `${API_BASE}/api/movies/popular?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Lỗi máy chủ: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[getPopularMovies] Lỗi khi gọi trang ${page} (thể loại: ${genre}):`, error.message);
    throw error;
  }
}

/**
 * 2. Tìm kiếm phim theo từ khóa từ backend
 * @param {string} query - Từ khóa tìm kiếm
 * @param {number} page - Số trang (mặc định 1)
 * @returns {Promise<{ results: Array, page: number, total_pages: number }>}
 */
async function searchMovies(query, page = 1) {
  if (!query || query.trim() === "") {
    return { results: [], page: 1, total_pages: 1 };
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/movies/search?query=${encodeURIComponent(query.trim())}&page=${page}`
    );
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Lỗi máy chủ: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[searchMovies] Lỗi tìm kiếm "${query}":`, error.message);
    throw error;
  }
}

/**
 * 3. Lấy thông tin chi tiết một bộ phim theo ID từ backend
 * @param {number|string} id - ID phim
 * @returns {Promise<Object|null>}
 */
async function getMovieDetail(id) {
  if (!id) return null;

  try {
    const response = await fetch(`${API_BASE}/api/movies/${id}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Lỗi máy chủ: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[getMovieDetail] Lỗi lấy chi tiết phim ${id}:`, error.message);
    throw error;
  }
}

/**
 * 4. Lấy danh sách thể loại phim từ backend
 * @returns {Promise<Array>}
 */
async function getGenres() {
  try {
    const response = await fetch(`${API_BASE}/api/genres`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.genres || [];
  } catch (error) {
    console.warn("[getGenres] Không lấy được thể loại:", error.message);
    return [];
  }
}

console.log("api.js: Đã kết nối với backend tại", API_BASE);
