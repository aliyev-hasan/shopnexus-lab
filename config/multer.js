const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload qovluğunun mövcudluğunu təmin et
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Fayl yükləmə konfiqurasiyası
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Fayl filtrasiya (brauzerlərdə təhlükəsiz göstərilən şəkil formatları)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Yalnız JPG, PNG və WEBP şəkillərinə icazə verilir!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
