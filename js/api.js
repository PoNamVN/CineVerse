/**
 * js/api.js
 * Quản lý các hàm gọi OMDb API bằng fetch (async/await)
 */

// 1. Cấu hình API Key và đường dẫn cơ sở
// Bạn có thể đăng ký key miễn phí tại: https://www.omdbapi.com/apikey.aspx
// Ở đây dùng key test sẵn có 'trilogy' để bạn có thể chạy thử ngay lập tức!
const OMDB_API_KEY = "trilogy";
const OMDB_BASE_URL = "https://www.omdbapi.com/";

/**
 * 1. Hàm tìm kiếm danh sách phim theo từ khóa
 * @param {string} keyword - Từ khóa tên phim (ví dụ: "batman", "avatar")
 * @returns {Promise<Array>} - Mảng danh sách các phim tìm thấy hoặc [] nếu có lỗi
 */
async function searchMovies(keyword) {
  // Kiểm tra nếu từ khóa rỗng hoặc chỉ có khoảng trắng
  if (!keyword || keyword.trim() === "") {
    console.warn("Vui lòng nhập từ khóa tìm kiếm!");
    return [];
  }

  const url = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(keyword.trim())}&type=movie`;

  try {
    const response = await fetch(url);

    // Kiểm tra mã phản hồi HTTP (ví dụ: 404, 500)
    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (Mã lỗi HTTP: ${response.status})`);
    }

    const data = await response.json();

    // OMDb trả về Response: "True" khi thành công, hoặc "False" khi có lỗi logic (không thấy phim, v.v.)
    if (data.Response === "True") {
      console.log(`Tìm thấy ${data.Search.length} phim cho từ khóa "${keyword}":`, data.Search);
      return data.Search;
    } else {
      console.warn(`Không tìm thấy phim: ${data.Error}`);
      return [];
    }
  } catch (error) {
    // Xử lý lỗi mất mạng (offline), URL sai hoặc lỗi mạng đột ngột
    console.error("Lỗi khi gọi API tìm kiếm phim (kiểm tra kết nối mạng của bạn):", error.message);
    return [];
  }
}

/**
 * 2. Hàm lấy chi tiết một bộ phim theo imdbID
 * @param {string} imdbID - Mã định danh phim trên IMDb (ví dụ: "tt0372784")
 * @returns {Promise<Object|null>} - Đối tượng chi tiết phim hoặc null nếu lỗi
 */
async function getMovieDetail(imdbID) {
  if (!imdbID || imdbID.trim() === "") {
    console.warn("Vui lòng cung cấp mã imdbID hợp lệ!");
    return null;
  }

  // plot=full để lấy toàn bộ nội dung tóm tắt cốt truyện đầy đủ
  const url = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(imdbID.trim())}&plot=full`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (Mã lỗi HTTP: ${response.status})`);
    }

    const data = await response.json();

    if (data.Response === "True") {
      console.log(`Lấy chi tiết phim "${data.Title}" thành công:`, data);
      return data;
    } else {
      console.warn(`Không thể lấy chi tiết phim: ${data.Error}`);
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi gọi API chi tiết phim (kiểm tra kết nối mạng của bạn):", error.message);
    return null;
  }
}

console.log("api.js: Đã nạp thành công 2 hàm searchMovies() và getMovieDetail().");
