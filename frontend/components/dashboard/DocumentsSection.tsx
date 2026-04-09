import { RefreshCw, ShieldAlert } from "lucide-react";
import DocumentCard from "../DocumentCard";
import { DocumentRecord } from "../../lib/dashboardTypes";

type DocumentsSectionProps = {
  documents: DocumentRecord[];
  isValidating: boolean;
  onValidate: () => Promise<void>;
};

export default function DocumentsSection({ documents, isValidating, onValidate }: DocumentsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200 mt-4">
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">📄 Documents ({documents.length})</h2>
        <button
          onClick={onValidate}
          disabled={isValidating || documents.length < 2}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {isValidating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
          Run Compliance
        </button>
      </div>

      <div className="space-y-6 mt-4">
        {documents.map((doc, i) => (
          <DocumentCard key={i} doc={doc} />
        ))}
      </div>
    </div>
  );
}
