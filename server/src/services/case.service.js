const AppDataSource = require('../config/dataSource');
const xlsx = require('xlsx');
const { Not } = require('typeorm');
const fs = require('fs');
const path = require('path');
const { getRelativeFilePath, getAbsoluteFilePath } = require('../utils/filePathHelper');
const logger = require('../config/logger');
const caseActivityService = require('./caseActivity.service');
const caseNoteService = require('./caseNote.service');
const { DELEGATION_STATUS } = require('../constants/delegationConstants');
const { convertToNumber } = require('../utils/excelDataConverter');
const { ValidationError } = require('../middleware/errorHandler');

// Expected Excel column headers for different import templates
const INTERNAL_EXPECTED_HEADERS = ['AQCCDFIN', 'brcd', 'dsbsbal', 'ofcno', 'custnm'];
const EXTERNAL_EXPECTED_HEADERS = ['makh', 'Ngoaibang', 'cbtd', 'TenKhachHang'];

// Helper: collect union of keys from the first N rows to avoid empty-first-row issues
function collectHeaders(rows, sampleSize = 10) {
  const headerSet = new Set();
  const len = Math.min(sampleSize, Array.isArray(rows) ? rows.length : 0);
  for (let i = 0; i < len; i++) {
    const row = rows[i];
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => headerSet.add(k));
    }
  }
  return Array.from(headerSet);
}

// Helper: validate that all expected headers exist
function validateHeaders(actualHeaders, expectedHeaders) {
  const actual = new Set(actualHeaders);
  const missing = expectedHeaders.filter((h) => !actual.has(h));
  return { ok: missing.length === 0, missing };
}

// Helper: throw a 400 Validation error with a clear message
function throwBadRequest(message) {
  throw new ValidationError(message);
}

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importCasesFromExcel = async (fileBuffer) => {
  let workbook = null;
  let data = [];

  try {
    // Validate input buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new ValidationError('File Excel trống hoặc bị hỏng. Vui lòng kiểm tra lại file gốc');
    }

    // Check if buffer has Excel file signature
    const excelSignatures = [
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), // .xls signature (OLE2)
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // .xlsx signature (ZIP)
      Buffer.from([0x50, 0x4b, 0x07, 0x08]), // Alternative .xlsx signature
    ];

    const hasValidSignature = excelSignatures.some((signature) =>
      fileBuffer.subarray(0, signature.length).equals(signature),
    );

    if (!hasValidSignature) {
      throw new ValidationError(
        'File không phải là file Excel hợp lệ. Vui lòng kiểm tra lại định dạng file và đảm bảo file không bị hỏng.',
      );
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');

    // 1. Đọc dữ liệu từ file Excel with enhanced error handling
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      logger.error('Failed to parse Excel file:', error);
      throw new ValidationError('Không thể đọc file Excel. File có thể bị hỏng hoặc có định dạng không đúng. Vui lòng kiểm tra lại file gốc.');
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new ValidationError('File Excel không chứa sheet nào. Vui lòng kiểm tra lại file.');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new ValidationError('Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng. Vui lòng kiểm tra lại file.');
    }

    try {
      data = xlsx.utils.sheet_to_json(worksheet);
    } catch (error) {
      logger.error('Failed to convert sheet to JSON:', error);
      throw new ValidationError('Không thể đọc dữ liệu từ file Excel. File có thể bị hỏng hoặc có cấu trúc không đúng.');
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError('File Excel không chứa dữ liệu hoặc định dạng không đúng. Vui lòng kiểm tra lại file.');
    }

    // Validate template headers for INTERNAL import
    const actualHeaders = collectHeaders(data);
    const internalCheck = validateHeaders(actualHeaders, INTERNAL_EXPECTED_HEADERS);
    if (!internalCheck.ok) {
      // Try to detect if user selected EXTERNAL template by mistake
      const looksLikeExternal = validateHeaders(actualHeaders, EXTERNAL_EXPECTED_HEADERS).missing.length < EXTERNAL_EXPECTED_HEADERS.length;
      const hint = looksLikeExternal
        ? 'Có vẻ bạn đang dùng mẫu Ngoại bảng. Vui lòng chọn đúng chức năng "Import ngoại bảng".'
        : 'Vui lòng sử dụng đúng mẫu Import nội bảng với các cột: AQCCDFIN, brcd, dsbsbal, ofcno, custnm.';
      throwBadRequest(
        `Sai mẫu file Import nội bảng. Thiếu cột: ${internalCheck.missing.join(', ')}. ${hint}`,
      );
    }

    // Ghi nhận mọi nhóm nợ khi import, chỉ lọc hiển thị ở tầng truy vấn
    const customerDebtMap = new Map();

    // 2. Lọc và tổng hợp dữ liệu vào Map with error handling
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const debtGroupString = row.AQCCDFIN;

        // **THAY ĐỔI Ở ĐÂY: Logic trích xuất số từ chuỗi**
        let debtGroupNumber = 0;
        if (typeof debtGroupString === 'string') {
          const match = debtGroupString.match(/\d+/); // Tìm một hoặc nhiều chữ số
          if (match) {
            debtGroupNumber = parseInt(match[0], 10);
          }
        } else if (typeof debtGroupString === 'number') {
          debtGroupNumber = debtGroupString;
        }

        // Lưu nhóm nợ dù không thuộc 3/4/5 để đáp ứng yêu cầu "import all"

        const customerCode = row.brcd;
        const outstandingDebt = Number(row.dsbsbal) || 0;
        const employeeCode = row.ofcno; // **THAY ĐỔI Ở ĐÂY: Dùng cột 'ofcno'**
        const customerName = row.custnm;

        if (!customerCode) {
          logger.warn(`Row ${i + 1}: Missing customer code, skipping`);
          continue;
        }

        if (customerDebtMap.has(customerCode)) {
          const currentData = customerDebtMap.get(customerCode);
          currentData.outstanding_debt += outstandingDebt;
          // Cập nhật CBTD nếu cần, hoặc giữ người đầu tiên tìm thấy
          currentData.outstanding_debt += outstandingDebt;
          // Cập nhật nhóm nợ nếu thay đổi (ưu tiên giá trị mới nhất)
          currentData.debt_group = debtGroupNumber || currentData.debt_group;
          customerDebtMap.set(customerCode, currentData);
        } else {
          customerDebtMap.set(customerCode, {
            customer_code: customerCode,
            customer_name: customerName,
            outstanding_debt: outstandingDebt,
            assigned_employee_code: employeeCode,
            case_type: 'internal',
            debt_group: debtGroupNumber || null,
          });
        }
      } catch (rowError) {
        logger.warn(`Error processing row ${i + 1}:`, rowError.message);
        // Continue processing other rows
        continue;
      }
    }

    // 3. Chuyển Map thành mảng để xử lý
    const aggregatedData = Array.from(customerDebtMap.values());

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 4. Lặp qua dữ liệu đã tổng hợp và cập nhật CSDL
    for (let i = 0; i < aggregatedData.length; i++) {
      const customer = aggregatedData[i];
      try {
        if (
          !customer.customer_code ||
          !customer.customer_name ||
          !customer.assigned_employee_code
        ) {
          const errorMsg = `Khách hàng với mã ${customer.customer_code} bị thiếu thông tin Tên hoặc CBTD.`;
          errors.push(errorMsg);
          logger.warn(errorMsg);
          continue;
        }

        const existingCase = await caseRepository.findOneBy({
          customer_code: customer.customer_code,
          case_type: 'internal', // **THAY ĐỔI Ở ĐÂY**
        });

        if (existingCase) {
          existingCase.outstanding_debt = customer.outstanding_debt;
          existingCase.assigned_employee_code = customer.assigned_employee_code;
          existingCase.debt_group = customer.debt_group; // cập nhật nhóm nợ sau re-import
          await caseRepository.save(existingCase);
          updatedCount++;
        } else {
          const newCase = caseRepository.create(customer);
          await caseRepository.save(newCase);
          createdCount++;
        }
      } catch (error) {
        const errorMsg = `Lỗi xử lý khách hàng ${customer.customer_code}: ${error.message}`;
        errors.push(errorMsg);
        logger.error(`Database error for customer ${customer.customer_code}:`, error);
      }
    }

    // 5. Trả về kết quả
    const result = {
      totalRowsInFile: data.length,
      processedCustomers: aggregatedData.length,
      created: createdCount,
      updated: updatedCount,
      errors,
    };

    logger.info('Excel import completed:', result);
    return result;
  } catch (error) {
    logger.error('Fatal error in importCasesFromExcel:', error);
    throw error;
  }
};

