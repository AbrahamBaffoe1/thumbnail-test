import React, { useState, useCallback } from 'react';
import { RotateCw, ImagePlus, X, Info, ZoomIn, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Simplified versions of the missing UI components
const Button = ({ onClick, disabled, className, children, variant, ...props }) => (
    <button {...props} onClick={onClick} disabled={disabled} className={className}>
        {children}
    </button>
);
const Input = ({ id, type, placeholder, value, onChange, className, disabled, accept, ...props }) => (
    <input {...props} id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} className={className} disabled={disabled} accept={accept} />
);
const Label = ({ htmlFor, className, children, ...props }) => (
    <label {...props} htmlFor={htmlFor} className={className}>
        {children}
    </label>
);
const cn = (...args) => args.filter(Boolean).join(' ');

// Define the backend URL - adjust port if needed
const BACKEND_URL = 'http://localhost:5001/thumbnail';

const useThumbnailGenerator = () => {
    const [state, setState] = useState({
        imageUrl: '',
        imageFile: null,
        loading: false,
        thumbnailUrl: '',
        originalImageUrl: '',
        error: '',
        metadata: null,
    });

    const handleInputChange = useCallback((field, value) => {
        setState(prevState => ({
            ...prevState,
            [field]: value,
            error: '',
            thumbnailUrl: '',
            originalImageUrl: '',
            metadata: null,
        }));
    }, []);

    const generateThumbnail = useCallback(async () => {
        setState(prevState => ({ ...prevState, loading: true, error: '', metadata: null }));
        const { imageUrl, imageFile } = state;

        if (!imageUrl && !imageFile) {
            setState(prevState => ({ 
                ...prevState, 
                loading: false, 
                error: 'Please provide either an image URL or upload an image.' 
            }));
            return;
        }

        const formData = new FormData();
        
        if (imageFile) {
            formData.append('image', imageFile);
        } else if (imageUrl) {
            formData.append('imageUrl', imageUrl);
        }

        try {
            console.log('Sending request to:', BACKEND_URL);
            
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            const { thumbnailUrl, originalImageUrl, metadata } = data;

            setState(prevState => ({
                ...prevState,
                loading: false,
                thumbnailUrl: thumbnailUrl,
                originalImageUrl: originalImageUrl || (imageFile ? URL.createObjectURL(imageFile) : imageUrl),
                metadata,
            }));
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            setState(prevState => ({ 
                ...prevState, 
                loading: false, 
                error: error.message || 'Failed to generate thumbnail' 
            }));
        }
    }, [state]);

    const resetForm = () => {
        setState({
            imageUrl: '',
            imageFile: null,
            loading: false,
            thumbnailUrl: '',
            originalImageUrl: '',
            error: '',
            metadata: null,
        });
    };

    return { state, handleInputChange, generateThumbnail, resetForm };
};

