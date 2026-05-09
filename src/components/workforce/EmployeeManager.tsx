"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Eye,
  ExternalLink,
  Pencil,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { type Address, type Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar } from "@/components/workforce/AgentAvatar";
import { EmployeeEmptyState } from "@/components/workforce/EmployeeEmptyState";
import { HireEmployeeDialog } from "@/components/workforce/HireEmployeeDialog";
import { PermissionSummary } from "@/components/workforce/PermissionSummary";
import { type AgentEmployee } from "@/hooks/useAgentPermissionState";
import { useAgentPermissionTransactions } from "@/hooks/useAgentPermissionTransactions";
import {
  buildRemovePermissionCalldata,
  employeeSnapshotToDraft,
} from "@/lib/agent-permissions";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/config";
import {
  buildEmployeeMetadataStorageKey,
  upsertEmployeeMetadata,
} from "@/lib/employee-metadata";
import { shortAddress } from "@/lib/utils";

type EmployeeManagerProps = {
  authority: Address;
  validator: Address;
  employees: AgentEmployee[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<AgentEmployee[]> | Promise<void> | void;
};

type EmployeeStatus = {
  label: string;
  variant: "muted" | "success";
};

export function EmployeeManager({
  authority,
  validator,
  employees,
  loading,
  error,
  refresh,
}: EmployeeManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<AgentEmployee | undefined>();
  const [updateEmployee, setUpdateEmployee] = useState<AgentEmployee | undefined>();
  const [revokeEmployee, setRevokeEmployee] = useState<AgentEmployee | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | undefined>();
  const {
    state: revokeTxState,
    reset: resetRevokeTransaction,
    executeValidatorTransaction,
    explorerHref,
  } = useAgentPermissionTransactions(authority);
  const updateDraft = useMemo(
    () => (updateEmployee ? employeeSnapshotToDraft(updateEmployee) : undefined),
    [updateEmployee],
  );

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleRevokeOpen = useCallback(
    (employee: AgentEmployee) => {
      resetRevokeTransaction();
      setRevokeError(undefined);
      setRevokeEmployee(employee);
    },
    [resetRevokeTransaction],
  );

  const handleRevokeOpenChange = useCallback(
    (open: boolean) => {
      if (open || revoking) return;
      setRevokeEmployee(undefined);
      setRevokeError(undefined);
      resetRevokeTransaction();
    },
    [resetRevokeTransaction, revoking],
  );

  const confirmRevoke = useCallback(async () => {
    if (!revokeEmployee || revoking) return;

    setRevoking(true);
    setRevokeError(undefined);

    try {
      const txHash = await executeValidatorTransaction({
        validator,
        data: buildRemovePermissionCalldata(revokeEmployee.signer),
      });

      if (!isTransactionHash(txHash)) {
        throw new Error("Revoke transaction did not return a valid 32-byte hash.");
      }

      const now = new Date().toISOString();
      upsertEmployeeMetadata(
        window.localStorage,
        buildEmployeeMetadataStorageKey({
          chainId: BASE_SEPOLIA_CHAIN_ID,
          account: authority,
          validator,
        }),
        {
          signer: revokeEmployee.signer,
          name: revokeEmployee.name,
          avatarSeed: revokeEmployee.avatarSeed,
          createdAt: now,
          updatedAt: now,
          revokeTxHash: txHash,
        },
      );

      await refresh();
      setRevokeEmployee(undefined);
      resetRevokeTransaction();
    } catch (caught) {
      setRevokeError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRevoking(false);
    }
  }, [
    authority,
    executeValidatorTransaction,
    refresh,
    resetRevokeTransaction,
    revokeEmployee,
    revoking,
    validator,
  ]);

  const completeDialogTransaction = useCallback(async () => {
    await refresh();
  }, [refresh]);

  if (loading) {
    return <EmployeeLoadingState />;
  }

  if (employees.length === 0) {
    return (
      <>
        {error ? (
          <section className="container pb-0 pt-6">
            <DestructivePanel message={error} />
          </section>
        ) : null}
        <EmployeeEmptyState onHire={() => setCreateOpen(true)} />
        <HireEmployeeDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          authority={authority}
          validator={validator}
          mode={{ kind: "create" }}
          onComplete={completeDialogTransaction}
        />
      </>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="container py-12"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Employees</h2>
            <p className="text-sm text-muted-foreground">
              Manage scoped agent signers for this smart account.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={runRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Hire employee
            </Button>
          </div>
        </div>

        {error ? <DestructivePanel message={error} /> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {employees.map((employee, index) => (
            <EmployeeCard
              key={employee.signer}
              employee={employee}
              index={index}
              onView={() => setViewEmployee(employee)}
              onUpdate={() => setUpdateEmployee(employee)}
              onRevoke={() => handleRevokeOpen(employee)}
            />
          ))}
        </div>
      </div>

      <HireEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        authority={authority}
        validator={validator}
        mode={{ kind: "create" }}
        onComplete={completeDialogTransaction}
      />
      {updateEmployee && updateDraft ? (
        <HireEmployeeDialog
          open={Boolean(updateEmployee)}
          onOpenChange={(open) => {
            if (!open) setUpdateEmployee(undefined);
          }}
          authority={authority}
          validator={validator}
          mode={{
            kind: "update",
            draft: updateDraft,
            avatarSeed: updateEmployee.avatarSeed,
          }}
          onComplete={completeDialogTransaction}
        />
      ) : null}
      <EmployeeDetailsDialog
        employee={viewEmployee}
        onOpenChange={(open) => {
          if (!open) setViewEmployee(undefined);
        }}
      />
      <RevokeEmployeeDialog
        employee={revokeEmployee}
        open={Boolean(revokeEmployee)}
        onOpenChange={handleRevokeOpenChange}
        onConfirm={confirmRevoke}
        submitting={revoking || isSubmittingStep(revokeTxState.step)}
        error={revokeError ?? revokeTxState.error}
        explorerHref={explorerHref}
      />
    </motion.section>
  );
}

function EmployeeCard({
  employee,
  index,
  onView,
  onUpdate,
  onRevoke,
}: {
  employee: AgentEmployee;
  index: number;
  onView(): void;
  onUpdate(): void;
  onRevoke(): void;
}) {
  const status = employeeStatus(employee);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      className="surface space-y-5 rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <AgentAvatar seed={employee.avatarSeed} className="h-14 w-14 shrink-0" />
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-lg font-semibold">{employee.name}</h3>
            <p className="font-mono text-xs text-muted-foreground">
              {shortAddress(employee.signer, 8, 6)}
            </p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <PermissionSummary employee={employee} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onView}>
          <Eye className="h-4 w-4" />
          View
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onUpdate}>
          <Pencil className="h-4 w-4" />
          Update
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onRevoke}>
          <Trash2 className="h-4 w-4" />
          Revoke
        </Button>
      </div>
    </motion.article>
  );
}