/**
 * MỚI: Tìm tất cả hồ sơ được phân công cho một nhân viên cụ thể
 */
exports.findCasesByEmployeeCode = async (employeeCode) => {
  try {
    if (!employeeCode) {
      throw new ValidationError('Mã nhân viên là bắt buộc');
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');
    const qb = caseRepository
      .createQueryBuilder('debt_cases')
      .leftJoinAndSelect('debt_cases.officer', 'officer')
      .leftJoin(
        (qb) =>
          qb
            .select('cn.case_id', 'ln_case_id')
            .addSelect('MAX(cn.created_date)', 'latest_note_date')
            .from('case_notes', 'cn')
            .groupBy('cn.case_id'),
        'latest_note',
        'latest_note.ln_case_id = debt_cases.case_id',
      )
      .addSelect('latest_note.latest_note_date', 'latest_note_date')
      .where('debt_cases.assigned_employee_code = :employeeCode', { employeeCode })
      .andWhere('(debt_cases.debt_group IN (:...allowedGroups))', { allowedGroups: [3, 4, 5] })
      .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
      .addOrderBy('debt_cases.last_modified_date', 'DESC');

    const rawAndEntities = await qb.getRawAndEntities();
    const { entities, raw } = rawAndEntities;
    const mappedCases = entities.map((entity, idx) => ({
      ...entity,
      latest_activity_date: raw[idx].latest_note_date || entity.last_modified_date,
    }));
    logger.info(`Found ${mappedCases.length} cases for employee ${employeeCode}`);
    return mappedCases;
  } catch (error) {
    logger.error(`Error finding cases for employee ${employeeCode}:`, error);
    throw error;
  }
};

/**
 * NEW: Tìm hồ sơ của nhân viên với phân trang và bộ lọc (giống như findDepartmentCases)
 */
exports.findMyCases = async (employeeCode, page = 1, filters = {}, limit = 20, sorting = {}) => {
  try {
    if (!employeeCode) {
      throw new ValidationError('Mã nhân viên là bắt buộc');
    }

    if (page < 1) {
      throw new ValidationError('Số trang phải lớn hơn 0');
    }

    if (limit < 1 || limit > 1000) {
      throw new ValidationError('Giới hạn phải từ 1 đến 1000');
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');
    const offset = (page - 1) * limit;

    // Tạo query builder với join officer và delegations
    let queryBuilder = caseRepository
      .createQueryBuilder('debt_cases')
      .leftJoinAndSelect('debt_cases.officer', 'officer')
      .leftJoin(
        'case_delegations',
        'delegation',
        'delegation.case_id = debt_cases.case_id AND delegation.status = :activeStatus AND delegation.expiry_date > NOW()',
        { activeStatus: DELEGATION_STATUS.ACTIVE },
      );

    // Bộ lọc cơ bản: hiển thị cases được gán cho nhân viên này HOẶC được ủy quyền cho họ
    queryBuilder = queryBuilder.andWhere(
      '(debt_cases.assigned_employee_code = :employeeCode OR delegation.delegated_to_employee_code = :employeeCode)',
      { employeeCode },
    );

    // Chỉ hiển thị nhóm nợ 3,4,5 nếu đã có debt_group (NULL coi như không hiển thị)
    queryBuilder = queryBuilder.andWhere('(debt_cases.debt_group IN (:...allowedGroups))', {
      allowedGroups: [3, 4, 5],
    });

    // Áp dụng bộ lọc tìm kiếm with sanitization
    if (filters.search && typeof filters.search === 'string') {
      const sanitizedSearch = filters.search.trim().substring(0, 100); // Limit search length
      queryBuilder = queryBuilder.andWhere(
        '(debt_cases.customer_name ILIKE :search OR debt_cases.case_id ILIKE :search OR debt_cases.customer_code ILIKE :search)',
        { search: `%${sanitizedSearch}%` },
      );
    }

    if (filters.type && typeof filters.type === 'string') {
      queryBuilder = queryBuilder.andWhere('debt_cases.case_type = :type', { type: filters.type });
    }

    if (filters.status && typeof filters.status === 'string') {
      queryBuilder = queryBuilder.andWhere('debt_cases.state = :status', {
        status: filters.status,
      });
    }

    // Derive latest note date via subquery for sorting priority (latest note drives recency)
    queryBuilder = queryBuilder
      .leftJoin(
        (qb) =>
          qb
            .select('cn.case_id', 'note_case_id')
            .addSelect('MAX(cn.created_date)', 'latest_note_date')
            .from('case_notes', 'cn')
            .groupBy('cn.case_id'),
        'latest_note',
        'latest_note.note_case_id = debt_cases.case_id',
      )
      .addSelect('latest_note.latest_note_date', 'latest_note_date');

    // Áp dụng sorting with validation
    if (sorting.sortBy && sorting.sortOrder) {
      let orderByField;
      let orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      switch (sorting.sortBy) {
        case 'case_id':
          orderByField = 'debt_cases.case_id';
          break;
        case 'customer_code':
          orderByField = 'debt_cases.customer_code';
          break;
        case 'customer_name':
          orderByField = 'debt_cases.customer_name';
          break;
        case 'outstanding_debt':
          orderByField = 'debt_cases.outstanding_debt';
          break;
        case 'case_type':
          orderByField = 'debt_cases.case_type';
          break;
        case 'state':
          orderByField = 'debt_cases.state';
          break;
        case 'last_modified_date':
          orderByField = 'debt_cases.last_modified_date';
          break;
        default:
          orderByField = 'debt_cases.last_modified_date';
          orderDirection = 'DESC';
      }

      if (orderByField === 'debt_cases.last_modified_date') {
        // When defaulting to last_modified_date, still prioritize latest note if exists
        queryBuilder = queryBuilder
          .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
          .addOrderBy(orderByField, orderDirection);
      } else {
        queryBuilder = queryBuilder
          .orderBy(orderByField, orderDirection)
          .addOrderBy('latest_note_date', 'DESC', 'NULLS LAST');
      }
    } else {
      // Default sorting: newest note first, fallback to last_modified_date
      queryBuilder = queryBuilder
        .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
        .addOrderBy('debt_cases.last_modified_date', 'DESC');
    }

    // Execute query with error handling
    let cases, totalCount;
    try {
      const [rawAndEntities, count] = await Promise.all([
        queryBuilder.skip(offset).take(limit).getRawAndEntities(),
        queryBuilder.getCount(),
      ]);
      const { entities, raw } = rawAndEntities;
      cases = entities.map((e, i) => ({
        ...e,
        latest_activity_date: raw[i].latest_note_date || e.last_modified_date,
      }));
      totalCount = count;
    } catch (dbError) {
      logger.error('Database query error in findMyCases:', dbError);
      throw new ValidationError('Không thể truy xuất dữ liệu từ cơ sở dữ liệu');
    }

    const result = {
      cases,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };

    logger.info(`Found ${cases.length} cases for employee ${employeeCode} (page ${page})`, {
      totalCount,
      assignedCases: cases.filter((c) => c.assigned_employee_code === employeeCode).length,
      delegatedCases: cases.filter((c) => c.assigned_employee_code !== employeeCode).length,
    });
    return result;
  } catch (error) {
    logger.error(`Error in findMyCases for employee ${employeeCode}:`, error);
    throw error;
  }
};

/**
 * MỚI: Tìm tất cả hồ sơ với phân trang và bộ lọc (dành cho Ban Giám Đốc)
 */
exports.findAllCases = async (
  page = 1,
  filters = {},
  limit = 20,
  sorting = {},
  directorBranchCode = null,
) => {
  try {
    // Input validation
    if (page < 1) {
      throw new Error('Page must be greater than 0');
    }

    if (limit < 1 || limit > 1000) {
      throw new Error('Limit must be between 1 and 1000');
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');

    // Tạo query builder
    let queryBuilder = caseRepository
      .createQueryBuilder('debt_cases')
      .leftJoinAndSelect('debt_cases.officer', 'officer');

    // Filter allowed debt groups 3,4,5
    queryBuilder.andWhere('debt_cases.debt_group IN (:...allowedGroups)', {
      allowedGroups: [3, 4, 5],
    });

    // Director-level branch filtering logic
    if (directorBranchCode && directorBranchCode !== '6421') {
      // For directors not from branch '6421', filter cases by customer_code prefix
      queryBuilder.andWhere('LEFT(debt_cases.customer_code, 4) = :directorBranchCode', {
        directorBranchCode,
      });
      logger.info(`Applied branch filtering for director: ${directorBranchCode}`);
    } else if (directorBranchCode === '6421') {
      // Branch '6421' directors can see all cases - no additional filtering
      logger.info('Director from branch 6421 - showing all cases');
    }

    // Apply additional filters with validation
    if (filters.search && typeof filters.search === 'string') {
      const sanitizedSearch = filters.search.trim().substring(0, 100);
      queryBuilder.andWhere(
        '(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)',
        { search: `%${sanitizedSearch}%` },
      );
    }

    if (filters.type && typeof filters.type === 'string') {
      queryBuilder.andWhere('debt_cases.case_type = :type', { type: filters.type });
    }

    if (filters.status && typeof filters.status === 'string') {
      queryBuilder.andWhere('debt_cases.state = :status', { status: filters.status });
    }

    if (filters.branch_code && typeof filters.branch_code === 'string') {
      queryBuilder.andWhere('officer.branch_code = :branch_code', {
        branch_code: filters.branch_code,
      });
    }

    if (filters.department_code && typeof filters.department_code === 'string') {
      queryBuilder.andWhere('officer.dept = :department_code', {
        department_code: filters.department_code,
      });
    }

    if (filters.employee_code && typeof filters.employee_code === 'string') {
      queryBuilder.andWhere('officer.employee_code = :employee_code', {
        employee_code: filters.employee_code,
      });
    }

    // Join latest note for ordering priority (newest note date)
    queryBuilder = queryBuilder
      .leftJoin(
        (qb) =>
          qb
            .select('cn.case_id', 'note_case_id')
            .addSelect('MAX(cn.created_date)', 'latest_note_date')
            .from('case_notes', 'cn')
            .groupBy('cn.case_id'),
        'latest_note',
        'latest_note.note_case_id = debt_cases.case_id',
      )
      .addSelect('latest_note.latest_note_date', 'latest_note_date');

    // Apply sorting with validation
    if (sorting.sortBy && sorting.sortOrder) {
      const orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const sortMap = {
        customer_code: 'debt_cases.customer_code',
        customer_name: 'debt_cases.customer_name',
        outstanding_debt: 'debt_cases.outstanding_debt',
        case_type: 'debt_cases.case_type',
        state: 'debt_cases.state',
        created_date: 'debt_cases.created_date',
        officer: 'officer.fullname',
      };

      const orderByField = sortMap[sorting.sortBy] || 'debt_cases.last_modified_date';
      if (orderByField === 'debt_cases.last_modified_date') {
        queryBuilder
          .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
          .addOrderBy(orderByField, orderDirection);
      } else {
        queryBuilder
          .orderBy(orderByField, orderDirection)
          .addOrderBy('latest_note_date', 'DESC', 'NULLS LAST');
      }
    } else {
      // Default sorting: newest note first then last_modified
      queryBuilder
        .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
        .addOrderBy('debt_cases.last_modified_date', 'DESC');
    }

    // Execute queries with error handling
    const offset = (page - 1) * limit;
    let cases, totalCases;

    // Log applied filters for debugging
    const appliedFilters = Object.entries(filters)
      .filter(([key, value]) => value && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    logger.info('Case filtering applied:', {
      directorBranch: directorBranchCode,
      appliedFilters: appliedFilters || 'none',
      page,
      limit,
    });

    try {
      const [rawAndEntities, count] = await Promise.all([
        queryBuilder.skip(offset).take(limit).getRawAndEntities(),
        queryBuilder.getCount(),
      ]);
      const { entities, raw } = rawAndEntities;
      cases = entities.map((e, i) => ({
        ...e,
        latest_activity_date: raw[i].latest_note_date || e.last_modified_date,
      }));
      totalCases = count;
    } catch (dbError) {
      logger.error('Database query error in findAllCases:', dbError);
      throw new ValidationError('Không thể truy xuất dữ liệu từ cơ sở dữ liệu');
    }

    const totalPages = Math.ceil(totalCases / limit);

    const result = {
      success: true,
      data: {
        cases,
        currentPage: parseInt(page, 10),
        totalPages,
        totalCases,
        limit: parseInt(limit, 10),
      },
    };

    logger.info(
      `Found ${cases.length} cases for director (branch: ${directorBranchCode || 'unknown'}, page ${page})`,
    );
    return result;
  } catch (error) {
    logger.error('Error in findAllCases:', error);
    throw error;
  }
};

/** * MỚI: Tìm tất cả hồ sơ theo bộ lọc department và branch
 * @param {number} page - Trang hiện tại (mặc định: 1)
 * @param {object} filters - Bộ lọc tùy chọn (bao gồm department, branch_code, search, type, status, employee_code)
 * @param {number} limit - Số lượng bản ghi trên mỗi trang (mặc định: 20, tối đa: 1000)
 * @param {object} sorting - Thông tin sắp xếp (bao gồm sortBy và sortOrder)
 * @return {Promise<object>} - Kết quả tìm kiếm với phân trang và bộ lọc
 * @throws {Error} - Nếu có lỗi trong quá trình tìm kiếm hoặc phân trang
 * * Core Requirement: Tìm kiếm hồ sơ theo department và branch_code, áp dụng AND logic
 * * Core Requirement: Chỉ cho phép tìm kiếm hồ sơ của nhân viên trong cùng department và branch_code
 * * * Core Requirement: Phải có phân trang với page và limit, mặc định là 1 và 20
 * * * Core Requirement: Phải có bộ lọc tìm kiếm theo tên khách hàng, mã khách hàng, loại hồ sơ, trạng thái hồ sơ
 * * * Core Requirement: Phải có sắp xếp theo trường hợp định nghĩa trong sorting
 * * * Core Requirement: Phải có thông tin về người phụ trách hồ sơ (officer) trong kết quả
 */
exports.findDepartmentCases = async (page = 1, filters = {}, limit = 20, sorting = {}) => {
  try {
    // Input validation
    if (page < 1) {
      throw new ValidationError('Số trang phải lớn hơn 0');
    }

    if (limit < 1 || limit > 1000) {
      throw new ValidationError('Giới hạn phải từ 1 đến 1000');
    }

    // Validate required department and branch filters
    if (!filters.department || typeof filters.department !== 'string') {
      throw new ValidationError('Bộ lọc phòng ban là bắt buộc và phải là chuỗi');
    }

    if (!filters.branch_code || typeof filters.branch_code !== 'string') {
      throw new ValidationError('Bộ lọc mã chi nhánh là bắt buộc và phải là chuỗi');
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');
    const offset = (page - 1) * limit;

    // Tạo query builder với join officer
    let queryBuilder = caseRepository
      .createQueryBuilder('debt_cases')
      .leftJoinAndSelect('debt_cases.officer', 'officer');

    // Filter allowed debt groups 3,4,5
    queryBuilder.andWhere('debt_cases.debt_group IN (:...allowedGroups)', {
      allowedGroups: [3, 4, 5],
    });

    // CORE REQUIREMENT: Apply BOTH department AND branch filters together (AND logic)
    queryBuilder = queryBuilder.andWhere(
      'officer.dept = :department AND officer.branch_code = :branch_code',
      {
        department: filters.department,
        branch_code: filters.branch_code,
      },
    );

    // Apply additional optional filters
    if (filters.search && typeof filters.search === 'string') {
      const sanitizedSearch = filters.search.trim().substring(0, 100);
      queryBuilder = queryBuilder.andWhere(
        '(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)',
        { search: `%${sanitizedSearch}%` },
      );
    }

    if (filters.type && typeof filters.type === 'string') {
      queryBuilder = queryBuilder.andWhere('debt_cases.case_type = :type', { type: filters.type });
    }

    if (filters.status && typeof filters.status === 'string') {
      queryBuilder = queryBuilder.andWhere('debt_cases.state = :status', {
        status: filters.status,
      });
    }

    // Apply specific employee filter if provided (within the same department/branch)
    if (filters.employee_code && typeof filters.employee_code === 'string') {
      queryBuilder = queryBuilder.andWhere('officer.employee_code = :employee_code', {
        employee_code: filters.employee_code,
      });
    }

    // Include latest note join for ordering by most recent note activity
    queryBuilder = queryBuilder
      .leftJoin(
        (qb) =>
          qb
            .select('cn.case_id', 'note_case_id')
            .addSelect('MAX(cn.created_date)', 'latest_note_date')
            .from('case_notes', 'cn')
            .groupBy('cn.case_id'),
        'latest_note',
        'latest_note.note_case_id = debt_cases.case_id',
      )
      .addSelect('latest_note.latest_note_date', 'latest_note_date');

    // Apply sorting with validation
    if (sorting.sortBy && sorting.sortOrder) {
      let orderByField;
      let orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      switch (sorting.sortBy) {
        case 'customer_code':
          orderByField = 'debt_cases.customer_code';
          break;
        case 'customer_name':
          orderByField = 'debt_cases.customer_name';
          break;
        case 'outstanding_debt':
          orderByField = 'debt_cases.outstanding_debt';
          break;
        case 'case_type':
          orderByField = 'debt_cases.case_type';
          break;
        case 'state':
          orderByField = 'debt_cases.state';
          break;
        case 'created_date':
          orderByField = 'debt_cases.created_date';
          break;
        case 'officer':
          orderByField = 'officer.fullname';
          break;
        default:
          orderByField = 'debt_cases.last_modified_date';
          orderDirection = 'DESC';
      }

      if (orderByField === 'debt_cases.last_modified_date') {
        queryBuilder = queryBuilder
          .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
          .addOrderBy(orderByField, orderDirection);
      } else {
        queryBuilder = queryBuilder
          .orderBy(orderByField, orderDirection)
          .addOrderBy('latest_note_date', 'DESC', 'NULLS LAST');
      }
    } else {
      // Default sorting: prioritize newest note
      queryBuilder = queryBuilder
        .orderBy('latest_note_date', 'DESC', 'NULLS LAST')
        .addOrderBy('debt_cases.last_modified_date', 'DESC');
    }

    // Execute queries with error handling
    let totalCases, cases;
    try {
      const [rawAndEntities, count] = await Promise.all([
        queryBuilder.skip(offset).take(limit).getRawAndEntities(),
        queryBuilder.getCount(),
      ]);
      const { entities, raw } = rawAndEntities;
      cases = entities.map((e, i) => ({
        ...e,
        latest_activity_date: raw[i].latest_note_date || e.last_modified_date,
      }));
      totalCases = count;
    } catch (dbError) {
      logger.error('Database query error in findDepartmentCases:', dbError);
      throw new ValidationError('Không thể truy xuất dữ liệu hồ sơ phòng ban từ cơ sở dữ liệu');
    }

    const totalPages = Math.ceil(totalCases / limit);

    const result = {
      success: true,
      data: {
        cases,
        currentPage: parseInt(page),
        totalPages,
        totalCases,
        limit,
      },
    };

    logger.info(
      `Found ${cases.length} department cases for dept: ${filters.department}, branch: ${filters.branch_code} (page ${page})`,
    );
    return result;
  } catch (error) {
    logger.error(`Error in findDepartmentCases:`, error);
    throw error;
  }
};

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importExternalCasesFromExcel = async (fileBuffer) => {
  try {
    // Validate input buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new ValidationError('File Excel trống hoặc bị hỏng. Vui lòng kiểm tra lại file gốc');
    }

    // Check if buffer has Excel file signature
    const excelSignatures = [
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), // .xls signature (OLE2)
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // .xlsx signature (ZIP)
      Buffer.from([0x50, 0x4b, 0x07, 0x08]), // Alternative .xlsx signature
    ];

    const hasValidSignature = excelSignatures.some((signature) =>
      fileBuffer.subarray(0, signature.length).equals(signature),
    );

    if (!hasValidSignature) {
      throw new ValidationError(
        'File không phải là file Excel hợp lệ. Vui lòng kiểm tra lại định dạng file và đảm bảo file không bị hỏng.',
      );
    }

    const caseRepository = AppDataSource.getRepository('DebtCase');

    // 1. Đọc dữ liệu từ file Excel with enhanced error handling
    let workbook, data;

    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      logger.error('Failed to parse external Excel file:', error);
      throw new ValidationError('Không thể đọc file Excel. File có thể bị hỏng hoặc có định dạng không đúng. Vui lòng kiểm tra lại file gốc.');
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new ValidationError('File Excel không chứa sheet nào. Vui lòng kiểm tra lại file.');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new ValidationError('Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng. Vui lòng kiểm tra lại file.');
    }

    try {
      data = xlsx.utils.sheet_to_json(worksheet);
    } catch (error) {
      logger.error('Failed to convert sheet to JSON:', error);
      throw new ValidationError('Không thể đọc dữ liệu từ file Excel. File có thể bị hỏng hoặc có cấu trúc không đúng.');
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError('File Excel không chứa dữ liệu hoặc định dạng không đúng. Vui lòng kiểm tra lại file.');
    }

    // Validate template headers for EXTERNAL import
    const actualHeaders = collectHeaders(data);
    const externalCheck = validateHeaders(actualHeaders, EXTERNAL_EXPECTED_HEADERS);
    if (!externalCheck.ok) {
      // Try to detect if user selected INTERNAL template by mistake
      const looksLikeInternal = validateHeaders(actualHeaders, INTERNAL_EXPECTED_HEADERS).missing.length < INTERNAL_EXPECTED_HEADERS.length;
      const hint = looksLikeInternal
        ? 'Có vẻ bạn đang dùng mẫu Nội bảng. Vui lòng chọn đúng chức năng "Import nội bảng".'
        : 'Vui lòng sử dụng đúng mẫu Import ngoại bảng với các cột: makh, Ngoaibang, cbtd, TenKhachHang.';
      throwBadRequest(
        `Sai mẫu file Import ngoại bảng. Thiếu cột: ${externalCheck.missing.join(', ')}. ${hint}`,
      );
    }

    // const allowedDebtGroups = [3, 4, 5];
    const customerDebtMap = new Map();

    // 2. Lọc và tổng hợp dữ liệu vào Map
    for (const row of data) {
      const customerCode = row.makh;
      const outstandingDebt = convertToNumber(row.Ngoaibang);
      const employeeCode = row.cbtd; // CBTD ngoại bảng
      const customerName = row.TenKhachHang;
      // Thử bắt nhóm nợ nếu file có cột (ví dụ "NhomNo" hoặc ký hiệu khác). Nếu không có để null.
      const debtGroupNumber = 5;
      // if (row.Nhomnohientai !== undefined && row.Nhomnohientai !== null) {
      //     if (typeof row.Nhomnohientai === 'number') debtGroupNumber = row.Nhomnohientai;
      //     else if (typeof row.Nhomnohientai === 'string') {
      //         const match = row.Nhomnohientai.match(/\d+/);
      //         if (match) debtGroupNumber = parseInt(match[0], 10);
      //     }
      // }

      if (!customerCode) {
        continue;
      }

      if (customerDebtMap.has(customerCode)) {
        const currentData = customerDebtMap.get(customerCode);
        currentData.outstanding_debt += outstandingDebt;
        if (debtGroupNumber !== null) {currentData.debt_group = debtGroupNumber;}
        customerDebtMap.set(customerCode, currentData);
      } else {
        customerDebtMap.set(customerCode, {
          customer_code: customerCode,
          customer_name: customerName,
          outstanding_debt: outstandingDebt,
          assigned_employee_code: employeeCode,
          case_type: 'external', // **THAY ĐỔI Ở ĐÂY**
          debt_group: debtGroupNumber,
        });
      }
    }

    // 3. Chuyển Map thành mảng để xử lý
    const aggregatedData = Array.from(customerDebtMap.values());

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 4. Lặp qua dữ liệu đã tổng hợp và cập nhật CSDL
    for (const customer of aggregatedData) {
      try {
        if (
          !customer.customer_code ||
          !customer.customer_name ||
          !customer.assigned_employee_code
        ) {
          errors.push(
            `Khách hàng với mã ${customer.customer_code} bị thiếu thông tin Tên hoặc CBTD.`,
          );
          continue;
        }

        const existingCase = await caseRepository.findOneBy({
          customer_code: customer.customer_code,
          case_type: 'external', // **THAY ĐỔI Ở ĐÂY**
        });

        if (existingCase) {
          existingCase.outstanding_debt = customer.outstanding_debt;
          existingCase.assigned_employee_code = customer.assigned_employee_code;
          existingCase.debt_group = customer.debt_group ?? existingCase.debt_group;
          await caseRepository.save(existingCase);
          updatedCount++;
        } else {
          const newCase = caseRepository.create(customer);
          await caseRepository.save(newCase);
          createdCount++;
        }
      } catch (error) {
        errors.push(`Lỗi xử lý khách hàng ${customer.customer_code}: ${error.message}`);
      }
    }

    // 5. Trả về kết quả
    return {
      totalRowsInFile: data.length,
      processedCustomers: aggregatedData.length,
      created: createdCount,
      updated: updatedCount,
      errors,
    };
  } catch (error) {
    logger.error('Fatal error in importExternalCasesFromExcel:', error);
    throw error;
  }
};

exports.getCaseById = async (caseId) => {
  const caseRepository = AppDataSource.getRepository('DebtCase');
  const debtCase = await caseRepository.findOne({
    where: { case_id: caseId },
    relations: ['officer'], // Include thông tin người phụ trách
  });
  return debtCase;
};

/**
 * NEW: Lấy thông tin tổng hợp của case (bao gồm details, updates, và documents)
 * @param {string} caseId - ID của case
 * @param {number} limit - Số lượng updates tối đa (mặc định 10)
 */
exports.getCaseOverview = async (caseId, limit = 10) => {
  const caseRepository = AppDataSource.getRepository('DebtCase');
  const caseNoteRepository = AppDataSource.getRepository('CaseNote');
  const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');
  const caseActivityRepository = AppDataSource.getRepository('CaseActivity');

  // 1. Fetch case details
  const caseDetail = await caseRepository.findOne({
    where: { case_id: caseId },
    relations: ['officer'],
  });

  if (!caseDetail) {
    throw new ValidationError('Hồ sơ không tìm thấy.');
  }

  // 2. Fetch recent notes (formerly updates) limited by provided limit
  const recentNotes = await caseNoteRepository.find({
    where: { case_id: caseId },
    order: { created_date: 'DESC' },
    take: limit,
  });

  // 2b. Fetch recent activities limited by provided limit
  const recentActivities = await caseActivityRepository.find({
    where: { case_id: caseId },
    order: { performed_date: 'DESC' },
    take: limit,
  });

  // 3. Fetch all documents with uploader info
  const documents = await caseDocumentRepository.find({
    where: { case_id: caseId },
    relations: ['uploader'],
    order: { upload_date: 'DESC' },
  });

  // 4. Get total note & activity counts for pagination/info
  const [totalNotes, totalActivities] = await Promise.all([
    caseNoteRepository.count({ where: { case_id: caseId } }),
    caseActivityRepository.count({ where: { case_id: caseId } }),
  ]);

  // 5. Build unified timeline (notes + activities) limited to provided limit by merged order
  const mappedNoteTimeline = recentNotes.map((n) => ({
    id: n.note_id,
    type: 'note',
    case_id: n.case_id,
    content: n.note_content,
    is_private: n.is_private,
    performed_date: n.created_date,
    updated_date: n.updated_date,
    performed_by: { fullname: n.created_by_fullname },
  }));
  const mappedActivityTimeline = recentActivities.map((a) => ({
    id: a.activity_id,
    type: 'activity',
    case_id: a.case_id,
    content: a.activity_description,
    activity_type: a.activity_type,
    old_value: a.old_value,
    new_value: a.new_value,
    metadata: a.metadata,
    performed_date: a.performed_date,
    updated_date: a.performed_date,
    performed_by: { fullname: a.performed_by_fullname },
    is_system_activity: a.is_system_activity,
  }));
  const mergedTimeline = [...mappedNoteTimeline, ...mappedActivityTimeline]
    .sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date))
    .slice(0, limit);

  // Backward compatibility: keep keys recentUpdates / updatesPagination expected by frontend
  return {
    caseDetail,
    // Backward compatibility (legacy UI field)
    recentUpdates: recentNotes.map((n) => ({
      update_id: n.note_id,
      case_id: n.case_id,
      update_content: n.note_content,
      created_date: n.created_date,
      updated_date: n.updated_date,
      officer: { fullname: n.created_by_fullname },
    })),
    // New enriched fields
    recentActivities: recentActivities.map((a) => ({
      activity_id: a.activity_id,
      case_id: a.case_id,
      activity_type: a.activity_type,
      activity_description: a.activity_description,
      performed_date: a.performed_date,
      old_value: a.old_value,
      new_value: a.new_value,
      metadata: a.metadata,
      performer: { fullname: a.performed_by_fullname },
      is_system_activity: a.is_system_activity,
    })),
    timeline: mergedTimeline,
    counts: {
      notes: totalNotes,
      activities: totalActivities,
      total: totalNotes + totalActivities,
    },
    documents,
    updatesPagination: {
      total: totalNotes,
      loaded: recentNotes.length,
      hasMore: totalNotes > limit,
    },
  };
};

