// Test file để kiểm tra thông báo lỗi
const { ValidationError } = require('./src/middleware/errorHandler');

console.log('Testing error messages...');

// Test các loại lỗi khác nhau
const testErrors = [
  new ValidationError('File Excel trống hoặc bị hỏng. Vui lòng kiểm tra lại file gốc'),
  new ValidationError('Định dạng file không được hỗ trợ. Vui lòng tải lên file Excel (.xls hoặc .xlsx)'),
  new ValidationError('Sai mẫu file Import nội bảng. Thiếu cột: AQCCDFIN, brcd. Vui lòng sử dụng đúng mẫu Import nội bảng với các cột: AQCCDFIN, brcd, dsbsbal, ofcno, custnm.'),
  new ValidationError('Không thể đọc file Excel. File có thể bị hỏng hoặc có định dạng không đúng. Vui lòng kiểm tra lại file gốc.'),
  new ValidationError('File Excel không chứa sheet nào. Vui lòng kiểm tra lại file.'),
  new ValidationError('Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng. Vui lòng kiểm tra lại file.'),
  new ValidationError('File Excel không chứa dữ liệu hoặc định dạng không đúng. Vui lòng kiểm tra lại file.'),
];

testErrors.forEach((error, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  console.log('Error type:', error.constructor.name);
  console.log('Status code:', error.statusCode);
  console.log('Message:', error.message);
  console.log('Is operational:', error.isOperational);
});

console.log('\n✅ Error message tests completed!');
