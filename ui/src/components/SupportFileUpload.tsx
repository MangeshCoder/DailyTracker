import { useRef, useState } from "react";

interface UploadProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  uploadProgress: number;
}

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const SupportFileUpload = ({
  files,
  setFiles,
  uploadProgress,
}: UploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = (file: File) => {
    if (files.length >= MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed.`);
      return false;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB}MB.`);
      return false;
    }

    if (!ALLOWED_TYPES.some((type) => file.type.startsWith(type))) {
      setError("Unsupported file type.");
      return false;
    }

    return true;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = Array.from(newFiles).filter(validateFile);

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      setError("");
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return "🖼️";
    if (file.type.includes("pdf")) return "📕";
    if (file.type.includes("word")) return "📘";
    return "📎";
  };

  return (
    <div className="col-span-2">

      {/* Drag Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition
          ${dragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-slate-700 bg-slate-800 hover:bg-slate-700"
          }`}
      >
        <p className="text-sm text-slate-300">
          Drag & Drop files or <span className="text-violet-400">Browse</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Max {MAX_FILES} files · {MAX_SIZE_MB}MB each
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3"
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  onClick={() => setPreview(URL.createObjectURL(file))}
                  className="w-12 h-12 object-cover rounded-lg border border-slate-600 cursor-pointer"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-slate-700 rounded-lg text-lg">
                  {getFileIcon(file)}
                </div>
              )}

              <div className="flex-1">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>

                {/* Real Upload Progress */}
                {uploadProgress > 0 && (
                  <div className="mt-2 h-1 bg-slate-700 rounded">
                    <div
                      className="h-1 bg-violet-500 rounded transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => removeFile(index)}
                className="text-slate-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Preview */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >
          <img
            src={preview}
            className="max-h-[80vh] max-w-[80vw] rounded-xl"
          />
        </div>
      )}
    </div>
  );
};