/**
 * MỚI: Lấy danh sách cập nhật của hồ sơ với phân trang
 * @param {string} caseId - ID của hồ sơ
 * @param {number} page - Trang hiện tại (mặc định: 1)
 * @param {number} limit - Số lượng bản ghi trên trang (mặc định: 5)
 */
exports.getCaseUpdates = async (caseId, page = 1, limit = 5, type = 'all') => {
  // type: 'all' | 'notes' | 'activities'
  const caseNoteRepository = AppDataSource.getRepository('CaseNote');
  const caseActivityRepository = AppDataSource.getRepository('CaseActivity');

  // Fetch notes & activities (fetch more than needed then paginate after merge for correct ordering)
  // Strategy: pull up to (limit * 3) of each to reduce DB round trips; acceptable given typical small limit.
  const fetchSize = limit * 3;

  let notes = [];
  let activities = [];

  if (type === 'all' || type === 'notes') {
    notes = await caseNoteRepository.find({
      where: { case_id: caseId },
      order: { created_date: 'DESC' },
      take: fetchSize,
    });
  }

  if (type === 'all' || type === 'activities') {
    activities = await caseActivityRepository.find({
      where: { case_id: caseId },
      order: { performed_date: 'DESC' },
      take: fetchSize,
    });
  }

  // Map to a unified structure with a common timestamp for sorting
  const mappedNotes = notes.map((n) => ({
    source: 'note',
    update_id: n.note_id,
    case_id: n.case_id,
    update_content: n.note_content,
    created_date: n.created_date,
    updated_date: n.updated_date,
    performed_date: n.created_date,
    officer: { fullname: n.created_by_fullname },
  }));

  const mappedActivities = activities.map((a) => ({
    source: 'activity',
    update_id: a.activity_id,
    case_id: a.case_id,
    update_content: a.activity_description,
    created_date: a.performed_date,
    updated_date: a.performed_date,
    performed_date: a.performed_date,
    activity_type: a.activity_type,
    old_value: a.old_value,
    new_value: a.new_value,
    metadata: a.metadata,
    officer: { fullname: a.performed_by_fullname },
  }));

  let merged = [];
  if (type === 'notes') {merged = mappedNotes;}
  else if (type === 'activities') {merged = mappedActivities;}
  else {merged = [...mappedNotes, ...mappedActivities];}

  // Sort merged by performed_date desc
  merged.sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date));

  const total = merged.length; // total in merged window; for full accuracy might need COUNT queries
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paged = merged.slice(start, start + limit);
  const hasMore = page < totalPages;

  return {
    updates: paged,
    pagination: {
      currentPage: page,
      totalPages,
      total,
      limit,
      hasMore,
    },
  };
};

