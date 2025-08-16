// Helper function để chuyển đổi status code thành tên hiển thị
export const getStatusDisplayName = (status) => {
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

// Helper function để tạo message cập nhật trạng thái cho timeline
export const getStatusUpdateMessage = (oldStatus, newStatus, userFullname) => {
  const oldStatusName = getStatusDisplayName(oldStatus);
  const newStatusName = getStatusDisplayName(newStatus);
  return `${userFullname} đã cập nhật trạng thái từ "${oldStatusName}" thành "${newStatusName}"`;
};

// Helper function để lấy icon cho file
export const getFileIcon = (mimeType, fileName) => {
  if (mimeType.startsWith('image/')) {
    return '🖼️';
  } else if (mimeType.includes('pdf')) {
    return '📄';
  } else if (
    mimeType.includes('application/msword') ||
    mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    fileName.endsWith('.doc') ||
    fileName.endsWith('.docx')
  ) {
    return '📝';
  } else if (
    mimeType.includes('application/vnd.ms-excel') ||
    mimeType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.xlsx')
  ) {
    return '📊';
  } else if (
    mimeType.includes('application/vnd.ms-powerpoint') ||
    mimeType.includes(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ) ||
    fileName.endsWith('.ppt') ||
    fileName.endsWith('.pptx')
  ) {
    return '📈';
  } else if (mimeType.startsWith('video/')) {
    return '🎥';
  } else if (mimeType.startsWith('audio/')) {
    return '🎵';
  } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
    return '📦';
  } else {
    return '📎';
  }
};

// Helper function để kiểm tra file có thể preview được không
export const canPreview = (mimeType) => {
  if (!mimeType) {
    return false;
  }
  return (
    mimeType.startsWith('image/') ||
    mimeType.includes('pdf') ||
    mimeType.startsWith('text/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType.includes('application/msword') ||
    mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    mimeType.includes('application/vnd.ms-excel') ||
    mimeType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
    mimeType.includes('application/vnd.ms-powerpoint') ||
    mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')
  );
};

// Helper function để lấy tên loại tài liệu
export const getTypeName = (type) => {
  const types = {
    enforcement: 'Thi hành án',
    court: 'Tòa án',
    notification: 'Bán nợ',
    proactive: 'Chủ động xử lý tài sản',
    collateral: 'Tài sản đảm bảo',
    processed_collateral: 'TS đã xử lý',
    other: 'Tài liệu khác',
  };
  return types[type] || 'Không xác định';
};

// Helper function để tổ chức files theo loại
export const organizeFilesByType = (uploadedFiles) => {
  const fileTypes = [
    'court',
    'enforcement',
    'notification',
    'proactive',
    'collateral',
    'processed_collateral',
    'other',
  ];
  const organizedFiles = {};

  fileTypes.forEach((type) => {
    organizedFiles[type] = uploadedFiles.filter(
      (file) =>
        file.document_type === type ||
        (type === 'other' && (!file.document_type || file.document_type === 'Khác')),
    );
  });

  return organizedFiles;
};
