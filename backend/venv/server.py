from flask import Flask, request, jsonify, send_file
from flask_cors import CORS  # Import CORS
from PIL import Image
from PIL.ExifTags import TAGS
import io
import os
from urllib.request import urlopen
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Directory to store uploaded images and thumbnails
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Create the directory if it doesn't exist
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


def get_image_metadata(image_path):
    """
    Extracts metadata from an image using PIL.
    Handles both local file paths and URLs.
    """
    try:
        if image_path.startswith('http://') or image_path.startswith('https://'):
            # Handle URLs
            image_stream = urlopen(image_path)
            img = Image.open(image_stream)
        else:
            # Handle local file paths
            img = Image.open(image_path)

        exif_data = img._getexif()
        if exif_data is None:
            return {}

        metadata = {}
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            # Decode bytes values to strings
            if isinstance(value, bytes):
                try:
                    value = value.decode()
                except UnicodeDecodeError:
                    value = str(value)  # If decoding fails, use the raw bytes representation
            metadata[tag] = value
        return metadata
    except Exception as e:
        print(f"Error extracting metadata: {e}")
        return {}  # Return empty dict on error, so it does not break the flow


def generate_thumbnail(image_path, width, height):
    """
    Generates a thumbnail from an image using PIL.
    Handles both local file paths and URLs.

    Args:
        image_path (str): Path to the image (local or URL).
        width (int): Width of the thumbnail.
        height (int): Height of the thumbnail.

    Returns:
        io.BytesIO: A BytesIO object containing the thumbnail image data.
    """
    try:
        if image_path.startswith('http://') or image_path.startswith('https://'):
            # Handle URLs
            image_stream = urlopen(image_path)
            img = Image.open(image_stream)
        else:
            # Handle local file paths
            img = Image.open(image_path)

        img.thumbnail((width, height))
        thumbnail_io = io.BytesIO()
        img.save(thumbnail_io, 'JPEG')  # Save as JPEG
        thumbnail_io.seek(0)  # Reset the stream position to the beginning
        return thumbnail_io
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return None


@app.route('/thumbnail', methods=['GET', 'POST'])
def thumbnail():
    """
    Endpoint to generate a thumbnail.  Handles both URL and file uploads.
    Returns JSON containing thumbnail URL and metadata.
    """
    width = int(request.form.get('width', 100))
    height = int(request.form.get('height', 100))

    if 'imageUrl' in request.form:
        image_url = request.form['imageUrl']
        try:
            # Download the image
            image_stream = urlopen(image_url)
            img = Image.open(image_stream)
            # Save the image to a temporary file
            temp_filename = secure_filename(os.path.basename(image_url))
            temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
            img.save(temp_filepath)  # Save the image
            image_path = temp_filepath
        except Exception as e:
            return jsonify({'error': f'Error downloading image from URL: {e}'}), 400
    elif 'image' in request.files:
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        image_file.save(image_path)
    else:
        return jsonify({'error': 'Missing imageUrl or image file'}), 400

    thumbnail_io = generate_thumbnail(image_path, width, height)
    if thumbnail_io is None:
        return jsonify({'error': 'Failed to generate thumbnail'}), 500

    metadata = get_image_metadata(image_path)

    # Need to generate a URL for the thumbnail.  For simplicity, we'll return a data URL.
    import base64
    thumbnail_base64 = base64.b64encode(thumbnail_io.getvalue()).decode('utf-8')
    thumbnail_url = f"data:image/jpeg;base64,{thumbnail_base64}"  # Construct data URL

    # Clean up the temporary file if it was downloaded
    if 'temp_filepath' in locals():
        try:
            os.remove(temp_filepath)
        except Exception as e:
            print(f"Error deleting temporary file: {e}")

    return jsonify({
        'thumbnailUrl': thumbnail_url,
        'metadata': metadata
    })



if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)