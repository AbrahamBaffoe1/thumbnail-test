// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 5001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Helper function to download image from URL
async function downloadImage(url, filePath) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
  });
  
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

// Helper function to extract image metadata using ImageMagick
function getImageMetadata(imagePath) {
  return new Promise((resolve, reject) => {
    exec(`identify -format "%w×%h %[EXIF:*]" ${imagePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting metadata: ${error.message}`);
        return resolve({ dimensions: "unknown" }); // Return minimal object on error
      }
      
      // Parse the output to extract metadata
      const metadata = { originalSize: "" };
      
      // Extract dimensions
      const dimensionsMatch = stdout.match(/^(\d+)×(\d+)/);
      if (dimensionsMatch) {
        metadata.originalWidth = parseInt(dimensionsMatch[1], 10);
        metadata.originalHeight = parseInt(dimensionsMatch[2], 10);
        metadata.originalSize = `${metadata.originalWidth}×${metadata.originalHeight}`;
        metadata.aspectRatio = (metadata.originalWidth / metadata.originalHeight).toFixed(2);
      }
      
      // Extract other metadata
      const exifData = stdout.replace(/^\d+×\d+ /, '');
      const exifPairs = exifData.split(' ');
      
      exifPairs.forEach(pair => {
        const match = pair.match(/([^=]+)=(.+)/);
        if (match && match.length >= 3) {
          const [, key, value] = match;
          metadata[key.trim()] = value.trim();
        }
      });
      
      resolve(metadata);
    });
  });
}

// Helper function to generate thumbnail using ImageMagick
function generateThumbnail(imagePath, outputPath) {
  return new Promise((resolve, reject) => {
    // Fixed thumbnail size of 150x150 pixels while preserving aspect ratio
    // We use the ImageMagick resize option with ^ to ensure the image fills the dimensions
    // and then we use extent with gravity center to crop to exactly 150x150
    
    // First approach: Resize to fit within 150x150 preserving aspect ratio
    const command = `convert ${imagePath} -thumbnail 150x150 -background white -gravity center -extent 150x150 ${outputPath}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error generating thumbnail: ${error.message}`);
        return reject(error);
      }
      
      resolve(outputPath);
    });
  });
}

// Endpoint to generate thumbnail
app.post('/thumbnail', upload.single('image'), async (req, res) => {
  try {
    let imagePath;
    let tempFileCreated = false;
    
    // Handle image from URL or file upload
    if (req.body.imageUrl) {
      // Download image from URL
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `${uuidv4()}-url-image.jpg`;
      imagePath = path.join(uploadDir, fileName);
      
      await downloadImage(req.body.imageUrl, imagePath);
      tempFileCreated = true;
    } else if (req.file) {
      // Use uploaded file
      imagePath = req.file.path;
    } else {
      return res.status(400).json({ error: 'Missing imageUrl or image file' });
    }
    
    // Get metadata including original dimensions
    const metadata = await getImageMetadata(imagePath);
    
    // Generate thumbnail with fixed size 150x150
    const thumbName = `thumbnail-${path.basename(imagePath)}`;
    const thumbnailPath = path.join(path.dirname(imagePath), thumbName);
    
    await generateThumbnail(imagePath, thumbnailPath);
    
    // Read thumbnail file and convert to base64
    const thumbnailData = fs.readFileSync(thumbnailPath);
    const base64Thumbnail = thumbnailData.toString('base64');
    const thumbnailUrl = `data:image/jpeg;base64,${base64Thumbnail}`;
    
    // Also read original image and convert to base64 if not too large
    let originalImageUrl = '';
    if (metadata.originalWidth && metadata.originalHeight) {
      const originalSize = metadata.originalWidth * metadata.originalHeight;
      // Only include original image if it's not too large (less than 2 megapixels)
      if (originalSize < 2000000) {
        const originalData = fs.readFileSync(imagePath);
        const base64Original = originalData.toString('base64');
        originalImageUrl = `data:image/jpeg;base64,${base64Original}`;
      }
    }
    
    // Clean up temporary files
    if (tempFileCreated) {
      fs.unlinkSync(imagePath);
    }
    fs.unlinkSync(thumbnailPath);
    
    // Return response
    res.json({
      thumbnailUrl,
      originalImageUrl: originalImageUrl || '',
      metadata: {
        ...metadata,
        thumbnailSize: "150×150",
      }
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});