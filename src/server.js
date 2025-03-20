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
    exec(`identify -verbose ${imagePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting metadata: ${error.message}`);
        return resolve({}); // Return empty object on error
      }
      
      // Parse the output to extract metadata
      const metadata = {};
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        // Extract key-value pairs
        const match = line.match(/^\s*(\w+):\s(.+)$/);
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
function generateThumbnail(imagePath, width, height, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `convert ${imagePath} -resize ${width}x${height} ${outputPath}`;
    
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
    
    // Get dimensions from request
    const width = req.body.width || 300;
    const height = req.body.height || 200;
    
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
    
    // Get metadata
    const metadata = await getImageMetadata(imagePath);
    
    // Generate thumbnail
    const thumbName = `thumbnail-${path.basename(imagePath)}`;
    const thumbnailPath = path.join(path.dirname(imagePath), thumbName);
    
    await generateThumbnail(imagePath, width, height, thumbnailPath);
    
    // Read thumbnail file and convert to base64
    const thumbnailData = fs.readFileSync(thumbnailPath);
    const base64Thumbnail = thumbnailData.toString('base64');
    const thumbnailUrl = `data:image/jpeg;base64,${base64Thumbnail}`;
    
    // Clean up temporary files
    if (tempFileCreated) {
      fs.unlinkSync(imagePath);
    }
    fs.unlinkSync(thumbnailPath);
    
    // Return response
    res.json({
      thumbnailUrl,
      metadata
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});