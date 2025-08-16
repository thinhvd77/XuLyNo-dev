const { EntitySchema } = require('typeorm');

const UserPermission = new EntitySchema({
  name: 'UserPermission',
  tableName: 'user_permissions',
  columns: {
    userId: {
  primary: true,
      type: 'varchar',
      nullable: false,
    },
    permissionId: {
  primary: true,
      type: 'int',
      nullable: false,
    },
    created_at: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
    },
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: {
        name: 'userId',
        referencedColumnName: 'employee_code',
      },
      onDelete: 'CASCADE',
    },
    permission: {
      target: 'Permission',
      type: 'many-to-one',
      joinColumn: {
        name: 'permissionId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
  indices: [
    {
      name: 'IDX_USER_PERMISSION_UNIQUE',
      unique: true,
      columns: ['userId', 'permissionId'],
    },
  ],
});

module.exports = { UserPermission };
