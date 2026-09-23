import { SupportLog } from "../types";
import { SupportMediaDisplay } from "../components/SupportMediaDisplay";

interface Props {
  logs: SupportLog[];
  onDelete: (id: number) => void;
}

type SupportType =
  | "Technical"
  | "CodeReview"
  | "Debugging"
  | "Deployment"
  | "Other";

const columns: SupportType[] = [
  "Technical",
  "CodeReview",
  "Debugging",
  "Deployment",
  "Other",
];

const columnColors: Record<SupportType, string> = {
  Technical: "from-blue-600 to-indigo-600",
  CodeReview: "from-purple-600 to-pink-600",
  Debugging: "from-red-600 to-orange-600",
  Deployment: "from-emerald-600 to-teal-600",
  Other: "from-slate-600 to-slate-700",
};

const formatISTTime = (dateString?: string) => {
  if (!dateString) return "--:--";

  // Force treat backend time as UTC
  const utcDate = new Date(dateString + "Z");

  return utcDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

export const SupportKanbanBoard = ({ logs, onDelete }: Props) => {
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m`;
  };

  return (
<div className="pb-4">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">

        {columns.map((column) => {
          const columnLogs = logs.filter(
            (l) => l.supportType === column
          );

          const totalMinutes = columnLogs.reduce(
            (sum, l) => sum + l.timeSpentMinutes,
            0
          );

          return (
            <div
              key={column}
              className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-lg"
            >
              {/* Column Header */}
              <div
                className={`bg-gradient-to-r ${columnColors[column]} rounded-t-2xl p-4 sticky top-0 z-10`}
              >
                <h3 className="text-white font-semibold text-sm tracking-wide">
                  {column}
                </h3>
                <p className="text-white/80 text-xs mt-1">
                  {columnLogs.length} logs · {formatTime(totalMinutes)}
                </p>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-3 overflow-y-auto max-h-[65vh]">

                {columnLogs.length === 0 ? (
                  <div className="text-xs text-slate-600 italic text-center py-6">
                    🚀 No support logs yet
                  </div>
                ) : (
                  columnLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-800 rounded-xl p-4 text-sm hover:bg-slate-700 transition-all duration-200 group border border-transparent hover:border-slate-600"
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-white font-medium truncate">
                          👤 {log.supportedDeveloperName}
                        </p>

                        <button
                          onClick={() => onDelete(log.id)}
                          className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Issue */}
                      <p className="text-slate-400 text-xs mb-3 line-clamp-3">
                        {log.issueDescription}
                      </p>

                      {/* Resolution */}
                      {log.resolution && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-2 py-1 text-xs mb-3">
                          ✔ {log.resolution}
                        </div>
                      )}

                      {/* Media */}
                      {log.media && log.media.length > 0 && (
                        <div className="mb-3">
                          <SupportMediaDisplay media={log.media} />
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex justify-between items-center text-xs mt-2">
                        <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-md">
                          ⏱ {formatTime(log.timeSpentMinutes)}
                        </span>

                        <span className="text-slate-500">
                            {formatISTTime(log.supportedAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}

              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
};