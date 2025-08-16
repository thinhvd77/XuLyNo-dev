const AppDataSource = require('../config/dataSource');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { normalizeStatus, normalizeCaseType } = require('../constants/caseConstants');
const reportService = require('../services/report.service');
const { isReportExportAllowed } = require('../middleware/report.middleware');
const reportPermissionService = require('../services/reportPermission.service');

/**
 * Lấy dữ liệu báo cáo với các bộ lọc
 */
exports.getReportData = async (req, res) => {
  try {
    const reportData = await reportService.getReportData(req.query, req.user);

    res.json({
      success: true,
      data: reportData,
      total: reportData.length,
    });
  } catch (error) {
    console.error('Error getting report data:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu báo cáo',
      error: error.message,
    });
  }
};

/**
 * Xuất báo cáo Excel
 */
exports.exportReport = async (req, res) => {
  try {
    const { filePath, fileName, rowCount } = await reportService.generateSummaryReportFile(
      req.query,
      req.user,
    );
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Không có dữ liệu để xuất' });
    }

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Lỗi khi tải file' });
        }
        return;
      }

      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (_) {
            // ignore
          }
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xuất báo cáo', error: error.message });
  }
};

/**
 * Lấy danh sách giá trị để filter
 */
exports.getFilterOptions = async (req, res) => {
  try {
    const caseRepository = AppDataSource.getRepository('DebtCase');
    const userRepository = AppDataSource.getRepository('User');

    // Lấy danh sách trạng thái
    const statuses = await caseRepository
      .createQueryBuilder('debt_cases')
      .select('DISTINCT debt_cases.state', 'state')
      .where('debt_cases.state IS NOT NULL')
      .getRawMany();

    // Lấy danh sách chi nhánh
    const branches = await userRepository
      .createQueryBuilder('user')
      .innerJoin('debt_cases', 'cases', 'cases.assigned_employee_code = user.employee_code')
      .select('DISTINCT user.branch_code', 'branch_code')
      .where('user.branch_code IS NOT NULL')
      .getRawMany();

    // Lấy danh sách phòng ban
    const departments = await userRepository
      .createQueryBuilder('user')
      .innerJoin('debt_cases', 'cases', 'cases.assigned_employee_code = user.employee_code')
      .select('DISTINCT user.dept', 'dept')
      .where('user.dept IS NOT NULL')
      .getRawMany();

    // Lấy danh sách CBTD
    const employees = await userRepository
      .createQueryBuilder('user')
      .innerJoin('debt_cases', 'cases', 'cases.assigned_employee_code = user.employee_code')
      .select([
        'user.employee_code AS employee_code',
        'user.fullname AS fullname',
        'user.branch_code AS branch_code',
      ])
      .groupBy('user.employee_code, user.fullname, user.branch_code')
      .orderBy('user.fullname', 'ASC')
      .getRawMany();

    res.json({
      success: true,
      data: {
        statuses: statuses.map((s) => ({
          value: s.state,
          label: normalizeStatus(s.state),
        })),
        branches: branches.map((b) => b.branch_code),
        departments: departments.map((d) => d.dept),
        employees,
      },
    });
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bộ lọc',
      error: error.message,
    });
  }
};

/**
 * Check if current user can export report
 */
exports.getExportPermission = async (req, res) => {
  try {
    const user = req.user;
    const allowed = isReportExportAllowed(user);
    return res.json({ success: true, canExport: allowed });
  } catch (error) {
    return res.status(500).json({ success: false, canExport: false });
  }
};

/**
 * Admin: Get export whitelist
 */
exports.getExportWhitelist = async (req, res) => {
  const list = reportPermissionService.getAllowedEmployees();
  return res.json({ success: true, employees: list });
};

/**
 * Admin: Add employee to export whitelist
 */
