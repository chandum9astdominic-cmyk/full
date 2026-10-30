import { ShieldCheck, FileCheck2, LockKeyhole } from "lucide-react";
import FileUploader from "./components/FileUploader";

export default function App() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck size={25} />
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">DocShield</span>
          </a>
          <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
            <LockKeyhole size={14} /> Private document workflow
          </span>
        </header>

        <section className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            <FileCheck2 size={14} /> Document privacy starts here
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Upload your documents
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
            Add PDFs or images to begin the DocShield privacy workflow. Review your files before sending them for processing.
          </p>
        </section>

        <FileUploader />

        <footer className="mt-8 flex flex-col items-center justify-center gap-2 text-center text-xs text-slate-400 sm:flex-row">
          <LockKeyhole size={13} />
          <span>Files are sent to your configured DocShield backend. Avoid uploading real sensitive documents while testing.</span>
        </footer>
      </div>
    </main>
  );
}
