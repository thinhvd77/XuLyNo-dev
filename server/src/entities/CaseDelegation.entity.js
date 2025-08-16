const { EntitySchema } = require('typeorm');

const CaseDelegation = new EntitySchema({
  name: 'CaseDelegation',
  tableName: 'case_delegations',
  columns: {
    delegation_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
      nullable: false,
    },
    delegated_by_employee_code: {
      type: 'varchar',
      length: 50,
      nullable: false,
    },
    delegated_to_employee_code: {
      type: 'varchar',
      length: 50,
      nullable: false,
    },
    delegation_date: {
      type: 'timestamptz',
      createDate: true,
    },
    expiry_date: {
      type: 'timestamptz',
      nullable: false,
    },
    status: {
      type: 'varchar',
      length: 20,
      default: 'active',
    },
    notes: {
      type: 'text',
      nullable: true,
    },
  },
  relations: {
    case: {
      target: 'DebtCase',
      type: 'many-to-one',
      joinColumn: {
        name: 'case_id',
        referencedColumnName: 'case_id',
      },
      onDelete: 'CASCADE',
    },
    delegator: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: {
        name: 'delegated_by_employee_code',
        referencedColumnName: 'employee_code',
      },
      onDelete: 'RESTRICT',
    },
    delegatee: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: {
        name: 'delegated_to_employee_code',
        referencedColumnName: 'employee_code',
      },
      onDelete: 'RESTRICT',
    },
  },
});

module.exports = { CaseDelegation };
