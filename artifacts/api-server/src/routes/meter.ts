import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { requireAuth } from "../lib/auth";
import { extractMeterReading } from "../lib/groq";

const router: Router = Router();

// Uploads directory setup
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, and WebP images are supported."));
  },
});

// ── Meter image upload endpoint ──────────────────────────────────────────────

router.post("/meter/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Please upload an image file." });
    return;
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const result = await extractMeterReading(imageBuffer, mimeType);
    fs.unlinkSync(filePath);
    res.json(result);
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch {}
    res.status(503).json({
      success: false,
      confidence: 0,
      current_reading: null,
      error: "Could not process image. Please enter reading manually.",
    });
  }
});

export default router;