exports.allowEmployeeExport = async (req, res) => {
  const { employeeCode } = req.body || {};
  if (!employeeCode) {
    return res.status(400).json({ success: false, message: 'employeeCode is required' });
  }
  try {
    const list = reportPermissionService.addAllowedEmployee(employeeCode);
    return res.json({ success: true, employees: list });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

/**
 * Admin: Remove employee from export whitelist
 */
exports.disallowEmployeeExport = async (req, res) => {
  const { employeeCode } = req.params;
  if (!employeeCode) {
    return res.status(400).json({ success: false, message: 'employeeCode is required' });
  }
  try {
    const list = reportPermissionService.removeAllowedEmployee(employeeCode);
    return res.json({ success: true, employees: list });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

/**
 * Lấy danh sách nhân viên theo chi nhánh
 */
exports.getEmployeesByBranch = async (req, res) => {
  try {
    const { branch } = req.query;
    const userRepository = AppDataSource.getRepository('User');

    let query = userRepository
      .createQueryBuilder('user')
      .innerJoin('debt_cases', 'cases', 'cases.assigned_employee_code = user.employee_code')
      .select([
        'user.employee_code AS employee_code',
        'user.fullname AS fullname',
        'user.branch_code AS branch_code',
      ])
      .groupBy('user.employee_code, user.fullname, user.branch_code')
      .orderBy('user.fullname', 'ASC');

    if (branch) {
      query = query.where('user.branch_code = :branch', { branch });
    }

    const employees = await query.getRawMany();

    res.json({
      success: true,
      data: {
        employees,
      },
    });
  } catch (error) {
    console.error('Error getting employees by branch:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách nhân viên theo chi nhánh',
      error: error.message,
    });
  }
};

/**
 * Export report for all cases with ALL updates from their most recent update date
 */
exports.exportLatestDateUpdatesReport = async (req, res) => {
  try {
    const { status, caseType, branch, department, employeeCode } = req.query;

    // BƯỚC 1: Lấy danh sách ID các hồ sơ thỏa mãn điều kiện lọc.
    // Cách này đảm bảo không bị lặp dữ liệu do JOIN.
    const caseIdQuery = AppDataSource.getRepository('DebtCase')
      .createQueryBuilder('debt_case')
      .select('DISTINCT debt_case.case_id', 'case_id')
      .leftJoin('debt_case.officer', 'user');

    if (status) {caseIdQuery.andWhere('debt_case.state = :status', { status });}
    if (caseType) {caseIdQuery.andWhere('debt_case.case_type = :caseType', { caseType });}
    if (branch) {caseIdQuery.andWhere('user.branch_code = :branch', { branch });}
    if (department) {caseIdQuery.andWhere('user.dept = :department', { department });}
    if (employeeCode)
      {caseIdQuery.andWhere('debt_case.assigned_employee_code = :employeeCode', { employeeCode });}

    const filteredCases = await caseIdQuery.getRawMany();
    if (filteredCases.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy dữ liệu phù hợp để xuất báo cáo.' });
    }
    const caseIds = filteredCases.map((c) => c.case_id);

    // BƯỚC 2: Lấy tất cả dữ liệu cần thiết cho các hồ sơ đã lọc trong 2 câu truy vấn hiệu quả.
    // Lấy thông tin chi tiết của các hồ sơ (cases)
    const casesData = await AppDataSource.getRepository('DebtCase')
      .createQueryBuilder('debt_case')
      .leftJoinAndSelect('debt_case.officer', 'user')
      .where('debt_case.case_id IN (:...caseIds)', { caseIds })
      .getMany();

    // Lấy tất cả ghi chú (notes) của các hồ sơ đó (thay thế CaseUpdate)
    const allNotes = await AppDataSource.getRepository('CaseNote')
      .createQueryBuilder('note')
      .where('note.case_id IN (:...caseIds)', { caseIds })
      .orderBy('note.created_date', 'ASC')
      .getMany();

    // BƯỚC 3: Xử lý dữ liệu trong code ứng dụng
    const notesByCaseId = allNotes.reduce((acc, note) => {
      const id = note.case_id;
      if (!acc[id]) {acc[id] = [];}
      acc[id].push(note);
      return acc;
    }, {});

    // Chuẩn bị dữ liệu cuối cùng cho Excel
    const excelData = casesData.map((caseInfo) => {
      const notesForThisCase = notesByCaseId[caseInfo.case_id] || [];
      let formattedUpdates = 'Chưa có cập nhật nào';
      let latestUpdateDateStr = '';

      if (notesForThisCase.length > 0) {
        // Tìm ngày cập nhật gần nhất
        const latestDate = new Date(
          Math.max(...notesForThisCase.map((u) => new Date(u.created_date))),
        );
        const latestDateString = latestDate.toISOString().split('T')[0];
        latestUpdateDateStr = latestDate.toLocaleDateString('vi-VN');

        // Lọc ra các cập nhật trong ngày gần nhất đó
        const updatesOnLatestDate = notesForThisCase.filter((u) => {
          return new Date(u.created_date).toISOString().split('T')[0] === latestDateString;
        });

        // Gộp nội dung cập nhật vào một ô, có kiểm tra giới hạn
        if (updatesOnLatestDate.length > 0) {
          const updateContents = updatesOnLatestDate.map((note) => {
            const time = new Date(note.created_date).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            // CaseNote không lưu officer relation, chỉ có created_by_fullname
            const updaterName = note.created_by_fullname || 'Không rõ';
            return `[${time}] ${updaterName}: ${note.note_content}`;
          });

          const joinedContent = updateContents.join('\n');
          const CHAR_LIMIT = 32000; // Giới hạn an toàn

          if (joinedContent.length > CHAR_LIMIT) {
            let truncatedContent = '';
            let hiddenCount = updateContents.length;
            for (const content of updateContents) {
              if (truncatedContent.length + content.length + 1 < CHAR_LIMIT) {
                truncatedContent += content + '\n';
                hiddenCount--;
              }
            }
            formattedUpdates =
              truncatedContent.trim() +
              `\n... [và ${hiddenCount} cập nhật khác đã bị ẩn do vượt quá giới hạn]`;
          } else {
            formattedUpdates = joinedContent;
          }
        }
      }

      return {
        'Mã khách hàng': caseInfo.customer_code,
        'Tên khách hàng': caseInfo.customer_name,
        'Loại hồ sơ': normalizeCaseType(caseInfo.case_type),
        'Trạng thái': normalizeStatus(caseInfo.state),
        'Dư nợ (VND)': parseFloat(caseInfo.outstanding_debt || 0),
        'CBTD được giao': caseInfo.officer?.fullname || '',
        'Chi nhánh': caseInfo.officer?.branch_code || '',
        'Phòng ban': caseInfo.officer?.dept || '',
        'Tất cả cập nhật ngày mới nhất': formattedUpdates,
        'Ngày cập nhật mới nhất': latestUpdateDateStr,
        'Ngày tạo case': caseInfo.created_date
          ? new Date(caseInfo.created_date).toLocaleDateString('vi-VN')
          : '',
      };
    });

    // BƯỚC 4: Tạo và gửi file Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 80 },
      { wch: 18 },
      { wch: 15 },
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let row = 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 8 }); // Cột "Tất cả cập nhật"
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = { alignment: { wrapText: true, vertical: 'top' } };
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao cao cap nhat');
    const currentDate = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    const filename = `Bao_cao_cap_nhat_moi_nhat_${currentDate}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting latest date updates report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xuất báo cáo chi tiết cập nhật',
      error: error.message,
    });
  }
};

// const normalizeStatus = (status) => {
//     const statusMap = {
//         'beingFollowedUp': 'Đang đôn đốc', 'beingSued': 'Đang khởi kiện',
//         'awaitingJudgmentEffect': 'Chờ hiệu lực án', 'beingExecuted': 'Đang thi hành án',
//         'proactivelySettled': 'Chủ động XLTS', 'debtSold': 'Bán nợ',
//         'amcHired': 'Thuê AMC XLN', 'completed': 'Hoàn thành'
//     };
//     return statusMap[status] || status;
// };
//
// const normalizeCaseType = (caseType) => {
//     const typeMap = { 'internal': 'Nội bảng', 'external': 'Ngoại bảng' };
//     return typeMap[caseType] || caseType;
// };

// Helper function for status display (reuse existing function)
const getStatusDisplayName = (status) => {
  const statusMap = {
    beingFollowedUp: 'Đang đôn đốc',
    beingSued: 'Đang khởi kiện',
    awaitingJudgmentEffect: 'Chờ hiệu lực án',
    beingExecuted: 'Đang thi hành án',
    proactivelySettled: 'Chủ động XLTS',
    debtSold: 'Bán nợ',
    amcHired: 'Thuê AMC XLN',
  };
  return statusMap[status] || status;
};
