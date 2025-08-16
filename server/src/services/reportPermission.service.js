const fs = require('fs');
const path = require('path');

const FILE_NAME = 'report-export-allowlist.json';

function getCandidateDirs() {
  const dirs = [];
  const safeBase = process.env.SAFE_BASE_DIR && process.env.SAFE_BASE_DIR.trim();
  if (safeBase) {
    dirs.push(path.resolve(safeBase));
  }
  // server/uploads (relative to this file)
  dirs.push(path.resolve(__dirname, '../..', 'uploads'));
  // process cwd uploads as last fallback
  dirs.push(path.resolve(process.cwd(), 'uploads'));
  return dirs;
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getPrimaryFilePath() {
  const dirs = getCandidateDirs();
  const primaryDir = dirs[0];
  ensureDirExists(primaryDir);
  return path.join(primaryDir, FILE_NAME);
}

function findExistingFilePath() {
  const dirs = getCandidateDirs();
  for (const dir of dirs) {
    const filePath = path.join(dir, FILE_NAME);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return getPrimaryFilePath();
}

function readWhitelist() {
  const filePath = findExistingFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === 'string');
    }
    return [];
  } catch (_) {
    return [];
  }
}

function writeWhitelist(list) {
  const filePath = getPrimaryFilePath();
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

exports.getAllowedEmployees = () => {
  return readWhitelist();
};

exports.addAllowedEmployee = (employeeCode) => {
  if (!employeeCode || typeof employeeCode !== 'string') {
    throw new Error('Invalid employee code');
  }
  const list = readWhitelist();
  if (!list.includes(employeeCode)) {
    list.push(employeeCode);
    writeWhitelist(list);
  }
  return list;
};

exports.removeAllowedEmployee = (employeeCode) => {
  if (!employeeCode || typeof employeeCode !== 'string') {
    throw new Error('Invalid employee code');
  }
  const list = readWhitelist();
  const next = list.filter((c) => c !== employeeCode);
  writeWhitelist(next);
  return next;
};


