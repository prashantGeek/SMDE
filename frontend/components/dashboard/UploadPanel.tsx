import { RefreshCw, UploadCloud } from "lucide-react";
import { UploadMode } from "../../lib/dashboardTypes";

type UploadPanelProps = {
  sessionId: string | null;
  mode: UploadMode;
  isUploading: boolean;
  processingSessionId: string | null;
  onModeChange: (value: UploadMode) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

export default function UploadPanel({
  sessionId,
  mode,
  isUploading,
  processingSessionId,
  onModeChange,
  onFileUpload,
}: UploadPanelProps) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">
            {sessionId ? "Upload to current candidate" : "Start a new candidate"}
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Drop a new document to automatically append it</p>
        </div>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as UploadMode)}
          className="bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-blue-400 transition-colors"
        >
          <option value="sync">Sync Mode</option>
          <option value="async">Async Mode</option>
        </select>
      </div>

      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all">
        <div className="flex flex-col items-center justify-center">
          {isUploading ? (
            <RefreshCw className="w-8 h-8 text-blue-500 mb-3 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-blue-500 mb-3" />
          )}
          <span className="text-base text-blue-700 font-bold">{isUploading ? "Uploading..." : "Select File (PDF/Image)"}</span>
        </div>
        <input
          type="file"
          className="hidden"
          onChange={onFileUpload}
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={isUploading || (processingSessionId === sessionId && sessionId !== null)}
        />
      </label>

      {processingSessionId === sessionId && sessionId !== null && (
        <div className="flex items-center justify-center gap-3 p-4 bg-indigo-50 border border-indigo-200 shadow-sm rounded-xl mt-4">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-indigo-800 font-bold text-sm tracking-wide">Processing Document Async... This may take a few seconds.</span>
        </div>
      )}
    </div>
  );
}