function EmployeeDetailsDialog({
  employee,
  onOpenChange,
}: {
  employee: AgentEmployee | undefined;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Dialog open={Boolean(employee)} onOpenChange={onOpenChange}>
      {employee ? (
        <DialogContent className="max-w-2xl gap-5 p-6">
          <div className="flex min-w-0 items-start gap-3">
            <AgentAvatar seed={employee.avatarSeed} className="h-14 w-14 shrink-0" />
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl">{employee.name}</DialogTitle>
              <DialogDescription className="break-all font-mono">
                {employee.signer}
              </DialogDescription>
            </div>
          </div>
          <PermissionSummary employee={employee} />
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function RevokeEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onConfirm,
  submitting,
  error,
  explorerHref,
}: {
  employee: AgentEmployee | undefined;
  open: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(): void;
  submitting: boolean;
  error?: string;
  explorerHref?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {employee ? (
        <DialogContent className="max-w-xl gap-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-xl">Revoke employee</DialogTitle>
              <DialogDescription>
                Remove permissions for {employee.name} ({shortAddress(employee.signer, 8, 6)}).
              </DialogDescription>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-secondary/30 p-4">
            <PermissionSummary employee={employee} />
          </div>

          {error ? <DestructivePanel message={error} /> : null}
          {explorerHref ? <TransactionLink href={explorerHref} /> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={submitting}
            >
              <Trash2 className="h-4 w-4" />
              {submitting ? "Revoking" : "Revoke employee"}
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function EmployeeLoadingState() {
  return (
    <section className="container py-12">
      <div className="surface flex items-center gap-4 rounded-2xl p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Loading employees
          </h2>
          <p className="text-sm text-muted-foreground">
            Reading scoped signer permissions from Base Sepolia.
          </p>
        </div>
      </div>
    </section>
  );
}

function DestructivePanel({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function TransactionLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm text-accent"
    >
      View transaction
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function employeeStatus(employee: AgentEmployee): EmployeeStatus {
  if (employee.expired) return { label: "Expired", variant: "muted" };
  if (employee.active) return { label: "Active", variant: "success" };
  return { label: "Inactive", variant: "muted" };
}

function isSubmittingStep(step: string): boolean {
  return (
    step === "connecting" ||
    step === "preparing" ||
    step === "awaitingDevice" ||
    step === "broadcasting"
  );
}

function isTransactionHash(value: Hex): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
