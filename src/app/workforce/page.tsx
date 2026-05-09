import { Suspense } from "react";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { AgentReadyGate } from "@/components/workforce/AgentReadyGate";
import { WorkforceDashboard } from "@/components/workforce/WorkforceDashboard";
import {
  buildAgentReadyCookieName,
  getConfiguredAgentPermissionValidatorAddress,
  normalizeAgentPermissionValidatorAddress,
} from "@/lib/kernel-modules";
import { DELEGATE_CONTRACT_ADDRESS } from "@/lib/config";

type Search = {
  hash?: string;
  authority?: string;
  delegate?: string;
  block?: string;
};

export default async function WorkforcePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const validatorAddress = getConfiguredAgentPermissionValidatorAddress();
  const authority = normalizeAgentPermissionValidatorAddress(params.authority);
  const readyCookieName =
    authority && validatorAddress
      ? buildAgentReadyCookieName({
          authority,
          delegate: DELEGATE_CONTRACT_ADDRESS,
          validator: validatorAddress,
        })
      : undefined;
  const initialReady = readyCookieName
    ? (await cookies()).get(readyCookieName)?.value === "ready"
    : false;

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <AgentReadyGate authority={params.authority} initialReady={initialReady}>
        <Suspense>
          <WorkforceDashboard authority={params.authority} />
        </Suspense>
      </AgentReadyGate>
    </main>
  );
}
