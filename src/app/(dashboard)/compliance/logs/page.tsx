import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { COMPLIANCE_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { ComplianceLogForm } from "@/components/compliance/log-form";

export default async function ComplianceLogsPage() {
  await requirePermission("compliance.view");

  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("compliance_logs")
    .select("*, users(full_name)")
    .order("recorded_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Logs</h1>
        <p className="text-sm text-gray-500">Record and track temperature, sanitation, and safety checks</p>
      </div>

      {/* Quick log form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Record New Log</h2>
        <ComplianceLogForm />
      </div>

      {/* Log history */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Log History</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(logs || []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No compliance logs recorded yet.</p>
          ) : (
            (logs || []).map((log: any) => {
              const typeInfo = COMPLIANCE_TYPES[log.type as keyof typeof COMPLIANCE_TYPES];
              return (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                      {log.type.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{typeInfo?.label || log.type}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {log.value}
                      </span>
                    </div>
                    {log.notes && <p className="text-sm text-gray-600 mt-0.5">{log.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Recorded by {log.users?.full_name || "Unknown"} on {formatDateTime(log.recorded_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
