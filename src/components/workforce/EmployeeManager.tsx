"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
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
import {
  HireEmployeeDialog,
  type HireEmployeeCompletion,
} from "@/components/workforce/HireEmployeeDialog";
import { PermissionSummary } from "@/components/workforce/PermissionSummary";
import { PresetGallery } from "@/components/workforce/PresetGallery";
import { type AgentEmployee } from "@/hooks/useAgentPermissionState";
import { useAgentPermissionTransactions } from "@/hooks/useAgentPermissionTransactions";
import {
  buildRemovePermissionCalldata,
  employeeSnapshotToDraft,
  type PermissionDraft,
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
  variant: "muted" | "primary" | "success";
};

type EmployeeRefresh = () => Promise<AgentEmployee[] | void> | AgentEmployee[] | void;

const EMPLOYEE_REFRESH_ATTEMPTS = 8;
const EMPLOYEE_REFRESH_DELAY_MS = 1500;

export async function refreshUntilEmployeeVisible({
  attempts = EMPLOYEE_REFRESH_ATTEMPTS,
  delayMs = EMPLOYEE_REFRESH_DELAY_MS,
  expectedSigner,
  refresh,
  wait = sleep,
}: {
  refresh: EmployeeRefresh;
  expectedSigner?: Address;
  attempts?: number;
  delayMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<AgentEmployee[] | undefined> {
  const normalizedExpectedSigner = expectedSigner?.toLowerCase();
  const maxAttempts = normalizedExpectedSigner ? attempts : 1;
  let latest: AgentEmployee[] | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await refresh();
    latest = Array.isArray(result) ? result : undefined;

    if (!normalizedExpectedSigner || employeeListContainsSigner(latest, normalizedExpectedSigner)) {
      return latest;
    }

    if (attempt < maxAttempts - 1) {
      await wait(delayMs);
    }
  }

  return latest;
}

export async function refreshUntilEmployeeHidden({
  attempts = EMPLOYEE_REFRESH_ATTEMPTS,
  delayMs = EMPLOYEE_REFRESH_DELAY_MS,
  refresh,
  removedSigner,
  wait = sleep,
}: {
  refresh: EmployeeRefresh;
  removedSigner: Address;
  attempts?: number;
  delayMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<AgentEmployee[] | undefined> {
  const normalizedRemovedSigner = removedSigner.toLowerCase();
  let latest: AgentEmployee[] | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await refresh();
    latest = Array.isArray(result) ? result : undefined;

    if (!employeeListContainsSigner(latest, normalizedRemovedSigner)) {
      return latest;
    }

    if (attempt < attempts - 1) {
      await wait(delayMs);
    }
  }

  return latest;
}

export function EmployeeManager({
  authority,
  validator,
  employees,
  loading,
  error,
  refresh,
}: EmployeeManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<PermissionDraft | undefined>();
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

  const openBlankCreate = useCallback(() => {
    setCreateDraft(undefined);
    setCreateOpen(true);
  }, []);

  const openPresetCreate = useCallback((draft: PermissionDraft) => {
    setCreateDraft(draft);
    setCreateOpen(true);
  }, []);

  const handleCreateOpenChange = useCallback((open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setCreateDraft(undefined);
    }
  }, []);

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

      await refreshUntilEmployeeHidden({
        refresh,
        removedSigner: revokeEmployee.signer,
      });
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

  const completeDialogTransaction = useCallback(async (completion: HireEmployeeCompletion) => {
    await refreshUntilEmployeeVisible({
      refresh,
      expectedSigner: completion.kind === "create" ? completion.signer : undefined,
    });
  }, [refresh]);

  let content: ReactNode;
  if (loading) {
    content = <EmployeeLoadingState />;
  } else if (employees.length === 0) {
    content = (
      <>
        {error ? (
          <section className="container pb-0 pt-6">
            <DestructivePanel message={error} />
          </section>
        ) : null}
        <EmployeeEmptyState onHire={openBlankCreate} />
      </>
    );
  } else {
    content = (
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
              <Button type="button" onClick={openBlankCreate}>
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
      </motion.section>
    );
  }

  return (
    <>
      {content}
      <PresetGallery onHirePreset={openPresetCreate} />
      <HireEmployeeDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        authority={authority}
        validator={validator}
        mode={{ kind: "create", draft: createDraft }}
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
    </>
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
  if (!employee.active) return { label: "Inactive", variant: "muted" };
  if (employee.validAfter !== 0 && Math.floor(Date.now() / 1000) < employee.validAfter) {
    return { label: "Scheduled", variant: "primary" };
  }
  if (employee.expired) return { label: "Expired", variant: "muted" };
  return { label: "Active", variant: "success" };
}

function employeeListContainsSigner(
  employees: AgentEmployee[] | undefined,
  normalizedExpectedSigner: string,
): boolean {
  return Boolean(
    employees?.some((employee) => employee.signer.toLowerCase() === normalizedExpectedSigner),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isSubmittingStep(step: string): boolean {
  return (
    step === "connecting" ||
    step === "preparing" ||
    step === "awaitingDevice" ||
    step === "broadcasting" ||
    step === "confirming"
  );
}

function isTransactionHash(value: Hex): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
