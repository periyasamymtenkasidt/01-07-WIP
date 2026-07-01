import React, { useState, useRef } from "react";
import { FiPlus, FiAlertCircle, FiLoader } from "react-icons/fi";
import { storeFile } from "../../../utils/fileStorage";

export default function ReusableFileUploader({
  allowedTypes = [],
  maxSizeMB = 50,
  onUploadSuccess,
  multiple = false,
  uploadedBy = "Alex Sterling",
  buttonText = "Upload Files",
  className = ""
}) {
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const validateAndUpload = (files) => {
    setErrorMsg("");
    const validFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split(".").pop().toUpperCase();
      const fileSizeMB = file.size / (1024 * 1024);

      // Validate type
      if (allowedTypes.length > 0 && !allowedTypes.map(t => t.toUpperCase()).includes(extension)) {
        setErrorMsg(`Unsupported file type: .${extension.toLowerCase()}. Supported: ${allowedTypes.join(", ")}`);
        return;
      }

      // Validate size
      if (fileSizeMB > maxSizeMB) {
        setErrorMsg(`File size exceeds limit of ${maxSizeMB}MB (Selected file: ${fileSizeMB.toFixed(1)}MB)`);
        return;
      }

      validFiles.push(file);
      if (!multiple) break; // If not multiple, only take the first valid file
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Process each valid file (simplified single-file progress or batch upload)
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 20;
      setUploadProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        
        for (const file of validFiles) {
          let fileUrl = "";
          try {
            fileUrl = URL.createObjectURL(file);
          } catch (e) {
            console.error("Failed to create object URL:", e);
            fileUrl = "/survey_living_room.png"; // Fallback placeholder
          }

          const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          
          // Persist file in IndexedDB
          await storeFile(fileId, file);
          await storeFile(`${fileId}-V1`, file);

          const fileExtension = file.name.split(".").pop().toUpperCase();
          const uploadedFileObject = {
            id: fileId,
            name: file.name,
            type: fileExtension,
            uploadedBy: uploadedBy,
            uploadedDate: new Date().toLocaleDateString("en-IN"),
            version: "V1",
            size: file.size,
            url: fileUrl,
            versions: [
              {
                version: "V1",
                name: file.name,
                url: fileUrl,
                uploadedBy: uploadedBy,
                uploadDate: new Date().toLocaleDateString("en-IN"),
                fileSize: formatBytes(file.size),
                size: file.size
              }
            ]
          };

          if (onUploadSuccess) {
            onUploadSuccess(uploadedFileObject);
          }
        }

        setIsUploading(false);
        setUploadProgress(0);
      }
    }, 150);
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files);
    }
  };

  const onButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`inline-flex flex-col items-end gap-1.5 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        accept={allowedTypes.map((ext) => `.${ext.toLowerCase()}`).join(",")}
      />

      <button
        type="button"
        onClick={onButtonClick}
        disabled={isUploading}
        className="flex items-center gap-1.5 bg-linear-to-r from-select-blue to-dark-blue text-white rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer hover:shadow-select-blue/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <FiLoader className="animate-spin" size={13} />
            <span>Uploading ({uploadProgress}%)</span>
          </>
        ) : (
          <>
            <FiPlus size={13} />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold mt-1">
          <FiAlertCircle size={12} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
