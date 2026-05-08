import { Suspense } from "react";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { WorkforceHeader } from "@/components/workforce/WorkforceHeader";
import { EmployeeEmptyState } from "@/components/workforce/EmployeeEmptyState";
import { PresetGallery } from "@/components/workforce/PresetGallery";
import { AgentReadyGate } from "@/components/workforce/AgentReadyGate";
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
          <WorkforceHeader authority={params.authority} />
        </Suspense>
        <EmployeeEmptyState />
        <PresetGallery />
      </AgentReadyGate>
    </main>
  );
}
