import { useState, useCallback } from 'react';
import axios from 'axios';

interface ResumeUploadProps {
  submissionId: string;
  userId: string;
  campaignId: string;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ submissionId, userId, campaignId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleFile = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF, DOC, or DOCX file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size should be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('resume', file);
      formData.append('user_id', userId);
      formData.append('submission_id', submissionId);
      formData.append('position_id', campaignId);

      await axios.post('/api/upload_resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadSuccess(true);
      setFile(null);
    } catch (err) {
      setError('Failed to upload resume. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          id="resume-upload"
        />
        <label
          htmlFor="resume-upload"
          className="cursor-pointer block"
        >
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
            <div className="flex text-sm text-gray-600">
              <span className="relative rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                Upload a file
              </span>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">
              PDF, DOC, DOCX up to 5MB
            </p>
          </div>
        </label>
      </div>

      {file && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-red-600 hover:text-red-500"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {uploadSuccess && (
        <div className="text-sm text-green-600">
          Resume uploaded successfully!
        </div>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || isUploading}
        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          !file || isUploading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
      >
        {isUploading ? 'Uploading...' : 'Upload Resume'}
      </button>
    </div>
  );
};

export default ResumeUpload; 
