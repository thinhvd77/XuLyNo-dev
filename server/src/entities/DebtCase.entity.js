const { EntitySchema } = require('typeorm');

const DebtCase = new EntitySchema({
  // Tên của entity, dùng trong TypeORM
  name: 'DebtCase',

  // Tên của bảng trong PostgreSQL
  tableName: 'debt_cases',

  // Định nghĩa các cột
  columns: {
    case_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid', // Tự động tạo UUID cho mỗi hồ sơ mới
    },
    customer_code: {
      type: 'varchar',
    },
    customer_name: {
      type: 'varchar',
    },
    // Nhóm nợ (debt group) – mới: lưu giá trị nhóm nợ (ví dụ 1..9). Chỉ hiển thị các hồ sơ thuộc nhóm 3,4,5.
    debt_group: {
      type: 'smallint',
      nullable: true, // Các bản ghi cũ sẽ có null cho tới khi re-import
    },
    outstanding_debt: {
      type: 'numeric',
      precision: 19,
      scale: 2, // Dùng để lưu trữ chính xác giá trị tiền tệ
    },
    state: {
      type: 'varchar',
      default: 'beingFollowedUp', // Trạng thái mặc định là "Đang đôn đốc"
    },
    case_type: {
      type: 'varchar',
    },
    created_date: {
      type: 'timestamptz',
      createDate: true, // TypeORM sẽ tự động gán ngày giờ tạo
    },
    last_modified_date: {
      type: 'timestamptz',
      updateDate: true, // TypeORM sẽ tự động cập nhật ngày giờ mỗi khi bản ghi thay đổi
    },
    assigned_employee_code: {
      type: 'varchar',
      length: 50,
      nullable: true, // Cho phép hồ sơ chưa được gán cho ai
    },
  },

  // Định nghĩa các mối quan hệ
  relations: {
    // Mối quan hệ Nhiều-Một với CreditOfficer
    officer: {
      target: 'User', // Tên của entity đích
      type: 'many-to-one',
      joinColumn: {
        name: 'assigned_employee_code', // Cột khóa ngoại trong bảng này
        referencedColumnName: 'employee_code',
      },
      onDelete: 'SET NULL', // Nếu cán bộ bị xóa, gán cho hồ sơ này là NULL
    },
  },
});

module.exports = { DebtCase };
