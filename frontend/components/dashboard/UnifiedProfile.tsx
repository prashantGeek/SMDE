import { AlertCircle } from "lucide-react";
import { DocumentFlag, DocumentRecord } from "../../lib/dashboardTypes";

type UnifiedProfileProps = {
  documents: DocumentRecord[];
  detectedRole: string;
};

type SeafarerProfile = {
  name: string;
  dob: string;
  nationality: string;
  sirb: string;
  role: string;
};

const buildSeafarerProfile = (documents: DocumentRecord[], detectedRole: string): SeafarerProfile => ({
  name: documents.find((d) => d.holderName)?.holderName || "-",
  dob: documents.find((d) => d.dateOfBirth)?.dateOfBirth || "-",
  nationality: documents.find((d) => d.nationality)?.nationality || "-",
  sirb: documents.find((d) => d.sirbNumber)?.sirbNumber || "-",
  role:
    detectedRole !== "UNKNOWN"
      ? detectedRole
      : documents.find((d) => d.applicableRole && d.applicableRole !== "N/A")?.applicableRole || "-",
});

const hasNameMismatch = (documents: DocumentRecord[], expectedName: string): boolean =>
  documents.some((d) => d.holderName && d.holderName !== expectedName);

export const isDocExpired = (d: DocumentRecord): boolean => {
  if (d.isExpired) return true;
  if (d.validity?.isExpired) return true;
  if (d.validity?.daysUntilExpiry !== null && d.validity?.daysUntilExpiry !== undefined && d.validity?.daysUntilExpiry <= 0) return true;
  if (d.flags?.some((f: DocumentFlag) => f.message?.toLowerCase().includes("expired"))) return true;
  return false;
};

export const getCriticalIssues = (documents: DocumentRecord[]): string[] => {
  const issues: string[] = [];
  documents.forEach((doc) => {
    if (isDocExpired(doc)) issues.push(`[${doc.documentType}] Document is expired`);
    doc.flags?.forEach((flag: DocumentFlag) => {
      if (flag.severity === "CRITICAL") {
        issues.push(`[${doc.documentType}] ${flag.message}`);
      }
    });
  });
  return issues;
};

export default function UnifiedProfile({ documents, detectedRole }: UnifiedProfileProps) {
  const seafarer = buildSeafarerProfile(documents, detectedRole);
  const nameMismatch = hasNameMismatch(documents, seafarer.name);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h2 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide flex items-center gap-2">👤 Candidate Unified Profile</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gray-50 border border-gray-100 p-2 rounded shadow-sm md:col-span-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Full Legal Name</span>
          <span className="font-extrabold text-gray-900 text-sm">{seafarer.name}</span>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2 rounded shadow-sm">
          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Target Role</span>
          <span className="font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded inline-block text-xs">{seafarer.role}</span>
        </div>
        <div className="p-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Date of Birth</span>
          <span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.dob}</span>
        </div>
        <div className="p-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Nationality</span>
          <span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.nationality}</span>
        </div>
        <div className="p-1 md:col-span-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">SIRB Identity Number</span>
          <span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.sirb}</span>
        </div>
      </div>

      {nameMismatch && (
        <div className="mt-3 text-amber-800 bg-amber-50 p-2 rounded text-xs font-bold flex items-center gap-2 border border-amber-200 shadow-sm">
          <AlertCircle className="w-4 h-4" /> Name mismatch detected deeply across different documents!
        </div>
      )}
    </div>
  );
}
