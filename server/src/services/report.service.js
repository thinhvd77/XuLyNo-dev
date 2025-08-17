const AppDataSource = require('../config/dataSource');
const { normalizeStatus, normalizeCaseType } = require('../constants/caseConstants');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const permissionService = require('./permission.service');

/**
 * Build the base query for report data
 * @param {Object} filters - Filter parameters
 * @param {Object} user - Authenticated user for scoping
 * @returns {QueryBuilder} TypeORM query builder
 */
async function buildReportQuery(filters, user) {
  const { status, caseType, branch, department, employeeCode, startDate, endDate } = filters;

  const caseRepository = AppDataSource.getRepository('DebtCase');

  let query = caseRepository
    .createQueryBuilder('debt_cases')
    .leftJoin('User', 'user', 'user.employee_code = debt_cases.assigned_employee_code')
    // Limit to required debt groups 3,4,5
    .andWhere('debt_cases.debt_group IN (:...allowedGroups)', { allowedGroups: [3, 4, 5] })
    // Latest public note (non-private) subquery to identify latest note date per case
    .leftJoin(
      (qb) => {
        return qb
          .select('cn.case_id', 'case_id')
          .addSelect('MAX(cn.created_date)', 'latest_note_date')
          .from('case_notes', 'cn')
          .where('cn.is_private = FALSE')
          .groupBy('cn.case_id');
      },
      'latest_notes',
      'latest_notes.case_id = debt_cases.case_id',
    )
    // Join ALL public notes that occur on the same DATE as the latest public note date
    // (i.e., collect every public note created on that latest calendar day)
    .leftJoin(
      'case_notes',
      'case_note_all',
      'case_note_all.case_id = debt_cases.case_id AND case_note_all.is_private = FALSE AND DATE(case_note_all.created_date) = DATE(latest_notes.latest_note_date)',
    )
    .select([
      'debt_cases.case_id AS case_id',
      'debt_cases.customer_code AS customer_code',
      'debt_cases.customer_name AS customer_name',
      'debt_cases.state AS state_raw',
      'debt_cases.outstanding_debt AS outstanding_debt',
      'debt_cases.case_type AS case_type_raw',
      'debt_cases.assigned_employee_code AS assigned_employee_code',
      'user.branch_code AS branch_code',
      'user.dept AS dept',
      // Use latest public note date (if any) instead of original case created date
      'latest_notes.latest_note_date AS created_date',
      'user.fullname AS officer_fullname',
      // Concatenate all note contents for that latest date separated by line breaks, prefixing each with its created datetime
      "COALESCE(string_agg(TO_CHAR(case_note_all.created_date, 'DD/MM/YYYY HH24:MI') || ' - ' || case_note_all.note_content, E'\n' ORDER BY case_note_all.created_date ASC), NULL) AS last_public_note_content",
    ]);

  // Because we use an aggregate (string_agg) we must GROUP BY all non-aggregated selected columns
  query = query
    .groupBy('debt_cases.case_id')
    .addGroupBy('debt_cases.customer_code')
    .addGroupBy('debt_cases.customer_name')
    .addGroupBy('debt_cases.state')
    .addGroupBy('debt_cases.outstanding_debt')
    .addGroupBy('debt_cases.case_type')
    .addGroupBy('debt_cases.assigned_employee_code')
    .addGroupBy('user.branch_code')
    .addGroupBy('user.dept')
    .addGroupBy('debt_cases.created_date')
    .addGroupBy('user.fullname')
    .addGroupBy('latest_notes.latest_note_date');

  // Apply filters
  if (status) {
    query = query.andWhere('debt_cases.state = :status', { status });
  }

  if (caseType) {
    query = query.andWhere('debt_cases.case_type = :caseType', { caseType });
  }

  if (branch) {
    query = query.andWhere('user.branch_code = :branch', { branch });
  }

  if (department) {
    query = query.andWhere('user.dept = :department', { department });
  }

  if (employeeCode) {
    query = query.andWhere('debt_cases.assigned_employee_code = :employeeCode', { employeeCode });
  }

  // Since case updates removed from report, apply date filters on case creation date instead
  if (startDate) {
    query = query.andWhere('debt_cases.created_date >= :startDate', { startDate });
  }

  if (endDate) {
    query = query.andWhere('debt_cases.created_date <= :endDate', { endDate });
  }

  // Apply dynamic data scope based on user permissions
  if (user) {
    // Get user permissions from database
    const userPermissions = await permissionService.getUserPermissions(user);
    
    // Default-full-access departments
    const deptDefault = ['KH&QLRR', 'KH&XLRR'];
    const hasDefaultAccess = user.role === 'administrator' || deptDefault.includes(user.dept) || user.dept === 'KTGSNB';

    if (!hasDefaultAccess) {
      // Check permissions first, then fall back to role-based logic
      if (userPermissions.export_all_data || userPermissions.view_all_cases) {
        // Has permission to export/view all data - no additional filters needed
      } else if (userPermissions.export_department_data || userPermissions.view_department_cases) {
        // Has permission to export/view department data
        query = query.andWhere('user.dept = :scopeDept', { scopeDept: user.dept });
        
        // Note: Do NOT add branch filter for department permission
        // Users with department permission should see all cases in their department regardless of branch
      } else if (userPermissions.export_case_data || userPermissions.view_own_cases) {
        // Has permission to export/view own cases only
        query = query.andWhere('debt_cases.assigned_employee_code = :scopeEmployee', {
          scopeEmployee: user.employee_code,
        });
      } else {
        // Fall back to role-based logic for backward compatibility
        const isManager = user.role === 'manager';
        const isDeputyManager = user.role === 'deputy_manager';

        if (isManager && user.dept === 'KHDN') {
          // Manager in KHDN: full access
        } else if (isManager || isDeputyManager) {
          // All other managers/deputies: department scope
          query = query.andWhere('user.dept = :scopeDept', { scopeDept: user.dept });
        } else {
          // Default: own records only
          query = query.andWhere('debt_cases.assigned_employee_code = :scopeEmployee', {
            scopeEmployee: user.employee_code,
          });
        }
      }
    }
  }

  return query.orderBy('debt_cases.customer_code', 'ASC');
}

