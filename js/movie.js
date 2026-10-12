/**
 * js/movie.js
 * Logic dành riêng cho trang chi tiết phim (movie.html)
 */

document.addEventListener("DOMContentLoaded", function () {
  console.log("movie.js đã tải thành công trên movie.html!");

  const movieDetailContainer = document.getElementById("movie-detail");
  if (movieDetailContainer) {
    console.log("Tìm thấy khung hiển thị chi tiết phim (#movie-detail). Sẵn sàng để đổ dữ liệu ở bước tiếp theo!");
  }
});
