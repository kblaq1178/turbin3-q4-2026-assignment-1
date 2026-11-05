# Phase 1 validation

Validated locally on 2026-11-05 with Node.js 22.19.0 and npm 10.9.3 in the managed Windows/PowerShell workspace. No development wallet was generated, no airdrop was requested, no blockchain transaction was broadcast, and no GitHub push or deployment was performed. Tests use public deterministic fixtures, in-memory RPC fakes, and an injected no-op journal writer.

## Installed dependency compatibility

| Package | Installed | Finding |
| --- | --- | --- |
| `@solana/web3.js` | 1.99.0 | Single deduplicated version used by SPL and Umi adapters |
| `@solana/spl-token` | 0.4.15 | Peer `@solana/web3.js ^1.95.5` accepts 1.99.0 |
| `@metaplex-foundation/mpl-core` | 1.10.0 | Peer Umi `>=0.8.2 <2.0.0` accepts 1.6.0; noble hashes peer also resolved by npm |
| `@metaplex-foundation/umi` | 1.6.0 | Single deduplicated version |
| `@metaplex-foundation/umi-bundle-defaults` | 1.6.0 | Peers Umi `^1.6.0` and web3.js `^1.99.0` both satisfied |
| `dotenv` | 18.0.9 | Local environment loading with quiet output |
| `typescript` | 5.9.3 | Strict NodeNext / ES2022 typecheck passed, dependency declaration checking enabled |
| `tsx` | 4.23.15 | Node >=18 requirement met; managed Windows launcher limitation below |
| `@types/node` | 26.6.6 | Installed types target a newer major than Node 22; project uses Node 22 APIs and typechecks, but matching the runtime major is advisable in future dependency maintenance |

`npm.cmd ls --depth=0` and the focused dependency tree returned exit code 0, with no invalid or unmet dependencies. Dependencies were neither reinstalled nor upgraded. Only the root lockfile's Node engine metadata was synchronized with package.json. MPL Core/Umi runtime functionality is outside this phase and has not been exercised.

Solana's official [SPL basics](https://solana.com/docs/tokens/basics) and [minting documentation](https://solana.com/docs/tokens/basics/mint-tokens) describe the original Token Program and the legacy web3.js 1.x plus SPL Token API used here. Compatibility above is based on the actual installed package manifests and npm dependency tree.

## Check results

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | PASS, exit 0, no compilation errors |
| `npm.cmd test` | Launcher blocked by managed environment: `uv_os_get_passwd` returned `ENOMEM` in tsx's Windows username lookup |
| Compile test modules, then run with Node | PASS, 10/10 offline safety tests |
| Git ignore behavior | PASS using Git check-ignore with an isolated temporary repository; project was not initialized as a Git repository |
| `npm.cmd audit --json` | INCOMPLETE: npm security endpoint unreachable; no vulnerability count can be asserted |
| Audit retry with local cache and bounded timeout | Same endpoint failure; no dependency changes made |
| Live Devnet integration | Pending manual execution after review, as required |

The passing offline tests cover exact base units, fractional formatting, invalid/self/off-curve recipients, rejection of Mainnet configuration, base58 encoding, expired transactions, recovery after finalization, missing finalized history, on-chain failure, identical-byte replay, and journal signature tampering.

The compiled test fallback used was:

```powershell
node node_modules/typescript/bin/tsc --noEmit false --outDir .state/check
node --test .state/check/tests/safety.test.js
```

This fallback is for tests only. Use the documented tsx scripts for actual wallet/token operations; compiled output under `.state/check` has a different module-relative project root. `tsx` remains configured as requested; no installed package was patched to bypass the Windows environment issue. Retry `npm.cmd test` in an ordinary local PowerShell session. The pure-JavaScript bigint binding fallback emitted by the Solana dependency stack is nonfatal; tests passed without rebuilding native bindings.

Git checks confirmed exclusion of `wallets/devnet-wallet.json`, another file under `wallets/`, `.env`, `.env.local`, `.state/devnet.json`, `exported-keypair.json`, and `id.json`. `.env.example` remains publishable. There was no preexisting `.git` directory, so no staged/tracked secret audit could be performed. Recheck staged files before the future initial commit.

## Outstanding work and limits

- Rerun `npm.cmd audit` from a network-enabled local environment. Registry failure is not evidence of zero vulnerabilities. Never use `npm audit fix --force` as an automatic remedy.
- Resolve or confirm the tsx username lookup issue in the user's normal shell before manual execution. No execution-policy changes are needed when using `npm.cmd`.
- Validate Windows ACL behavior during the manual wallet creation. The code applies ACL restrictions before writing secrets and stops if ACL setup fails; it was not executed during setup.
- Fund the development wallet manually from Phantom on Devnet, then perform mint creation, issuance, transfer, and verification. Add real public transaction evidence only after finalization.
- Expired or uncertain operations deliberately require review. Losing/deleting journal state or using the authority from another client can defeat local guards. Devnet availability, indexing, history retention, rate limits, and resets can affect execution.
- Mint authority is retained. There is no enforced fixed supply beyond the script's issuance guard; authority revocation and production operations are outside Phase 1.
- NFT functionality, GitHub submission, and article publication remain pending. The social draft must be updated with actual execution results before publication.

## Created and modified project files

Modified:

```text
package.json
package-lock.json  (root Node engine metadata only)
```

Created source/configuration/documentation files:

```text
.env.example
.gitignore
tsconfig.json
README.md
src/lib/config.ts
src/lib/connection.ts
src/lib/state.ts
src/lib/transaction.ts
src/wallet/create-wallet.ts
src/wallet/load-wallet.ts
src/wallet/balance.ts
src/spl-token/create-token.ts
src/spl-token/mint-token.ts
src/spl-token/transfer-token.ts
src/spl-token/verify.ts
src/spl-token/shared.ts
src/mpl-core/.gitkeep
metadata/.gitkeep
tests/safety.test.ts
docs/recovery.md
docs/transaction-evidence.md
docs/social-article-draft.md
docs/validation.md
```

The ignored `wallets/` directory is empty. Local checks also generated ignored files: `.state/check/` contains compiled JavaScript copies of the source and tests, and `.state/npm-cache/` contains npm audit cache/log artifacts. These are not wallet or on-chain evidence files and must not be submitted. No `wallets/devnet-wallet.json`, `.state/devnet.json`, or `.env` file was created.
