"use client";

import { useMemo } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { EmployeeManager } from "@/components/workforce/EmployeeManager";
import { WorkforceHeader } from "@/components/workforce/WorkforceHeader";
import { useAgentPermissionState } from "@/hooks/useAgentPermissionState";

type WorkforceDashboardProps = {
  authority?: string;
};

export function WorkforceDashboard({ authority }: WorkforceDashboardProps) {
  const normalizedAuthority = useMemo<Address | undefined>(() => {
    if (!authority || !isAddress(authority)) return undefined;
    return getAddress(authority);
  }, [authority]);
  const { employees, loading, error, validatorAddress, refresh } =
    useAgentPermissionState(normalizedAuthority);
  const activeEmployees = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return employees.filter(
      (employee) =>
        employee.active &&
        !employee.expired &&
        (employee.validAfter === 0 || now >= employee.validAfter),
    ).length;
  }, [employees]);

  return (
    <>
      <WorkforceHeader
        authority={normalizedAuthority}
        activeEmployees={activeEmployees}
      />
      {normalizedAuthority && validatorAddress ? (
        <EmployeeManager
          authority={normalizedAuthority}
          validator={validatorAddress}
          employees={employees}
          loading={loading}
          error={error}
          refresh={refresh}
        />
      ) : null}
    </>
  );
}