/**
 * Get report data with filters applied
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Array>} Raw report data
 */
async function getReportData(filters, user) {
  try {
    const query = await buildReportQuery(filters, user);
    const reportData = await query.getRawMany();

    // Transform data to Vietnamese
    const processedData = reportData.map((item) => ({
      customer_code: item.customer_code,
      customer_name: item.customer_name,
      state: normalizeStatus(item.state_raw),
      case_type: normalizeCaseType(item.case_type_raw),
      outstanding_debt: item.outstanding_debt,
      assigned_employee_code: item.assigned_employee_code,
      branch_code: item.branch_code,
      dept: item.dept,
      created_date: item.created_date,
      officer_fullname: item.officer_fullname,
      last_public_note_content: item.last_public_note_content || null,
    }));

    return processedData;
  } catch (error) {
    throw new Error(`Failed to get report data: ${error.message}`);
  }
}

/**
 * Generate summary report Excel file (same structure previously built in controller)
 * Moves file creation logic out of controller for cleaner separation of concerns.
 * @param {Object} filters
 * @returns {Promise<{ filePath: string, fileName: string, rowCount: number }>}
 */
async function generateSummaryReportFile(filters, user) {
  const reportData = await getReportData(filters, user); // already normalized

  const workbook = XLSX.utils.book_new();
  const excelData = reportData.map((item, index) => ({
    STT: index + 1,
    'Mã KH': item.customer_code,
    'Tên KH': item.customer_name,
    'Trạng thái khoản vay': item.state,
    'Dư nợ': item.outstanding_debt
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
          item.outstanding_debt,
        )
      : '',
    'Loại Case': item.case_type,
    'Chi nhánh': item.branch_code,
    'Phòng ban': item.dept,
    CBTD: item.officer_fullname || '',
    'Mã CBTD': item.assigned_employee_code,
    'Ghi chú mới nhất': item.last_public_note_content || '',
    'Ngày cập nhật mới nhất': item.created_date
      ? new Date(item.created_date).toLocaleDateString('vi-VN')
      : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  worksheet['!cols'] = [
    { wch: 5 }, // STT
    { wch: 15 }, // Mã KH
    { wch: 25 }, // Tên KH
    { wch: 22 }, // Trạng thái
    { wch: 18 }, // Dư nợ
    { wch: 14 }, // Loại Case
    { wch: 12 }, // Chi nhánh
    { wch: 14 }, // Phòng ban
    { wch: 25 }, // CBTD
    { wch: 15 }, // Mã CBTD
    { wch: 45 }, // Ghi chú công khai mới nhất
    { wch: 15 }, // Ngày tạo case
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao cao');

  // Ensure uploads directory exists
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fileName = `BaoCao_TongHop_${timestamp}.xlsx`;
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, fileName);
  XLSX.writeFile(workbook, filePath);

  return { filePath, fileName, rowCount: excelData.length };
}

/**
 * Get filter options for report
 * @param {Object} user - User object for scoping
 * @returns {Promise<Object>} Available filter options
 */
async function getFilterOptions(user) {
  try {
    // Get status options from case constants
    const { getStatusOptions } = require('../constants/caseConstants');
    const statuses = getStatusOptions();
    
    // Get branches
    const userRepository = AppDataSource.getRepository('User');
    const branchQuery = userRepository.createQueryBuilder('user')
      .select('DISTINCT user.branch_code', 'branch_code')
      .addSelect('user.branch_code', 'label')
      .where('user.branch_code IS NOT NULL')
      .orderBy('user.branch_code');
    
    const branchResults = await branchQuery.getRawMany();
    const branches = branchResults.map(b => ({
      value: b.branch_code,
      label: b.branch_code
    }));
    
    // Get departments
    const deptQuery = userRepository.createQueryBuilder('user')
      .select('DISTINCT user.dept', 'dept')
      .addSelect('user.dept', 'label')
      .where('user.dept IS NOT NULL')
      .orderBy('user.dept');
    
    const deptResults = await deptQuery.getRawMany();
    const departments = deptResults.map(d => ({
      value: d.dept,
      label: d.dept
    }));
    
    // Get employees (scoped by user permissions)
    let employeeQuery = userRepository.createQueryBuilder('user')
      .select(['user.employee_code', 'user.fullname'])
      .where('user.employee_code IS NOT NULL')
      .orderBy('user.fullname');
    
    // Apply user-based scoping if needed
    const userPermissions = await require('./permission.service').getUserPermissions(user);
    if (!userPermissions.view_all_cases && !userPermissions.view_department_cases) {
      // Only show own cases for regular employees
      employeeQuery.andWhere('user.employee_code = :employeeCode', { 
        employeeCode: user.employee_code 
      });
    } else if (userPermissions.view_department_cases && !userPermissions.view_all_cases) {
      // Show department employees for managers
      employeeQuery.andWhere('user.dept = :dept', { dept: user.dept });
    }
    
    const employeeResults = await employeeQuery.getMany();
    const employees = employeeResults.map(e => ({
      value: e.employee_code,
      label: `${e.fullname} (${e.employee_code})`
    }));
    
    return {
      statuses,
      branches,
      departments,
      employees
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      statuses: [],
      branches: [],
      departments: [],
      employees: []
    };
  }
}

/**
 * Get employees by branch
 * @param {string} branch - Branch code
 * @param {Object} user - User object for scoping
 * @returns {Promise<Array>} List of employees
 */
async function getEmployeesByBranch(branch, user) {
  if (!branch) return [];
  
  const userRepository = AppDataSource.getRepository('User');
  const employees = await userRepository.find({
    where: { branch_code: branch },
    select: ['employee_code', 'fullname']
  });
  
  return employees;
}

/**
 * Generate latest date report
 * @param {Object} filters - Filter parameters
 * @param {Object} user - User object for scoping
 * @returns {Promise<Object>} File path and name
 */
async function generateLatestDateReport(filters, user) {
  // Basic implementation - generate a simple report
  const reportData = await getReportData(filters, user);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportData);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  const fileName = `latest_date_report_${Date.now()}.xlsx`;
  const filePath = path.join(__dirname, '../../uploads', fileName);
  
  // Ensure uploads directory exists
  const uploadsDir = path.dirname(filePath);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  XLSX.writeFile(wb, filePath);
  
  return { filePath, fileName };
}

module.exports = {
  buildReportQuery,
  getReportData,
  generateSummaryReportFile,
  getFilterOptions,
  getEmployeesByBranch,
  generateLatestDateReport,
};