/**
 * Add case note (uses new note system)
 * @param {string} caseId - ID của hồ sơ cần cập nhật
 * @param {string} content - Nội dung ghi chú
 * @param {object} uploader - Thông tin người dùng đang thực hiện cập nhật
 * @param {boolean} isPrivate - Whether the note is private
 */
exports.addCaseNote = async (caseId, content, uploader, isPrivate = false) => {
  const caseRepository = AppDataSource.getRepository('DebtCase');

  // 1. Kiểm tra xem hồ sơ có tồn tại không
  const debtCase = await caseRepository.findOneBy({ case_id: caseId });
  if (!debtCase) {
    throw new ValidationError('Không tìm thấy hồ sơ.');
  }

  // 2. Tạo ghi chú mới sử dụng service
  const note = await caseNoteService.createNote({
    case_id: caseId,
    note_content: content,
    is_private: isPrivate,
    created_by_fullname: uploader.fullname,
  });

  // 3. Cập nhật lại ngày last_modified_date của hồ sơ chính
  await caseRepository.update(caseId, { last_modified_date: new Date() });

  return note;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use addCaseNote instead
 */
exports.addCaseUpdate = async (caseId, content, uploader) => {
  logger.warn('addCaseUpdate is deprecated, use addCaseNote instead');
  return this.addCaseNote(caseId, content, uploader, false);
};

/**
 * MỚI: Cập nhật trạng thái hồ sơ với activity logging
 * @param {string} caseId - ID của hồ sơ cần cập nhật
 * @param {string} status - Trạng thái mới
 * @param {object} updater - Thông tin người dùng đang thực hiện cập nhật
 */
exports.updateCaseStatus = async (caseId, status, updater) => {
  const caseRepository = AppDataSource.getRepository('DebtCase');

  // 1. Kiểm tra xem hồ sơ có tồn tại không
  const debtCase = await caseRepository.findOneBy({ case_id: caseId });
  if (!debtCase) {
    throw new ValidationError('Không tìm thấy hồ sơ.');
  }

  // 2. Kiểm tra xem trạng thái có thay đổi không
  if (debtCase.state === status) {
    throw new ValidationError('Trạng thái mới giống với trạng thái hiện tại.');
  }

  // map trạng thái sang tiếng Việt
  const statusMap = {
    beingFollowedUp: 'Đang đôn đốc',
    beingSued: 'Đang khởi kiện',
    awaitingJudgmentEffect: 'Chờ hiệu lực án',
    beingExecuted: 'Đang thi hành án',
    proactivelySettled: 'Chủ động XLTS',
    debtSold: 'Bán nợ',
    amcHired: 'Thuê AMC XLN',
  };

  // 3. Kiểm tra trạng thái hợp lệ
  if (!Object.keys(statusMap).includes(status)) {
    throw new ValidationError('Trạng thái không hợp lệ.');
  }

  const oldStatus = debtCase.state;
  const oldStatusDisplay = statusMap[oldStatus] || oldStatus;
  const newStatusDisplay = statusMap[status];

  // 4. Cập nhật trạng thái trong database
  await caseRepository.update(caseId, {
    state: status,
    last_modified_date: new Date(),
  });

  // 5. Log hoạt động thay đổi trạng thái
  await caseActivityService.logStatusChange(
    caseId,
    oldStatusDisplay,
    newStatusDisplay,
    updater.fullname,
  );

  // 6. Lấy lại thông tin hồ sơ đã cập nhật
  const updatedCase = await caseRepository.findOneBy({ case_id: caseId });

  return updatedCase;
};

exports.getUpdateContentByCase = async (caseId) => {
  // Legacy helper now backed by CaseNote
  const caseNoteRepository = AppDataSource.getRepository('CaseNote');
  const notes = await caseNoteRepository.find({
    where: { case_id: caseId },
    order: { created_date: 'DESC' },
  });
  return notes.map((n) => ({
    update_id: n.note_id,
    case_id: n.case_id,
    update_content: n.note_content,
    created_date: n.created_date,
    updated_date: n.updated_date,
    officer: { fullname: n.created_by_fullname },
  }));
};

exports.addDocumentToCase = async (caseId, fileInfo, uploader, documentType = 'other') => {
  const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');
  const caseRepository = AppDataSource.getRepository('DebtCase');

  // 1. Kiểm tra xem hồ sơ có tồn tại không
  const debtCase = await caseRepository.findOneBy({ case_id: caseId });
  if (!debtCase) {
    throw new Error('Không tìm thấy hồ sơ.');
  }

  // Decode tên file để xử lý tiếng Việt đúng cách
  const decodeFilename = (filename) => {
    try {
      // Thử decode URIComponent nếu có
      return decodeURIComponent(filename);
    } catch (e) {
      // Nếu không decode được, thử với Buffer
      try {
        return Buffer.from(filename, 'latin1').toString('utf8');
      } catch (e2) {
        // Nếu vẫn không được, giữ nguyên
        return filename;
      }
    }
  };

  const newDocumentData = {
    case_id: caseId,
    original_filename: decodeFilename(fileInfo.originalname),
    file_path: getRelativeFilePath(fileInfo.path), // Lưu relative path thay vì absolute path
    mime_type: fileInfo.mimetype,
    file_size: fileInfo.size,
    document_type: documentType, // Sử dụng document_type được truyền vào
    uploaded_by_username: uploader.username,
  };

  const document = caseDocumentRepository.create(newDocumentData);
  await caseDocumentRepository.save(document);

  // Log thông tin file đã lưu
      logger.debug('Document saved with structured path:', {
    originalName: fileInfo.originalname,
    relativePath: getRelativeFilePath(fileInfo.path),
    absolutePath: fileInfo.path,
    documentType,
    caseId,
  });

  // 2. Log hoạt động upload file
  await caseActivityService.logFileUpload(
    caseId,
    {
      document_id: document.document_id,
      original_filename: decodeFilename(fileInfo.originalname),
      file_size: fileInfo.size,
      mime_type: fileInfo.mimetype,
      document_type: documentType,
    },
    uploader.fullname,
  );

  // 3. Cập nhật lại ngày last_modified_date của hồ sơ chính
  await caseRepository.update(caseId, { last_modified_date: new Date() });

  return document;
};

/**
 * Lấy danh sách tài liệu đã tải lên cho một case
 * @param {string} caseId - ID của case cần lấy danh sách tài liệu
 */
exports.getDocumentsByCase = async (caseId) => {
  logger.debug('getDocumentsByCase called with caseId:', caseId);
  const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');

  const documents = await caseDocumentRepository.find({
    where: {
      case_id: caseId,
    },
    relations: ['uploader'], // Include uploader relationship
    order: {
      upload_date: 'DESC', // Sắp xếp theo ngày tải lên mới nhất
    },
  });

      logger.debug('Found documents:', documents.length);
  return documents;
};

/**
 * Lấy thông tin chi tiết của một tài liệu theo ID
 * @param {string} documentId - ID của tài liệu cần lấy thông tin
 */
exports.getDocumentById = async (documentId) => {
  const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');

  const document = await caseDocumentRepository.findOne({
    where: { document_id: documentId },
    relations: ['uploader'], // Include uploader relationship
  });

  return document;
};

/**
 * Xóa tài liệu theo ID
 * @param {string} documentId - ID của tài liệu cần xóa
 * @param {object} deleter - Thông tin người dùng đang thực hiện xóa
 */
exports.deleteDocumentById = async (documentId, deleter) => {
  const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');
  const caseRepository = AppDataSource.getRepository('DebtCase');
  const fs = require('fs');

  // Lấy thông tin tài liệu trước khi xóa
  const document = await caseDocumentRepository.findOneBy({
    document_id: documentId,
  });

  if (!document) {
    throw new ValidationError('Không tìm thấy tài liệu.');
  }

  // Lấy thông tin case để tạo log
  const caseId = document.case_id;

  // Xóa file vật lý nếu tồn tại
  const absolutePath = getAbsoluteFilePath(document.file_path);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      logger.debug('File deleted from:', absolutePath);
    } catch (fileError) {
      console.error('Lỗi khi xóa file vật lý:', fileError);
      // Không throw error ở đây để vẫn có thể xóa record trong DB
    }
  } else {
            logger.debug('File not found for deletion:', absolutePath);
  }

  // Xóa record trong database
  const result = await caseDocumentRepository.delete({ document_id: documentId });

  if (result.affected === 0) {
    throw new ValidationError('Không thể xóa tài liệu.');
  }

  // Log file deletion activity using CaseActivity service
  await caseActivityService.logFileDelete(
    caseId,
    {
      document_id: documentId,
      original_filename: document.original_filename,
      file_size: document.file_size,
      mime_type: document.mime_type,
    },
    deleter.fullname,
  );

  // Cập nhật lại ngày last_modified_date của hồ sơ chính
  await caseRepository.update(caseId, { last_modified_date: new Date() });

  return result;
};

