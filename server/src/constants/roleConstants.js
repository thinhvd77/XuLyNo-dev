/**
 * User role constants
 */
const ROLES = {
  EMPLOYEE: 'employee',
  DEPUTY_MANAGER: 'deputy_manager',
  MANAGER: 'manager',
  DEPUTY_DIRECTOR: 'deputy_director',
  DIRECTOR: 'director',
  ADMINISTRATOR: 'administrator',
};

// Array of all roles for validation
const ALL_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  ALL_ROLES,
};
