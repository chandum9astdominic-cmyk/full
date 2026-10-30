import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import {
  AlertCircle, CheckCircle2, CloudUpload, FileImage, FileText, LoaderCircle,
  ShieldCheck, Trash2, Upload, X
} from "lucide-react";

type UploadStatus = "ready" | "uploading" | "success" | "error";
type UploadItem = {
  id: string;
  file: File;
  previewUrl?: string;
  status: UploadStatus;
  progress: number;
  message?: string;
  documentId?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"]
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function isImage(file: File) {
  return file.type === "image/png" || file.type === "image/jpeg";
}

async function imageToPdf(file: File): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.create();
  const image = file.type === "image/png"
    ? await pdf.embedPng(bytes)
    : await pdf.embedJpg(bytes);

  const maxDimension = 14400;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const page = pdf.addPage([image.width * scale, image.height * scale]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width * scale,
    height: image.height * scale
  });

  const pdfBytes = await pdf.save();
  return new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
}

function uploadPdf(file: File | Blob, filename: string, onProgress: (value: number) => void) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const endpoint = `${baseUrl}/api/upload`;

  return new Promise<any>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file, filename);

    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let response: any = {};
      try { response = JSON.parse(request.responseText); } catch { /* backend may return non-JSON */ }
      if (request.status >= 200 && request.status < 300) resolve(response);
      else reject(new Error(response.message || response.error || `Upload failed (HTTP ${request.status})`));
    };
    request.onerror = () => reject(new Error("Network error. Check that the DocShield backend is running."));
    request.onabort = () => reject(new Error("Upload was cancelled."));
    request.send(formData);
  });
}

export default function FileUploader() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, [items]);

  const addFiles = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setNotice("");
    if (rejections.length) {
      const reasons = rejections.map((rejection) => {
        const tooLarge = rejection.errors.some((error) => error.code === "file-too-large");
        return tooLarge ? `${rejection.file.name} is larger than 10 MB` : `${rejection.file.name}: unsupported file`;
      });
      setNotice(reasons.join(" · "));
    }

    setItems((current) => {
      const available = Math.max(0, MAX_FILES - current.length);
      const additions = accepted.slice(0, available).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: isImage(file) ? URL.createObjectURL(file) : undefined,
        status: "ready" as UploadStatus,
        progress: 0
      }));
      if (accepted.length > available) setNotice(`Only ${MAX_FILES} files can be queued at once.`);
      return [...current, ...additions];
    });
  }, []);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    addFiles(accepted, rejections);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    multiple: true,
    noClick: true,
    noKeyboard: true
  });

  const readyCount = useMemo(() => items.filter((item) => item.status === "ready" || item.status === "error").length, [items]);
  const successCount = useMemo(() => items.filter((item) => item.status === "success").length, [items]);

  const removeItem = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const uploadOne = async (item: UploadItem) => {
    updateItem(item.id, { status: "uploading", progress: 0, message: undefined });
    try {
      let pdfFile: File | Blob = item.file;
      let filename = item.file.name;
      if (isImage(item.file)) {
        pdfFile = await imageToPdf(item.file);
        filename = item.file.name.replace(/\.(png|jpe?g)$/i, "") + ".pdf";
      }

      if (pdfFile.size > MAX_FILE_SIZE) {
        throw new Error("The generated PDF is larger than the backend's 10 MB upload limit.");
      }

      const response = await uploadPdf(pdfFile, filename, (progress) => {
        updateItem(item.id, { progress });
      });

      const documentId = response.documentId || response.document_id || response.id;
      updateItem(item.id, {
        status: "success",
        progress: 100,
        documentId: documentId ? String(documentId) : undefined,
        message: documentId ? `Uploaded · ID: ${documentId}` : "Uploaded successfully"
      });
    } catch (error) {
      updateItem(item.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong"
      });
    }
  };

  const uploadAll = async () => {
    const queue = items.filter((item) => item.status === "ready" || item.status === "error");
    for (const item of queue) {
      await uploadOne(item);
    }
  };

  const clearCompleted = () => {
    setItems((current) => {
      current.filter((item) => item.status === "success").forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return current.filter((item) => item.status !== "success");
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-7">
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed px-5 py-12 text-center transition ${isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50/70 hover:border-blue-400"}`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <CloudUpload size={29} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          {isDragActive ? "Drop your documents here" : "Drag and drop your documents"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">or choose files from your device</p>
        <button type="button" onClick={open} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
          <Upload size={16} /> Browse files
        </button>
        <p className="mt-5 text-xs text-slate-400">PDF, PNG, JPG or JPEG · Up to 10 MB each · Maximum 10 files</p>
      </div>

      {notice && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" /> {notice}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Selected files <span className="ml-1 text-sm font-normal text-slate-400">({items.length}/{MAX_FILES})</span></h3>
          <p className="mt-1 text-xs text-slate-500">Images are converted into PDF before upload.</p>
        </div>
        {successCount > 0 && (
          <button onClick={clearCompleted} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Clear uploaded</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Your selected files will appear here.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 sm:gap-4 sm:p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-500">
                {item.previewUrl
                  ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  : item.file.type === "application/pdf" ? <FileText size={23} className="text-rose-500" /> : <FileImage size={23} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="max-w-full truncate text-sm font-semibold text-slate-800">{item.file.name}</p>
                  {item.status === "success" && <CheckCircle2 size={15} className="text-emerald-600" />}
                  {item.status === "error" && <AlertCircle size={15} className="text-rose-500" />}
                  {item.status === "uploading" && <LoaderCircle size={15} className="animate-spin text-blue-600" />}
                </div>
                <p className="mt-1 text-xs text-slate-400">{formatBytes(item.file.size)} · {item.file.type === "application/pdf" ? "PDF document" : "Image"}</p>
                {(item.status === "uploading" || item.status === "success") && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.message && <p className={`mt-1 break-words text-xs ${item.status === "error" ? "text-rose-600" : "text-emerald-700"}`}>{item.message}</p>}
              </div>
              {item.status !== "uploading" && (
                <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                  {item.status === "success" ? <X size={17} /> : <Trash2 size={17} />}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} /> Uploads go to your DocShield API.</p>
        <button
          onClick={uploadAll}
          disabled={readyCount === 0 || items.some((item) => item.status === "uploading")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CloudUpload size={17} /> Upload {readyCount > 0 ? `${readyCount} file${readyCount > 1 ? "s" : ""}` : "files"}
        </button>
      </div>
    </section>
  );
}
