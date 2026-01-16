import { useState } from 'react';
import type { RequiredByHistoryEntry } from '@/types';
import { History, ChevronDown, ChevronUp, ArrowRight, User, MessageSquare } from 'lucide-react';
import { formatDateTime, formatDate } from '@/lib/utils';

interface RequiredByHistoryProps {
  history: RequiredByHistoryEntry[] | null;
  className?: string;
}

export default function RequiredByHistory({ history, className = '' }: RequiredByHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // No history to display
  if (!history || history.length === 0) {
    return null;
  }

  // Sort history by timestamp (most recent first for display)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Show preview of most recent change when collapsed
  const latestChange = sortedHistory[0];

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header / Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Deadline History
          </span>
          <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
            {history.length} {history.length === 1 ? 'change' : 'changes'}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Collapsed Preview */}
      {!isExpanded && (
        <div className="px-3 py-2 bg-white border-t border-slate-100">
          <p className="text-xs text-slate-600">
            <span className="font-medium">{formatDate(latestChange.timestamp)}:</span>{' '}
            <span className="text-slate-500">
              Changed from {formatDate(latestChange.old_date)} to {formatDate(latestChange.new_date)}
            </span>
          </p>
        </div>
      )}

      {/* Expanded Timeline */}
      {isExpanded && (
        <div className="bg-white border-t border-slate-100">
          <div className="divide-y divide-slate-100">
            {sortedHistory.map((entry, index) => (
              <div key={index} className="px-3 py-3">
                {/* Date Change Row */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                      {formatDate(entry.old_date)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-slate-900 bg-indigo-50 px-1.5 py-0.5 rounded text-xs font-medium">
                      {formatDate(entry.new_date)}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex items-start gap-2 mb-2">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-600 italic">"{entry.reason}"</p>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {entry.changed_by_name}
                  </span>
                  <span>•</span>
                  <span>{formatDateTime(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
