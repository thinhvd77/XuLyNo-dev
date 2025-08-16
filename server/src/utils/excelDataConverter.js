const convertToNumber = (value) => {
  // BƯỚC 1: Xử lý các trường hợp đầu vào đơn giản và không hợp lệ
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined || typeof value !== 'string') {
    return 0;
  }

  let cleanString = value.trim();
  if (cleanString === '') {
    return 0;
  }

  // BƯỚC 2: "Dọn dẹp" chuỗi - Loại bỏ tất cả ký tự không phải là số, dấu phẩy, dấu chấm, hoặc dấu âm.
  // Ví dụ: "1.234.567,89 VND" -> "1.234.567,89"
  cleanString = cleanString.replace(/[^0-9,.-]/g, '');
  cleanString = cleanString.replace(/[,.]/g, '');

  // // BƯỚC 3: Xác định và chuẩn hóa dấu thập phân
  // const lastComma = cleanString.lastIndexOf(",");
  // const lastDot = cleanString.lastIndexOf(".");

  // // Logic: Ký tự phân tách (phẩy hoặc chấm) xuất hiện cuối cùng trong chuỗi
  // // có khả năng cao nhất là dấu thập phân.
  // if (lastComma > lastDot) {
  //     // Trường hợp kiểu Việt Nam/Châu Âu: "1.234.567,89"
  //     // - Loại bỏ tất cả dấu chấm (phân tách hàng ngàn).
  //     // - Thay thế dấu phẩy (thập phân) bằng dấu chấm.
  //     cleanString = cleanString.replace(/\./g, "").replace(",", ".");
  // } else if (lastDot > lastComma) {
  //     // Trường hợp kiểu Mỹ/Anh: "1,234,567.89"
  //     // - Chỉ cần loại bỏ tất cả dấu phẩy (phân tách hàng ngàn).
  //     cleanString = cleanString.replace(/,/g, "");
  // } else {
  //     // Trường hợp không có dấu thập phân rõ ràng (ví dụ: "1,234" hoặc "1.234")
  //     // - Loại bỏ tất cả các dấu phân tách.
  //     cleanString = cleanString.replace(/[,.]/g, "");
  // }

  // BƯỚC 4: Chuyển đổi chuỗi cuối cùng thành số
  const finalNumber = parseFloat(cleanString);

  // BƯỚC 5: Trả về kết quả an toàn
  // Nếu sau tất cả các bước, kết quả vẫn không phải là một số hợp lệ (NaN), trả về 0.
  return isNaN(finalNumber) ? 0 : finalNumber;
};

module.exports = {
  convertToNumber,
};