exports.getCaseTimeline = async (caseId, page = 1, limit = 10) => {
  const noteRepository = AppDataSource.getRepository('CaseNote');
  const logRepository = AppDataSource.getRepository('CaseActivityLog');

  // Lấy ghi chú
  const notes = await noteRepository.find({ where: { case_id: caseId }, relations: ['officer'] });
  // Lấy log hoạt động
  const logs = await logRepository.find({ where: { case_id: caseId }, relations: ['officer'] });

  // Chuẩn hóa dữ liệu về một định dạng chung
  const formattedNotes = notes.map((n) => ({
    id: n.note_id,
    type: 'note',
    content: n.note_content,
    user: n.officer,
    date: n.created_date,
  }));
  const formattedLogs = logs.map((l) => ({
    id: l.log_id,
    type: l.activity_type, // 'STATUS_CHANGE', 'FILE_UPLOAD',...
    content: l.activity_content,
    user: l.officer,
    date: l.created_date,
  }));

  // Trộn và sắp xếp
  const timeline = [...formattedNotes, ...formattedLogs].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  // Phân trang
  const offset = (page - 1) * limit;
  const paginatedItems = timeline.slice(offset, offset + limit);

  return {
    timeline: paginatedItems,
    pagination: {
      totalItems: timeline.length,
      totalPages: Math.ceil(timeline.length / limit),
      currentPage: page,
      itemsPerPage: limit,
    },
  };
};
