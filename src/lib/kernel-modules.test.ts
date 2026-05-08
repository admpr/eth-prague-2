import assert from "node:assert/strict";
import test from "node:test";
import { decodeAbiParameters, decodeFunctionData, getAddress, zeroAddress } from "viem";
import {
  BASE_SEPOLIA_CHAIN_ID,
  KERNEL_EXECUTE_SELECTOR,
  KERNEL_MODULE_TYPE_VALIDATOR,
  buildAgentReadyCookieName,
  buildAgentReadyCacheKey,
  buildInstallAgentPermissionValidatorCalldata,
  buildIsAgentPermissionValidatorInstalledArgs,
  normalizeAgentPermissionValidatorAddress,
  toFireflyTransactionParams,
} from "./kernel-modules";

const validator = "0x1111111111111111111111111111111111111111";
const authority = "0x2222222222222222222222222222222222222222";

test("builds Kernel 3.3 installModule calldata for the agent permission validator", () => {
  const calldata = buildInstallAgentPermissionValidatorCalldata(validator);
  const decoded = decodeFunctionData({
    abi: [
      {
        type: "function",
        name: "installModule",
        stateMutability: "payable",
        inputs: [
          { name: "moduleTypeId", type: "uint256" },
          { name: "module", type: "address" },
          { name: "initData", type: "bytes" },
        ],
        outputs: [],
      },
    ],
    data: calldata,
  });

  assert.equal(decoded.functionName, "installModule");
  assert.deepEqual(decoded.args?.slice(0, 2), [
    BigInt(KERNEL_MODULE_TYPE_VALIDATOR),
    getAddress(validator),
  ]);

  const initData = decoded.args?.[2] as `0x${string}`;
  assert.equal(`0x${initData.slice(2, 42)}`, zeroAddress);

  const [validatorData, hookData, selectorData] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
    `0x${initData.slice(42)}`,
  );
  assert.equal(validatorData, "0x");
  assert.equal(hookData, "0x");
  assert.equal(selectorData, KERNEL_EXECUTE_SELECTOR);
});

test("builds Kernel isModuleInstalled args for the configured validator", () => {
  const args = buildIsAgentPermissionValidatorInstalledArgs(validator);

  assert.deepEqual(args, [BigInt(KERNEL_MODULE_TYPE_VALIDATOR), getAddress(validator), "0x"]);
});

test("normalizes a signed Firefly transaction request into byte-array CBOR params", () => {
  const params = toFireflyTransactionParams({
    chainId: BigInt(BASE_SEPOLIA_CHAIN_ID),
    nonce: 7n,
    gasLimit: 120000n,
    maxFeePerGas: 25_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    to: authority,
    value: 0n,
    data: buildInstallAgentPermissionValidatorCalldata(validator),
  });

  assert.deepEqual(Array.from(params.type), [2]);
  assert.deepEqual(Array.from(params.chainId), [0x01, 0x4a, 0x34]);
  assert.deepEqual(Array.from(params.nonce), [7]);
  assert.deepEqual(Array.from(params.to), Array.from(Buffer.from(authority.slice(2), "hex")));
  assert.equal(params.value.length, 0);
  assert.equal(params.accessList.length, 0);
});

test("normalizes a configured validator address", () => {
  assert.equal(normalizeAgentPermissionValidatorAddress(validator), getAddress(validator));
  assert.equal(normalizeAgentPermissionValidatorAddress("not-an-address"), undefined);
  assert.equal(normalizeAgentPermissionValidatorAddress(undefined), undefined);
});

test("builds an agent-ready cache key scoped to chain, wallet, delegate, and validator", () => {
  const key = buildAgentReadyCacheKey({
    authority,
    delegate: "0x3333333333333333333333333333333333333333",
    validator,
  });

  assert.equal(
    key,
    "agentforce:agent-ready:v1:84532:0x2222222222222222222222222222222222222222:0x3333333333333333333333333333333333333333:0x1111111111111111111111111111111111111111",
  );
});

test("builds a cookie-safe marker name for cached agent readiness", () => {
  const name = buildAgentReadyCookieName({
    authority,
    delegate: "0x3333333333333333333333333333333333333333",
    validator,
  });

  assert.match(name, /^af_ready_[a-f0-9]{8}$/);
});
