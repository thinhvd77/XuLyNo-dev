const { EntitySchema } = require('typeorm');

const CaseDocument = new EntitySchema({
  name: 'CaseDocument',
  tableName: 'case_documents',
  columns: {
    document_id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
    },
    original_filename: {
      type: 'varchar',
      length: 500, // Increased length to support longer Vietnamese filenames
      nullable: false,
    },
    file_path: {
      type: 'text',
    },
    mime_type: {
      type: 'varchar',
    },
    file_size: {
      type: 'bigint',
    },
    document_type: {
      type: 'varchar',
    },
    uploaded_by_username: {
      type: 'varchar',
      nullable: true,
    },
    upload_date: {
      type: 'timestamptz',
      createDate: true,
    },
  },
  relations: {
    case: {
      type: 'many-to-one',
      target: 'DebtCase',
      joinColumn: {
        name: 'case_id',
        referencedColumnName: 'case_id',
      },
      onDelete: 'CASCADE', // Xóa tài liệu khi xóa trường hợp
    },
    uploader: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: {
        name: 'uploaded_by_username',
        referencedColumnName: 'username',
      },
      onDelete: 'SET NULL', // Giữ tài liệu khi xóa người dùng
    },
  },
});

module.exports = { CaseDocument };
