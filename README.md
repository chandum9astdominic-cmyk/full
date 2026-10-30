# DocShield File Uploader

A reusable React + TypeScript file-upload interface for DocShield.

## Features

- Drag and drop or browse for PDF, PNG, JPG and JPEG files
- Multiple file selection (up to 10 files)
- Image thumbnails and PDF file previews
- Remove files before uploading
- File type and size validation (10 MB per selected file)
- Upload progress and per-file success/error states
- Converts each image into a one-page PDF with `pdf-lib`
- Sends each PDF to the existing DocShield `POST /api/upload` endpoint

## Requirements

- Node.js 20+
- DocShield backend running on port 3000 (unless configured otherwise)

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Backend connection

By default, Vite proxies `/api` requests to `http://localhost:3000`.

If your backend runs elsewhere, create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000
```

The frontend sends multipart form data using the field name `file` to `/api/upload`.

## Integrate into another React app

The main reusable component is:

`src/components/FileUploader.tsx`

Install its dependencies in your app:

```bash
npm install react-dropzone pdf-lib lucide-react
```

Copy the component and the styles it uses from `src/index.css`. Set `VITE_API_BASE_URL` to your DocShield backend URL, or configure a development proxy.

## Important

This is an upload UI, not a guarantee that a document has been safely redacted. The backend must perform detection, redaction and verification before a protected document is treated as safe.
