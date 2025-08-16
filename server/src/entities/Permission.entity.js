const { EntitySchema } = require('typeorm');

const Permission = new EntitySchema({
  name: 'Permission',
  tableName: 'permissions',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      unique: true,
      nullable: false,
    },
    description: {
      type: 'varchar',
      nullable: true,
    },
    created_at: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
    },
    updated_at: {
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
      onUpdate: 'CURRENT_TIMESTAMP',
    },
  },
  relations: {
    users: {
      target: 'User',
      type: 'many-to-many',
      mappedBy: 'permissions',
    },
    userPermissions: {
      target: 'UserPermission',
      type: 'one-to-many',
      inverseSide: 'permission',
    },
  },
});

module.exports = { Permission };
