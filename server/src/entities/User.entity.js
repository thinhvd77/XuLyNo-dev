const { EntitySchema } = require('typeorm');

const User = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    employee_code: {
      primary: true,
      type: 'varchar',
    },
    username: {
      type: 'varchar',
      unique: true,
    },
    password: {
      type: 'varchar',
    },
    fullname: {
      type: 'varchar',
    },
    branch_code: {
      type: 'varchar',
    },
    dept: {
      type: 'varchar',
      length: 50,
    },
    role: {
      type: 'varchar',
      length: 50,
      default: 'employee',
    },
    status: {
      type: 'varchar',
      default: 'active',
    },
    created_at: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
    },
  },
  relations: {
    permissions: {
      target: 'Permission',
      type: 'many-to-many',
      joinTable: {
        name: 'user_permissions',
        joinColumn: {
          name: 'userId',
          referencedColumnName: 'employee_code',
        },
        inverseJoinColumn: {
          name: 'permissionId',
          referencedColumnName: 'id',
        },
      },
    },
    userPermissions: {
      target: 'UserPermission',
      type: 'one-to-many',
      inverseSide: 'user',
    },
  },
});

module.exports = { User };
