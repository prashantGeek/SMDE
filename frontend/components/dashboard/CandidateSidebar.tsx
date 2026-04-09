import { Clock, Plus, Trash2, User } from "lucide-react";
import { SessionSummary } from "../../lib/dashboardTypes";

type CandidateSidebarProps = {
  sessions: SessionSummary[];
  sessionId: string | null;
  onCreateNewUser: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
};

export default function CandidateSidebar({
  sessions,
  sessionId,
  onCreateNewUser,
  onSelectSession,
  onDeleteSession,
}: CandidateSidebarProps) {
  return (
    <aside className="w-85 bg-white border-r border-gray-200 h-screen flex flex-col shrink-0 sticky top-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-900 text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="text-blue-300 w-6 h-6" /> Candidates Directory
        </h2>
      </div>

      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <button
          onClick={onCreateNewUser}
          className="w-full py-3 px-4 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl border-2 border-blue-200 flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" /> Create New Candidate
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {sessions.length === 0 ? (
          <div className="text-center text-sm text-gray-400 mt-4">No candidates yet</div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`group p-4 rounded-xl cursor-pointer border-2 transition-all relative ${
                sessionId === s.id
                  ? "border-blue-500 bg-white shadow-md transform scale-[1.02]"
                  : "border-transparent bg-white shadow-sm hover:border-blue-200"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="font-bold text-gray-800 truncate text-base pr-2">{s.candidateName}</div>
                <button
                  onClick={(e) => onDeleteSession(s.id, e)}
                  title="Delete Candidate"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-wider bg-blue-50 inline-block px-2 py-0.5 rounded">
                {s.role}
              </div>
              <div className="text-xs text-gray-400 mt-3 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" /> {(new Date(s.createdAt)).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