const ThumbnailGenerator = () => {
    const { state, handleInputChange, generateThumbnail, resetForm } = useThumbnailGenerator();
    const { imageUrl, imageFile, loading, thumbnailUrl, originalImageUrl, error, metadata } = state;
    const [isOriginalModalOpen, setIsOriginalModalOpen] = useState(false);
    const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);

    const toggleOriginalModal = () => {
        setIsOriginalModalOpen(!isOriginalModalOpen);
    };

    const toggleThumbnailModal = () => {
        setIsThumbnailModalOpen(!isThumbnailModalOpen);
    };

    const renderMetadata = (data) => {
        if (!data || Object.keys(data).length === 0) {
            return <p className="text-gray-400">No metadata available.</p>;
        }

        // Sort metadata to show important info first
        const sortedEntries = Object.entries(data).sort(([keyA], [keyB]) => {
            const priorityKeys = ['originalSize', 'thumbnailSize', 'originalWidth', 'originalHeight', 'aspectRatio'];
            const priorityA = priorityKeys.indexOf(keyA);
            const priorityB = priorityKeys.indexOf(keyB);
            
            if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
            if (priorityA !== -1) return -1;
            if (priorityB !== -1) return 1;
            return keyA.localeCompare(keyB);
        });

        return (
            <div className="space-y-2">
                {sortedEntries.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-4">
                        <span className="text-gray-300 font-medium break-words">{key}:</span>
                        <span className="text-gray-200 break-words">{String(value)}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col items-center justify-start pt-12">
            <div className="max-w-4xl w-full p-6 bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-800 space-y-8">
                <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                    Thumbnail Generator
                </h1>
                
                <div className="text-center text-lg text-gray-300">
                    <p>Generate perfect 150×150 thumbnails from any image.</p>
                    <p className="text-sm mt-1 text-gray-400">Thumbnails are automatically resized and cropped to maintain perfect proportions.</p>
                </div>

                {/* Input Section */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="imageUrl" className="text-gray-300 text-lg flex items-center gap-2">
                            <ImagePlus className="w-5 h-5" />
                            Image URL
                        </Label>
                        <Input
                            id="imageUrl"
                            type="text"
                            placeholder="Enter image URL"
                            value={imageUrl}
                            onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                            className="bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-400 text-base"
                            disabled={!!imageFile}
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="imageFile" className="text-gray-300 text-lg flex items-center gap-2">
                            <ImagePlus className="w-5 h-5" />
                            Upload Image
                        </Label>
                        <Input
                            id="imageFile"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleInputChange('imageFile', e.target.files ? e.target.files[0] : null)}
                            className="bg-gray-800/80 border-gray-700 text-white file:bg-gray-700 file:text-gray-300 file:border-gray-600 file:rounded-md file:mr-6 file:px-5 file:py-3 text-base"
                            disabled={!!imageUrl}
                        />
                    </div>
                </div>

                {/* Generate and Reset Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button
                        onClick={generateThumbnail}
                        disabled={loading}
                        className={cn(
                            "bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-4 rounded-full text-lg",
                            "shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "flex items-center gap-3 w-full sm:w-auto justify-center"
                        )}
                    >
                        {loading ? (
                            <>
                                <RotateCw className="animate-spin w-6 h-6" />
                                Generating...
                            </>
                        ) : (
                            "Generate Thumbnail"
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={resetForm}
                        disabled={loading}
                        className={cn(
                            "bg-gray-800/80 hover:bg-gray-700 text-gray-300 border-gray-700 px-8 py-3 rounded-full text-lg",
                            "transition-colors duration-200 w-full sm:w-auto"
                        )}
                    >
                        Reset
                    </Button>
                </div>

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-center bg-red-900/50 p-4 rounded-xl border border-red-700 text-base"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Thumbnail and Original Image Preview */}
                <AnimatePresence>
                    {thumbnailUrl && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mt-8 space-y-6"
                        >
                            {/* Thumbnail with 150x150 border to show exact dimensions */}
                            <div className="text-center">
                                <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center justify-center gap-2">
                                    <ImagePlus className="w-6 h-6" />
                                    Thumbnail Preview (150×150)
                                </h2>
                                <div className="flex justify-center">
                                    <div className="relative inline-block">
                                        <div className="h-[150px] w-[150px] flex items-center justify-center border-2 border-blue-500 rounded-xl overflow-hidden group">
                                            <img
                                                src={thumbnailUrl}
                                                alt="Generated Thumbnail"
                                                className="max-w-full max-h-full transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Button
                                                    onClick={toggleThumbnailModal}
                                                    className="bg-black bg-opacity-60 text-white p-2 rounded-full"
                                                >
                                                    <ZoomIn className="w-6 h-6" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="absolute -top-2 -right-2 bg-blue-500 text-xs text-white px-2 py-1 rounded-full">
                                            150×150
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Original Image with click to zoom */}
                            {originalImageUrl && (
                                <div className="text-center">
                                    <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center justify-center gap-2">
                                        <ImagePlus className="w-6 h-6" />
                                        Original Image
                                        {metadata && metadata.originalSize && (
                                            <span className="text-sm bg-gray-700 px-3 py-1 rounded-full ml-2">
                                                {metadata.originalSize}
                                            </span>
                                        )}
                                    </h2>
                                    <div className="flex justify-center">
                                        <div className="relative group max-w-md">
                                            <img
                                                src={originalImageUrl}
                                                alt="Original"
                                                className="max-w-full h-auto rounded-xl shadow-xl border border-gray-700 transition-transform duration-300 group-hover:scale-[1.02]"
                                                style={{ maxHeight: '400px' }}
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-xl">
                                                <Button
                                                    onClick={toggleOriginalModal}
                                                    className="bg-black bg-opacity-60 text-white p-3 rounded-full"
                                                >
                                                    <Maximize2 className="w-6 h-6" />
                                                </Button>
                                            </div>
                                            <div className="absolute bottom-3 right-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                                <ZoomIn className="w-4 h-4" />
                                                Click to view full size
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Metadata Display */}
                {metadata && Object.keys(metadata).length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center gap-2">
                            <Info className="w-6 h-6" />
                            Image Metadata
                        </h2>
                        <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 max-h-96 overflow-y-auto">
                            {renderMetadata(metadata)}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Original Image */}
            <AnimatePresence>
                {isOriginalModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                        onClick={toggleOriginalModal}
                    >
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className="relative max-h-screen max-w-screen overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative">
                                <img
                                    src={originalImageUrl}
                                    alt="Full Size Original"
                                    className="rounded-xl shadow-2xl border border-gray-700"
                                    style={{ maxHeight: '90vh', maxWidth: '90vw' }}
                                />
                                <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg z-10">
                                    {metadata && metadata.originalSize ? (
                                        <span>Original Size: {metadata.originalSize}</span>
                                    ) : (
                                        <span>Original Image</span>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={toggleOriginalModal}
                                    className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors duration-200 shadow-md"
                                    title="Close"
                                >
                                    <X className="w-6 h-6" />
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal for Thumbnail */}
            <AnimatePresence>
                {isThumbnailModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                        onClick={toggleThumbnailModal}
                    >
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative p-8 bg-gray-800/50 rounded-xl backdrop-blur-sm">
                                <img
                                    src={thumbnailUrl}
                                    alt="Thumbnail Preview"
                                    className="rounded-lg shadow-2xl border-2 border-blue-400"
                                />
                                <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-lg z-10">
                                    150×150 Thumbnail
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={toggleThumbnailModal}
                                    className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors duration-200 shadow-md"
                                    title="Close"
                                >
                                    <X className="w-6 h-6" />
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ThumbnailGenerator;