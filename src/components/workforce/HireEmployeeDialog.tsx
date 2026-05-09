"use client";

import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarRange,
  Coins,
  Copy,
  ExternalLink,
  Info,
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
import {
  type PermissionTxStep,
  useAgentPermissionTransactions,
} from "@/hooks/useAgentPermissionTransactions";
import {
  BASE_SEPOLIA_TOKEN_PRESETS,
  buildPermissionConfig,
  buildSetPermissionCalldata,
  type CallRuleDraft,
  type LimitPeriod,
  type PermissionDraft,
  type TokenLimitDraft,
} from "@/lib/agent-permissions";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER_TX } from "@/lib/config";
import {
  buildEmployeeMetadataStorageKey,
  upsertEmployeeMetadata,
} from "@/lib/employee-metadata";
import { cn } from "@/lib/utils";

export type HireEmployeeDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  authority: Address;
  validator: Address;
  mode:
    | { kind: "create" }
    | { kind: "update"; draft: PermissionDraft; avatarSeed: string };
  onComplete(): Promise<void> | void;
};

const inputClass =
  "h-10 w-full rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const selectClass =
  "h-10 w-full rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const sectionClass =
  "rounded-2xl border border-border/70 bg-background/35 p-4 shadow-[inset_0_1px_0_hsl(240_6%_100%/0.04)]";
const fieldLabelClass =
  "text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground";

export function HireEmployeeDialog({
  open,
  onOpenChange,
  authority,
  validator,
  mode,
  onComplete,
}: HireEmployeeDialogProps) {
  const updateModeDraft = mode.kind === "update" ? mode.draft : undefined;
  const updateModeAvatarSeed = mode.kind === "update" ? mode.avatarSeed : undefined;
  const initialDraft = useMemo(() => draftFromMode(mode), [mode.kind, updateModeDraft]);
  const [draft, setDraft] = useState<PermissionDraft>(() => initialDraft);
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

    setDraft(initialDraft);
    setPendingCreatePrivateKey(undefined);
    setPendingCreateBroadcastHash(undefined);
    setRevealedPrivateKey(undefined);
    setCopied(false);
    setLocalError(undefined);
    resetTransaction();
  }, [
    initialDraft,
    mode.kind,
    open,
    resetTransaction,
    updateModeAvatarSeed,
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
  const currentTxStepLabel = txStepLabel(txState.step);
  const avatarSeed = mode.kind === "update" ? mode.avatarSeed : draft.signer || authority;
  const submitLabel = isSubmitting
    ? currentTxStepLabel || "Submitting"
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
        signer = mode.draft.signer as Address;
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
      <DialogContent className="max-h-[92vh] max-w-3xl gap-5 overflow-y-auto rounded-[1.75rem] p-0">
        <div className="border-b border-border/70 bg-secondary/20 px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <AgentAvatar seed={avatarSeed} className="h-16 w-16 shrink-0 ring-2 ring-primary/20" />
            <div className="min-w-0 space-y-1">
              <Badge variant={mode.kind === "create" ? "primary" : "accent"}>
                {mode.kind === "create" ? (
                  <UserPlus className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {mode.kind === "create" ? "New employee" : "Update employee"}
              </Badge>
              <DialogTitle className="text-2xl">
                {mode.kind === "create" ? "Hire employee" : "Update permissions"}
              </DialogTitle>
              <DialogDescription>
                {mode.kind === "create"
                  ? "Create scoped permissions for a new workforce member."
                  : "Tune the permissions this employee can use."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 pb-6">
          {destructiveMessage ? <DestructivePanel message={destructiveMessage} /> : null}
          {explorerHref ? <ExplorerLink href={explorerHref} /> : null}
          {currentTxStepLabel ? <TransactionStepLabel label={currentTxStepLabel} /> : null}
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
            <form className="space-y-4" onSubmit={handleSubmit}>
              <section className={sectionClass}>
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
              </section>

              <SettingSection
                checked={draft.nativeLimitEnabled}
                description="Native token budget"
                disabled={isSubmitting}
                icon={<Coins className="h-4 w-4" />}
                title="ETH limit"
                onCheckedChange={(checked) =>
                  updateDraft({
                    nativeLimitEnabled: checked,
                    nativeLimitAmount: checked ? draft.nativeLimitAmount : "",
                  })
                }
              >
                {draft.nativeLimitEnabled ? (
                  <LimitControls
                    amount={draft.nativeLimitAmount}
                    amountAriaLabel="ETH limit amount"
                    amountPlaceholder="0.05"
                    disabled={isSubmitting}
                    period={draft.nativeLimitPeriod}
                    periodAriaLabel="ETH reset period"
                    onAmountChange={(nativeLimitAmount) => updateDraft({ nativeLimitAmount })}
                    onPeriodChange={(nativeLimitPeriod) => updateDraft({ nativeLimitPeriod })}
                  />
                ) : null}
              </SettingSection>

              <SettingSection
                checked={draft.tokenLimitsEnabled}
                description="Optional ERC20 budgets"
                disabled={isSubmitting}
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Token limits"
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    tokenLimitsEnabled: checked,
                    tokenLimits:
                      checked && current.tokenLimits.length === 0
                        ? [tokenLimitFromPreset()]
                        : current.tokenLimits,
                  }))
                }
              >
                {draft.tokenLimitsEnabled ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
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
                  </div>
                ) : null}
              </SettingSection>

              <SettingSection
                checked={draft.validityWindowEnabled}
                description="Optionally schedule or expire access"
                disabled={isSubmitting}
                icon={<CalendarRange className="h-4 w-4" />}
                title="Validity window"
                onCheckedChange={(validityWindowEnabled) =>
                  updateDraft({ validityWindowEnabled })
                }
              >
                {draft.validityWindowEnabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className={labelClass} htmlFor="valid-after">
                        Valid after
                      </label>
                      <input
                        id="valid-after"
                        type="datetime-local"
                        className={inputClass}
                        value={String(draft.validAfter ?? "")}
                        onChange={(event) => updateDraft({ validAfter: event.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass} htmlFor="valid-until">
                        Valid until
                      </label>
                      <input
                        id="valid-until"
                        type="datetime-local"
                        className={inputClass}
                        value={String(draft.validUntil ?? "")}
                        onChange={(event) => updateDraft({ validUntil: event.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                ) : null}
              </SettingSection>

              <section className={`${sectionClass} space-y-3`}>
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

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingSection({
  checked,
  children,
  description,
  disabled,
  icon,
  onCheckedChange,
  title,
}: {
  checked: boolean;
  children: ReactNode;
  description: string;
  disabled: boolean;
  icon: ReactNode;
  onCheckedChange(checked: boolean): void;
  title: string;
}) {
  return (
    <section
      className={cn(
        sectionClass,
        "space-y-3 transition-colors",
        checked ? "border-primary/35 bg-secondary/45" : "bg-background/35",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
              checked
                ? "border-primary/40 bg-primary/20 text-primary"
                : "border-border/70 bg-secondary/40 text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <SwitchControl
          checked={checked}
          disabled={disabled}
          label={title}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked ? <div>{children}</div> : null}
    </section>
  );
}

function SwitchControl({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange(checked: boolean): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} ${checked ? "enabled" : "disabled"}`}
      className={cn(
        "relative h-7 w-12 shrink-0 overflow-hidden rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-primary/60 bg-primary shadow-[0_0_24px_hsl(263_83%_66%/0.32)]"
          : "border-border/80 bg-secondary",
      )}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}
    >
      <span
        className={cn(
          "absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-foreground shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
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
  const isCustom = isCustomTokenLimit(limit);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/35 p-3">
      <div className="grid gap-x-3 gap-y-1.5 lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)_minmax(12rem,15rem)_auto]">
        <div className={fieldLabelClass}>Token</div>
        <div className={fieldLabelClass}>Amount</div>
        <div className="flex items-center gap-1.5">
          <span className={fieldLabelClass}>Reset</span>
          <InfoHint text="How often this limit renews. No reset means the budget does not automatically refresh." />
        </div>
        <div aria-hidden="true" />

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
          aria-label="Token preset"
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
          aria-label={`${limit.symbol || "Token"} amount`}
          disabled={disabled}
        />
        <ResetControl
          ariaLabel={`${limit.symbol || "Token"} reset period`}
          disabled={disabled}
          onChange={(period) => onChange({ period })}
          period={limit.period}
        />
        <div className="flex items-start">
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
      </div>
      {isCustom ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-1.5">
            <span className={fieldLabelClass}>Token address</span>
            <input
              className={inputClass}
              value={limit.token}
              onChange={(event) => onChange({ token: event.target.value })}
              placeholder="0x token address"
              spellCheck={false}
              aria-label="Custom token address"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <span className={fieldLabelClass}>Decimals</span>
            <input
              type="number"
              className={inputClass}
              value={String(Number.isFinite(limit.decimals) ? limit.decimals : 18)}
              min={0}
              max={18}
              step={1}
              onChange={(event) =>
                onChange({ decimals: parseTokenDecimalsInput(event.target.value) })
              }
              aria-label="Custom token decimals"
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LimitControls({
  amount,
  amountAriaLabel,
  amountPlaceholder,
  disabled,
  onAmountChange,
  onPeriodChange,
  period,
  periodAriaLabel,
}: {
  amount: string;
  amountAriaLabel: string;
  amountPlaceholder: string;
  disabled: boolean;
  onAmountChange(amount: string): void;
  onPeriodChange(period: LimitPeriod): void;
  period: LimitPeriod;
  periodAriaLabel: string;
}) {
  return (
    <div className="grid gap-x-3 gap-y-1.5 md:grid-cols-2">
      <div className={fieldLabelClass}>Amount</div>
      <div className="flex items-center gap-1.5">
        <span className={fieldLabelClass}>Reset</span>
        <InfoHint text="How often this limit renews. No reset means the budget does not automatically refresh." />
      </div>
      <div>
        <input
          className={inputClass}
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder={amountPlaceholder}
          inputMode="decimal"
          aria-label={amountAriaLabel}
          disabled={disabled}
        />
      </div>
      <ResetField
        ariaLabel={periodAriaLabel}
        disabled={disabled}
        onChange={onPeriodChange}
        period={period}
      />
    </div>
  );
}

function ResetControl({
  ariaLabel,
  disabled,
  onChange,
  period,
}: {
  ariaLabel: string;
  disabled: boolean;
  onChange(period: LimitPeriod): void;
  period: LimitPeriod;
}) {
  return (
    <div className="grid gap-2">
      <select
        className={selectClass}
        value={period.kind}
        onChange={(event) => onChange(limitPeriodFromKind(event.target.value, period))}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <option value="fixed">No reset</option>
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="custom">Custom</option>
      </select>
      {period.kind === "custom" ? (
        <input
          className={inputClass}
          value={String(period.seconds)}
          onChange={(event) => onChange({ kind: "custom", seconds: event.target.value })}
          placeholder="Seconds"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`${ariaLabel} custom seconds`}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function ResetField({
  ariaLabel,
  disabled,
  onChange,
  period,
}: {
  ariaLabel: string;
  disabled: boolean;
  onChange(period: LimitPeriod): void;
  period: LimitPeriod;
}) {
  return (
    <div>
      <ResetControl
        ariaLabel={ariaLabel}
        disabled={disabled}
        onChange={onChange}
        period={period}
      />
    </div>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={text}
      >
        <Info className="h-3 w-3" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-border/70 bg-background px-3 py-2 text-left text-xs normal-case leading-relaxed tracking-normal text-foreground shadow-xl group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
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
        aria-label="Whitelist target contract"
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
        aria-label="Whitelist mode"
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
          aria-label="Function selector"
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

function TransactionStepLabel({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-2 text-sm text-muted-foreground"
    >
      {label}
    </div>
  );
}

function draftFromMode(mode: HireEmployeeDialogProps["mode"]): PermissionDraft {
  if (mode.kind === "update") {
    return cloneDraft(mode.draft);
  }

  return emptyDraft();
}

function cloneDraft(draft: PermissionDraft): PermissionDraft {
  return {
    ...draft,
    nativeLimitPeriod: cloneLimitPeriod(draft.nativeLimitPeriod),
    tokenLimits: draft.tokenLimits.map((limit) => ({
      ...limit,
      period: cloneLimitPeriod(limit.period),
    })),
    callRules: draft.callRules.map((rule) => ({ ...rule })),
  };
}

function cloneLimitPeriod(period: LimitPeriod): LimitPeriod {
  return period.kind === "custom" ? { ...period } : period;
}

function emptyDraft(signer = ""): PermissionDraft {
  return {
    signer,
    name: "",
    validityWindowEnabled: false,
    validAfter: "",
    validUntil: "",
    nativeLimitEnabled: false,
    nativeLimitAmount: "",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimitsEnabled: false,
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

function isCustomTokenLimit(limit: TokenLimitDraft): boolean {
  return presetIndexForTokenLimit(limit) === String(BASE_SEPOLIA_TOKEN_PRESETS.length - 1);
}

function limitPeriodFromKind(kind: string, current: LimitPeriod): LimitPeriod {
  switch (kind) {
    case "fixed":
      return { kind: "fixed" };
    case "hourly":
      return { kind: "hourly" };
    case "daily":
      return { kind: "daily" };
    case "weekly":
      return { kind: "weekly" };
    case "custom":
      return {
        kind: "custom",
        seconds: current.kind === "custom" ? current.seconds : "",
      };
    default:
      return current;
  }
}

function parseTokenDecimalsInput(value: string): number {
  if (!value.trim()) return 18;
  const decimals = Number(value);
  return Number.isNaN(decimals) ? 18 : decimals;
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

function isSubmittingStep(step: PermissionTxStep): boolean {
  return (
    step === "connecting" ||
    step === "preparing" ||
    step === "awaitingDevice" ||
    step === "broadcasting"
  );
}

function txStepLabel(step: PermissionTxStep): string {
  switch (step) {
    case "connecting":
      return "Connecting hardware wallet";
    case "preparing":
      return "Preparing transaction";
    case "awaitingDevice":
      return "Approve on hardware wallet";
    case "broadcasting":
      return "Broadcasting on Base Sepolia";
    case "confirmed":
      return "Confirmed";
    case "error":
      return "Transaction failed";
    case "idle":
      return "";
    default:
      return "";
  }
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
