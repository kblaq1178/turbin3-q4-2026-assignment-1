# Tasks 2 and 3: standalone Core NFT

Implementation only. No NFT has been minted or updated by this phase. Task 1 is already completed and verified on Devnet; do not rerun token commands. NFT scripts use the existing `wallets/devnet-wallet.json` and never modify it, `.env`, `.state/devnet.json`, or the SPL scripts. No upload, airdrop, NFT transfer, burn, or GitHub push is automated.

## Metadata hosting, before creation

`metadata/original.json` and `metadata/updated.json` are valid JSON metadata documents with distinct names, descriptions, HTTPS images, and attributes. Their local paths are **not public metadata URIs**. Both currently reference the real [Western Gull photograph by Dschwen](https://commons.wikimedia.org/wiki/File:Gull_portrait_ca_usa.jpg), unchanged, with CC BY 2.5 attribution and license links in each description. Wikimedia serves the image; no image was uploaded by this project. Availability there is outside your control.

For stable hosting, manually download that original photograph (or choose your own image), upload it through your chosen permanent storage provider's UI, and obtain its public HTTPS content URL. A practical alternative is IPFS with a paid or maintained pin and an HTTPS gateway URL containing the CID. Keep pinning active; gateways can be unavailable. An Arweave upload with a retained transaction ID is another approach. These uploads may have costs and require a separate manual provider workflow; do not give that provider this development wallet's private key.

If you host a copy or choose another image, edit `image` in **both local JSON files before minting**, retain required attribution, and upload the image first. Then upload the two JSON files separately. Retain the upload receipts/content IDs and use distinct, publicly readable, stable HTTPS URLs for the original and updated documents. Do not overwrite original metadata in place. Authenticated dashboards, expiring signed links, share/preview pages, `ipfs://` URIs, and local paths are unsuitable for these scripts. A static HTTPS host with permanent versioned paths also works if you maintain it. No metadata hosting credentials or uploader dependencies are needed in this project.

The server must return HTTP 2xx, JSON as `application/json` (or `+json`), and the image as a supported `image/*` type. GETs must work without cookies/authentication and without redirects. Images are limited to 10 MB and JSON to 100 KB; image file signatures are checked. The JSON must match the respective local document structurally, including any extra fields. The project limits names to 32 UTF-8 bytes and metadata URIs to 200 bytes. Both names and URIs must differ. Reachability validation cannot promise future availability or prove storage permanence.

## Manual commands

Run from this project in your normal PowerShell session, after reviewing the implementation and funding the existing wallet with Devnet SOL. Do not recreate the wallet or copy over the existing `.env`.

```powershell
$env:SOLANA_NETWORK = 'devnet'
$env:SOLANA_RPC_URL = 'https://api.devnet.solana.com'
$env:NFT_ORIGINAL_URI = Read-Host 'Public HTTPS URL for original.json'
$env:NFT_UPDATED_URI = Read-Host 'Public HTTPS URL for updated.json'
npm.cmd run nft:validate-metadata
```

Validation performs only HTTP GETs; it does not load a wallet or submit a transaction. Do not execute the following commands until you intend to submit the two assignment transactions:

```powershell
npm.cmd run nft:create
npm.cmd run nft:verify
npm.cmd run nft:update
npm.cmd run nft:verify
```

Creation validates **both** hosted JSON documents and both image responses before signing, builds Core `create()` for a standalone asset, and sets the wallet explicitly as owner and update authority. The wallet pays fees and storage costs. The temporary asset keypair exists only in memory; recovery retains its signed creation transaction, never its secret key. Each RPC client checks the Devnet genesis hash and accepts only `https://api.devnet.solana.com`, with finalized reads/confirmation. `fromWeb3JsKeypair` and `createSignerFromKeypair` adapt the existing Web3 wallet to Umi; Core builder instructions are converted to Web3 instructions for durable legacy transaction signing. Both installed SDK versions are exercised offline.

Update first resolves creation, checks that the wallet is the direct `Address` update authority (collection authority and delegates are rejected), and checks the original owner/name/URI on-chain. It revalidates the hosted plan and its content hashes, then submits Core `update()` with **both** the new name and URI in one transaction. It retains ownership and update authority. After finalization, creation/update fetch the Core account and verify program owner, asset address, owner, update authority, name, and URI, then save first verification evidence. Read-only verification reports current fields and all recorded signatures, statuses and Explorer links; unavailable history is explicitly reported as unknown.

## Journal and crash recovery

The separate `.state/mpl-core-devnet.json` records wallet/network binding, asset address, intended owner/update authority, both metadata plans and content hashes, signed transaction bytes, signature, blockhash expiry, finalized slot and first verification evidence. Do not publish it: signed bytes can be submitted while valid. Keep an encrypted backup with the existing wallet and Phase 1 state. Losing the NFT journal removes the duplicate prevention guard; **never delete it to mint again**.

An exclusive `.state/mpl-core-operation.lock` protects NFT operations. Journal writes sync a temporary file before atomic rename. No transaction is sent until the complete signed journal is saved, and an `attempted` marker is saved before the send. State write failures stop execution. Signed bytes and signatures are validated on reads. No private keys are serialized into the journal. Directory rename durability across sudden power loss depends on the filesystem; keep backups.

Only the invocation which just prepared an operation submits it once, with preflight and RPC retries disabled. Rerunning create/update checks recorded transaction history and **never rebroadcasts**, never refreshes the blockhash and never generates a replacement. A finalized successful transaction is recovered and checked against the account. Pending, expired, failed, or absent history stops for manual review. A crash between saving and sending can leave a transaction that was never sent: it is deliberately treated as uncertain, too. Errors are not proof of failure; even failed transactions may charge a fee.

1. Preserve the journal and run `nft:verify`; inspect its public Explorer links and the asset account. Wait and retry reads if indexing is delayed.
2. If a process crashed and left a lock, confirm that **no NFT process is running** before removing only `.state/mpl-core-operation.lock`. Leave every other state file intact.
3. Rerun the original command only to recover a finalized transaction and complete field verification. If history remains unavailable, consult a historical RPC/Explorer and retain the evidence. These scripts intentionally provide no force/retry/replacement option. Preparing any replacement requires a separately reviewed recovery procedure proving the old transaction cannot execute and reconciling the existing asset. Do not hand-edit the journal to bypass this policy.

A completed create rerun verifies the recorded asset and never creates another. A completed update rerun verifies the updated fields and never sends again. First successful evidence is retained; verification reports current state, which external authority use can change later. RPC snapshots are separate reads, not one atomic snapshot. These guards protect the retained journal, not deliberate external wallet use or a Devnet reset.

## Local validation and compatibility

```powershell
npm.cmd run typecheck
npm.cmd test
```

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and unused checks remain enabled. Importing Umi 1.6.0 exposes three upstream declaration diagnostics with `skipLibCheck: false`: unresolved `DeserializedAccounts` and `MaybeDeserializedAccounts` in `Account.d.ts`, and optional `maxRedirects` incompatibility in `HttpRequest.d.ts`. `skipLibCheck: true` skips dependency declarations while retaining strict checking of project source and tests; no installed packages are patched.

This managed Windows environment has the same tsx `uv_os_get_passwd` / `ENOMEM` launcher issue recorded in Phase 1. The offline fallback compiles into ignored `dist/phase2-check` and copies the public metadata fixtures there so module-relative paths stay valid:

```powershell
node node_modules/typescript/bin/tsc --noEmit false --outDir dist/phase2-check
New-Item -ItemType Directory -Force dist/phase2-check/metadata | Out-Null
Copy-Item metadata/original.json,metadata/updated.json dist/phase2-check/metadata/
node --test dist/phase2-check/tests/*.test.js
```

**Use this compiled directory only for offline tests.** Its module-relative wallet/state root is different. Run actual commands using the npm/tsx scripts in a normal user shell. This session cannot read the wallet because of its ACL; permissions were left untouched.

The only additional direct dependency is `@metaplex-foundation/umi-web3js-adapters` pinned to **1.6.0**, already installed transitively and recorded in the lockfile. No package upgrade or uploader is needed. An attempted offline npm install could not resolve registry metadata from cache; the root package and lockfile dependency declarations were synchronized without changing installed packages. A fresh machine uses `npm.cmd ci`. Never use `npm audit fix --force`.

Reference APIs: [official Umi Web3 adapters](https://www.metaplex.com/docs/dev-tools/umi/web3js-differences-and-adapters), [Core JavaScript SDK](https://www.metaplex.com/docs/smart-contracts/core/sdk/javascript), and installed Core 1.10.0 declarations. Actual transaction results remain pending manual execution; no NFT address or signature is claimed yet.

Validation on 2026-11-05: `npm.cmd run typecheck` passed; `npm.cmd ls --depth=0` passed with the requested installed versions and no unmet dependencies. `npm.cmd test` hit the documented launcher error. The compiled Node fallback passed **26/26 offline tests** (16 Core tests and 10 unchanged Phase 1 tests). Coverage includes documented keypair conversion/signing, serialized Core create/update instructions, signed-byte simulation, authority/field rejection, journal validation, finalization recovery, unknown/failed outcomes without rebroadcast, persistence failure, lost send response, URL/content checks and both local JSON files. Test transaction output comes only from in-memory RPC fakes. Public metadata URL validation and live Devnet execution remain pending manual hosting/execution. No NFT journal was created by validation.
