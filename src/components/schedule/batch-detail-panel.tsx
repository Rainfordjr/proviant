"use client";

import { cn, formatDate } from "@/lib/utils";
import { BATCH_STATUSES, SCHEDULE_PRIORITIES } from "@/lib/constants";
import { X, Package, Calendar, Clock, User, Wrench, ShoppingBag } from "lucide-react";
import { StatusWorkflow } from "./status-workflow";
import type { Batch, Equipment, User as UserType } from "@/types";


interface BatchDetailPanelProps {
  batch: Batch;
  equipment: Equipment[];
  onClose: () => void;
  onUpdated?: () => void;
}

export function BatchDetailPanel({
  batch,
  equipment,
  onClose,
  onUpdated,
}: BatchDetailPanelProps) {
  const status = BATCH_STATUSES[batch.status] || BATCH_STATUSES.planned;
  const priority = SCHEDULE_PRIORITIES[batch.priority || "normal"];

  // Find equipment assigned to this batch
  const assignedEquipment = (batch.resource_assignments || [])
    .filter((ra) => ra.resource_type === "equipment" && ra.equipment)
    .map((ra) => ra.equipment!);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900 truncate">
          {batch.batch_number}
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status & Priority */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", status.color)}>
            {status.label}
          </span>
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", priority.color)}>
            {priority.label} priority
          </span>
        </div>

        {/* Status transitions */}
        <StatusWorkflow batch={batch} onUpdated={onUpdated} />

        {/* Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Details
          </h4>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-gray-600">
              <Package size={16} className="mt-0.5 shrink-0 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs">Product</span>
                <div className="font-medium text-gray-900">
                  {batch.product?.name || "Unassigned"}
                </div>
              </div>
            </div>

            {batch.recipes && (
              <div className="flex items-start gap-2 text-gray-600">
                <Package size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="text-gray-400 text-xs">Recipe</span>
                  <div className="font-medium text-gray-900">
                    {batch.recipes.name}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-gray-600">
              <Calendar size={16} className="mt-0.5 shrink-0 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs">Scheduled Date</span>
                <div className="font-medium text-gray-900">
                  {batch.scheduled_date ? formatDate(batch.scheduled_date) : "Not scheduled"}
                </div>
              </div>
            </div>

            {batch.quantity_produced && (
              <div className="flex items-start gap-2 text-gray-600">
                <Package size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="text-gray-400 text-xs">Quantity</span>
                  <div className="font-medium text-gray-900">{batch.quantity_produced}</div>
                </div>
              </div>
            )}

            {batch.estimated_duration_hours && (
              <div className="flex items-start gap-2 text-gray-600">
                <Clock size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="text-gray-400 text-xs">Est. Duration</span>
                  <div className="font-medium text-gray-900">{batch.estimated_duration_hours} hours</div>
                </div>
              </div>
            )}

            {batch.assigned_user && (
              <div className="flex items-start gap-2 text-gray-600">
                <User size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="text-gray-400 text-xs">Assigned To</span>
                  <div className="font-medium text-gray-900">{batch.assigned_user.full_name}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product allocations */}
        {(batch.product_allocations || []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Product Allocation
            </h4>
            <div className="space-y-1">
              {(batch.product_allocations || []).map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <ShoppingBag size={14} className="text-gray-400" />
                    {alloc.product?.name || "Unknown product"}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {alloc.quantity} {alloc.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipment */}
        {assignedEquipment.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Equipment
            </h4>
            <div className="space-y-1">
              {assignedEquipment.map((eq) => (
                <div
                  key={eq.id}
                  className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <Wrench size={14} className="text-gray-400" />
                  <span className="text-gray-700">{eq.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{eq.equipment_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {batch.notes && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Notes
            </h4>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{batch.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
