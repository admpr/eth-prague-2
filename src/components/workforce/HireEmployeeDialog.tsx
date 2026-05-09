"use client";

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar } from "@/components/workforce/AgentAvatar";
import { useAgentPermissionTransactions } from "@/hooks/useAgentPermissionTransactions";
import {
  BASE_SEPOLIA_TOKEN_PRESETS,
  buildPermissionConfig,
  buildSetPermissionCalldata,
  type CallRuleDraft,
  type PermissionDraft,
  type TokenLimitDraft,
} from "@/lib/agent-permissions";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER_TX } from "@/lib/config";
import {
  buildEmployeeMetadataStorageKey,
  upsertEmployeeMetadata,
} from "@/lib/employee-metadata";
import { cn, shortAddress } from "@/lib/utils";

export type HireEmployeeDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  authority: Address;
  validator: Address;
  mode:
    | { kind: "create" }
    | { kind: "update"; signer: Address; initialName: string; avatarSeed: string };
  onComplete(): Promise<void> | void;
};

const inputClass =
  "h-10 w-full rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const selectClass =
  "h-10 w-full rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function HireEmployeeDialog({
  open,
  onOpenChange,
  authority,
  validator,
  mode,
  onComplete,
}: HireEmployeeDialogProps) {
  const [draft, setDraft] = useState<PermissionDraft>(() => draftFromMode(mode));
  const [pendingCreatePrivateKey, setPendingCreatePrivateKey] = useState<Hex | undefined>();
  const [pendingCreateBroadcastHash, setPendingCreateBroadcastHash] = useState<Hex | undefined>();
  const [revealedPrivateKey, setRevealedPrivateKey] = useState<Hex | undefined>();
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();
  const {
    state: txState,
    reset: resetTransaction,
    executeValidatorTransaction,
    explorerHref,
  } = useAgentPermissionTransactions(authority);

  useEffect(() => {
    if (!open) {
      setPendingCreatePrivateKey(undefined);
      setPendingCreateBroadcastHash(undefined);
      setRevealedPrivateKey(undefined);
      setCopied(false);
      setLocalError(undefined);
      resetTransaction();
      return;
    }

    setDraft(draftFromMode(mode));
    setPendingCreatePrivateKey(undefined);
    setPendingCreateBroadcastHash(undefined);
    setRevealedPrivateKey(undefined);
    setCopied(false);
    setLocalError(undefined);
    resetTransaction();
  }, [
    mode.kind,
    mode.kind === "update" ? mode.avatarSeed : undefined,
    mode.kind === "update" ? mode.initialName : undefined,
    mode.kind === "update" ? mode.signer : undefined,
    open,
    resetTransaction,
  ]);

  const validationError = useMemo(() => {
    const validationDraft = {
      ...draft,
      signer: draft.signer || authority,
      name: draft.name.trim(),
    };

    try {
      buildPermissionConfig(validationDraft);
      return undefined;
    } catch (error) {
      return firstPermissionConfigError(error);
    }
  }, [authority, draft]);

  const isSubmitting = submitting || isSubmittingStep(txState.step);
  const hasPendingBroadcastKey = Boolean(
    pendingCreatePrivateKey && pendingCreateBroadcastHash && !revealedPrivateKey,
  );
  const destructiveMessage = revealedPrivateKey
    ? txState.error ?? localError
    : validationError ?? txState.error ?? localError;
  const avatarSeed = draft.signer || (mode.kind === "update" ? mode.avatarSeed : authority);
  const submitLabel = isSubmitting
    ? transactionLabel(txState.step)
    : mode.kind === "create"
      ? "Hire employee"
      : "Update employee";

  const updateDraft = useCallback((patch: Partial<PermissionDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (revealedPrivateKey || isSubmitting || hasPendingBroadcastKey)) return;
      onOpenChange(nextOpen);
    },
    [hasPendingBroadcastKey, isSubmitting, onOpenChange, revealedPrivateKey],
  );

  const closeReveal = useCallback(() => {
    setPendingCreatePrivateKey(undefined);
    setPendingCreateBroadcastHash(undefined);
    setRevealedPrivateKey(undefined);
    setCopied(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const discardGeneratedKey = useCallback(() => {
    setPendingCreatePrivateKey(undefined);
    setPendingCreateBroadcastHash(undefined);
    setRevealedPrivateKey(undefined);
    setCopied(false);
    setLocalError(undefined);
    resetTransaction();
    onOpenChange(false);
  }, [onOpenChange, resetTransaction]);

  const copyPrivateKey = useCallback(async () => {
    if (!revealedPrivateKey) return;

    try {
      await navigator.clipboard.writeText(revealedPrivateKey);
      setCopied(true);
      setLocalError(undefined);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not copy private key.");
    }
  }, [revealedPrivateKey]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting || validationError) return;

      setSubmitting(true);
      setCopied(false);
      setLocalError(undefined);

      let privateKey: Hex | undefined;
      let signer: Address;
      if (mode.kind === "create") {
        privateKey = pendingCreatePrivateKey ?? generatePrivateKey();
        setPendingCreatePrivateKey(privateKey);
        signer = privateKeyToAccount(privateKey).address;
        setDraft((current) => ({ ...current, signer }));
      } else {
        signer = mode.signer;
      }
      const finalDraft: PermissionDraft = {
        ...draft,
        signer,
        name: draft.name.trim(),
      };

      let data: Hex;
      try {
        data = buildSetPermissionCalldata(buildPermissionConfig(finalDraft));
      } catch (error) {
        setLocalError(firstPermissionConfigError(error));
        setSubmitting(false);
        return;
      }

      let txHash: Hex;
      try {
        txHash = await executeValidatorTransaction({ validator, data });
      } catch (error) {
        const broadcastHash = transactionHashFromError(error);
        if (mode.kind === "create" && privateKey && broadcastHash) {
          setPendingCreateBroadcastHash(broadcastHash);
        }
        setSubmitting(false);
        return;
      }

      const now = new Date().toISOString();
      let postTransactionError = false;
      try {
        upsertEmployeeMetadata(
          window.localStorage,
          buildEmployeeMetadataStorageKey({
            chainId: BASE_SEPOLIA_CHAIN_ID,
            account: authority,
            validator,
          }),
          {
            signer,
            name: finalDraft.name,
            avatarSeed: mode.kind === "update" ? mode.avatarSeed : signer,
            createdAt: now,
            updatedAt: now,
            createTxHash: mode.kind === "create" ? txHash : undefined,
            updateTxHash: mode.kind === "update" ? txHash : undefined,
          },
        );

        await onComplete();
      } catch (error) {
        postTransactionError = true;
        setLocalError(error instanceof Error ? error.message : String(error));
      }

      setSubmitting(false);

      if (mode.kind === "create" && privateKey) {
        setPendingCreateBroadcastHash(undefined);
        setDraft((current) => ({ ...current, signer }));
        setRevealedPrivateKey(privateKey);
      } else if (!postTransactionError) {
        onOpenChange(false);
      }
    },
    [
      authority,
      draft,
      executeValidatorTransaction,
      isSubmitting,
      mode,
      onComplete,
      onOpenChange,
      pendingCreatePrivateKey,
      validationError,
      validator,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-5 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <AgentAvatar seed={avatarSeed} className="h-14 w-14 shrink-0" />
            <div className="min-w-0 space-y-1">
              <Badge variant={mode.kind === "create" ? "primary" : "accent"}>
                {mode.kind === "create" ? (
                  <UserPlus className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {mode.kind === "create" ? "New employee" : "Update employee"}
              </Badge>
              <DialogTitle className="text-xl">
                {mode.kind === "create" ? "Hire employee" : "Update permissions"}
              </DialogTitle>
              <DialogDescription>
                {mode.kind === "create"
                  ? "Create a scoped signer for this workforce member."
                  : `Editing ${shortAddress(mode.signer, 8, 6)}.`}
              </DialogDescription>
            </div>
          </div>
        </div>

        {destructiveMessage ? <DestructivePanel message={destructiveMessage} /> : null}
        {explorerHref ? <ExplorerLink href={explorerHref} /> : null}
        {hasPendingBroadcastKey && pendingCreateBroadcastHash ? (
          <PendingBroadcastKeyWarning
            hash={pendingCreateBroadcastHash}
            onDiscard={discardGeneratedKey}
          />
        ) : null}

        {revealedPrivateKey ? (
          <PrivateKeyReveal
            copied={copied}
            privateKey={revealedPrivateKey}
            onCopy={copyPrivateKey}
            onClose={closeReveal}
          />
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <section className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="employee-name">
                  Agent name
                </label>
                <input
                  id="employee-name"
                  className={inputClass}
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="Invoice assistant"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 sm:w-44">
                <span className={labelClass}>Signer</span>
                <div className="flex h-10 items-center rounded-lg border border-border/70 bg-secondary/50 px-3 font-mono text-xs text-muted-foreground">
                  {draft.signer ? shortAddress(draft.signer, 8, 6) : "Generated on hire"}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">ETH limit</span>
                  <span className="text-xs text-muted-foreground">Daily native token budget</span>
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={draft.nativeLimitEnabled}
                  onChange={(event) =>
                    updateDraft({
                      nativeLimitEnabled: event.target.checked,
                      nativeLimitAmount: event.target.checked ? draft.nativeLimitAmount : "",
                    })
                  }
                  disabled={isSubmitting}
                />
              </label>

              {draft.nativeLimitEnabled ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className={inputClass}
                    value={draft.nativeLimitAmount}
                    onChange={(event) => updateDraft({ nativeLimitAmount: event.target.value })}
                    placeholder="0.05"
                    inputMode="decimal"
                    disabled={isSubmitting}
                  />
                  <div className="flex h-10 items-center rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm text-muted-foreground">
                    ETH / day
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Token limits</h3>
                  <p className="text-xs text-muted-foreground">Optional ERC20 budgets</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      tokenLimits: [...current.tokenLimits, tokenLimitFromPreset()],
                    }))
                  }
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                  Add token
                </Button>
              </div>

              {draft.tokenLimits.length === 0 ? (
                <p className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                  No token limits
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.tokenLimits.map((limit) => (
                    <TokenLimitRow
                      key={limit.id}
                      disabled={isSubmitting}
                      limit={limit}
                      onChange={(next) => updateTokenLimit(setDraft, limit.id, next)}
                      onRemove={() => removeTokenLimit(setDraft, limit.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div>
                <h3 className="text-sm font-semibold">Contract access</h3>
                <p className="text-xs text-muted-foreground">Choose where this signer can call</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <AccessButton
                  active={draft.contractAccess === "any"}
                  disabled={isSubmitting}
                  label="Call any contract"
                  onClick={() => updateDraft({ contractAccess: "any" })}
                />
                <AccessButton
                  active={draft.contractAccess === "whitelist"}
                  disabled={isSubmitting}
                  label="Whitelist only"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      contractAccess: "whitelist",
                      callRules:
                        current.callRules.length > 0 ? current.callRules : [emptyCallRule()],
                    }))
                  }
                />
              </div>

              {draft.contractAccess === "whitelist" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>Whitelist rules</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          callRules: [...current.callRules, emptyCallRule()],
                        }))
                      }
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4" />
                      Add rule
                    </Button>
                  </div>

                  {draft.callRules.map((rule) => (
                    <CallRuleRow
                      key={rule.id}
                      disabled={isSubmitting}
                      rule={rule}
                      onChange={(next) => updateCallRule(setDraft, rule.id, next)}
                      onRemove={() => removeCallRule(setDraft, rule.id)}
                    />
                  ))}
                </div>
              ) : null}
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {hasPendingBroadcastKey ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={discardGeneratedKey}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4" />
                  Discard generated key
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={Boolean(validationError) || isSubmitting}>
                {mode.kind === "create" ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitLabel}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrivateKeyReveal({
  copied,
  privateKey,
  onCopy,
  onClose,
}: {
  copied: boolean;
  privateKey: Hex;
  onCopy(): void;
  onClose(): void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-amber-100">Save this employee key now</h3>
          <p className="text-sm text-amber-100/80">
            This private key is not stored. If you lose it, you will need to create a new
            employee key.
          </p>
        </div>
      </div>

      <code className="block max-h-40 overflow-y-auto break-all rounded-lg border border-amber-500/30 bg-background/70 p-3 font-mono text-xs text-amber-50">
        {privateKey}
      </code>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy key"}
        </Button>
        <Button type="button" onClick={onClose}>
          <ShieldCheck className="h-4 w-4" />
          I saved it
        </Button>
      </div>
    </section>
  );
}

function PendingBroadcastKeyWarning({
  hash,
  onDiscard,
}: {
  hash: Hex;
  onDiscard(): void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="space-y-1">
          <h3 className="font-semibold">Transaction broadcast, confirmation unknown</h3>
          <p className="text-amber-100/80">
            Keep this dialog open and retry to reuse the same generated employee key. Closing is
            blocked until the transaction confirms or you discard the generated key.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={`${BASE_SEPOLIA_EXPLORER_TX}/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-amber-100 underline-offset-4 hover:underline"
        >
          View broadcast transaction <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button type="button" variant="destructive" size="sm" onClick={onDiscard}>
          <Trash2 className="h-4 w-4" />
          Discard generated key
        </Button>
      </div>
    </section>
  );
}

function TokenLimitRow({
  disabled,
  limit,
  onChange,
  onRemove,
}: {
  disabled: boolean;
  limit: TokenLimitDraft;
  onChange(limit: Partial<TokenLimitDraft>): void;
  onRemove(): void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <select
        className={selectClass}
        value={presetIndexForTokenLimit(limit)}
        onChange={(event) => {
          const preset = BASE_SEPOLIA_TOKEN_PRESETS[Number(event.target.value)];
          onChange({
            token: preset.address,
            symbol: preset.symbol,
            decimals: preset.decimals,
          });
        }}
        disabled={disabled}
      >
        {BASE_SEPOLIA_TOKEN_PRESETS.map((preset, index) => (
          <option key={preset.symbol} value={index}>
            {preset.symbol} - {preset.name}
          </option>
        ))}
      </select>
      <input
        className={inputClass}
        value={limit.amount}
        onChange={(event) => onChange({ amount: event.target.value })}
        placeholder="100"
        inputMode="decimal"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${limit.symbol} limit`}
        onClick={onRemove}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CallRuleRow({
  disabled,
  rule,
  onChange,
  onRemove,
}: {
  disabled: boolean;
  rule: CallRuleDraft;
  onChange(rule: Partial<CallRuleDraft>): void;
  onRemove(): void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_auto]">
      <input
        className={inputClass}
        value={rule.target}
        onChange={(event) => onChange({ target: event.target.value })}
        placeholder="0x contract address"
        spellCheck={false}
        disabled={disabled}
      />
      <select
        className={selectClass}
        value={rule.mode}
        onChange={(event) =>
          onChange({
            mode: event.target.value as CallRuleDraft["mode"],
            selector: event.target.value === "selector" ? rule.selector ?? "" : undefined,
          })
        }
        disabled={disabled}
      >
        <option value="any">Any function</option>
        <option value="selector">Selector</option>
      </select>
      {rule.mode === "selector" ? (
        <input
          className={inputClass}
          value={rule.selector ?? ""}
          onChange={(event) => onChange({ selector: event.target.value })}
          placeholder="0xa9059cbb"
          spellCheck={false}
          disabled={disabled}
        />
      ) : (
        <div className="hidden h-10 items-center rounded-lg border border-border/70 bg-secondary/30 px-3 text-sm text-muted-foreground sm:flex">
          All selectors
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remove whitelist rule"
        onClick={onRemove}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AccessButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border/70 bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
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

function ExplorerLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm text-accent"
    >
      View transaction <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function draftFromMode(mode: HireEmployeeDialogProps["mode"]): PermissionDraft {
  if (mode.kind === "update") {
    return {
      ...emptyDraft(mode.signer),
      name: mode.initialName,
      contractAccess: "whitelist",
      callRules: [],
    };
  }

  return emptyDraft();
}

function emptyDraft(signer = ""): PermissionDraft {
  return {
    signer,
    name: "",
    validAfter: "",
    validUntil: "",
    nativeLimitEnabled: false,
    nativeLimitAmount: "",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimits: [],
    contractAccess: "any",
    callRules: [],
  };
}

function tokenLimitFromPreset(index = 0): TokenLimitDraft {
  const preset = BASE_SEPOLIA_TOKEN_PRESETS[index] ?? BASE_SEPOLIA_TOKEN_PRESETS[0];
  return {
    id: newId("token"),
    token: preset.address,
    symbol: preset.symbol,
    decimals: preset.decimals,
    amount: "",
    period: { kind: "daily" },
  };
}

function emptyCallRule(): CallRuleDraft {
  return {
    id: newId("rule"),
    target: "",
    mode: "any",
  };
}

function updateTokenLimit(
  setDraft: Dispatch<SetStateAction<PermissionDraft>>,
  id: string,
  patch: Partial<TokenLimitDraft>,
) {
  setDraft((current) => ({
    ...current,
    tokenLimits: current.tokenLimits.map((limit) =>
      limit.id === id ? { ...limit, ...patch } : limit,
    ),
  }));
}

function removeTokenLimit(
  setDraft: Dispatch<SetStateAction<PermissionDraft>>,
  id: string,
) {
  setDraft((current) => ({
    ...current,
    tokenLimits: current.tokenLimits.filter((limit) => limit.id !== id),
  }));
}

function updateCallRule(
  setDraft: Dispatch<SetStateAction<PermissionDraft>>,
  id: string,
  patch: Partial<CallRuleDraft>,
) {
  setDraft((current) => ({
    ...current,
    callRules: current.callRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
  }));
}

function removeCallRule(
  setDraft: Dispatch<SetStateAction<PermissionDraft>>,
  id: string,
) {
  setDraft((current) => ({
    ...current,
    callRules: current.callRules.filter((rule) => rule.id !== id),
  }));
}

function presetIndexForTokenLimit(limit: TokenLimitDraft): string {
  const index = BASE_SEPOLIA_TOKEN_PRESETS.findIndex(
    (preset) => preset.symbol === limit.symbol && preset.address === limit.token,
  );
  return String(index >= 0 ? index : BASE_SEPOLIA_TOKEN_PRESETS.length - 1);
}

function firstPermissionConfigError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/^Cannot build permission config:\s*/i, "");
  return normalized.match(/^.*?\.(?:\s|$)/)?.[0].trim() ?? normalized;
}

function transactionHashFromError(error: unknown): Hex | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "hash" in error &&
    typeof error.hash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(error.hash)
  ) {
    return error.hash as Hex;
  }
  return undefined;
}

function isSubmittingStep(step: string): boolean {
  return (
    step === "connecting" ||
    step === "preparing" ||
    step === "awaitingDevice" ||
    step === "broadcasting"
  );
}

function transactionLabel(step: string): string {
  switch (step) {
    case "connecting":
      return "Connecting wallet";
    case "preparing":
      return "Preparing transaction";
    case "awaitingDevice":
      return "Approve on device";
    case "broadcasting":
      return "Broadcasting";
    default:
      return "Submitting";
  }
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
