# Public Devnet evidence

I completed all three mandatory assignment tasks on Solana Devnet. The SPL evidence below comes from the existing Phase 1 journal. Both MPL Core transactions were independently reported as finalized by the read-only verification script. This documentation update did not submit transactions or perform a fresh RPC check.

Never paste wallet JSON, seed phrases, private keys, environment files, or signed transaction bytes here. This record contains only public evidence.

## SPL token

| Field | Verified value |
| --- | --- |
| Network | Devnet |
| Development public address | [BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT](https://explorer.solana.com/address/BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT?cluster=devnet) |
| Recipient public address | [BA1p3kVRP8zRw8qFnLRcE46M2bnsFpZsyhZ3ppFwmmUK](https://explorer.solana.com/address/BA1p3kVRP8zRw8qFnLRcE46M2bnsFpZsyhZ3ppFwmmUK?cluster=devnet) |
| Mint address | [7KSFsfZN4PTGLHsmKVbjRGDiBZmKLFTki2o6DBECwib](https://explorer.solana.com/address/7KSFsfZN4PTGLHsmKVbjRGDiBZmKLFTki2o6DBECwib?cluster=devnet) |
| Decimals | 9 |
| Final supply | 1,000 tokens |
| Final sender ATA balance | 990 tokens at verification |
| Final recipient ATA balance | 10 tokens at verification |
| Verification date (UTC) | 2026-11-05 |

| Operation | Signature / Devnet Explorer | Status | Finalized slot |
| --- | --- | --- | --- |
| Create mint | [iK3MLoUbP8oRZLeq7wS5LGbS2nTutzdNhe2sNPTkvtt7MseZScVXERgmALZpZvKPBMSVWrka2qVVY74dm1efxgq](https://explorer.solana.com/tx/iK3MLoUbP8oRZLeq7wS5LGbS2nTutzdNhe2sNPTkvtt7MseZScVXERgmALZpZvKPBMSVWrka2qVVY74dm1efxgq?cluster=devnet) | Finalized | 518861067 |
| Mint 1,000 tokens | [45B81r78vyh2w9u8RQ8A6rDYDHYV3AUsCLp7VKVxp7yA3Xn5XqheHREgiL9fP9BtPJnSFzbbHhuPijVpgGqUqc43](https://explorer.solana.com/tx/45B81r78vyh2w9u8RQ8A6rDYDHYV3AUsCLp7VKVxp7yA3Xn5XqheHREgiL9fP9BtPJnSFzbbHhuPijVpgGqUqc43?cluster=devnet) | Finalized | 518861419 |
| Transfer 10 tokens | [3vXHye5y8JR7kX2NhnmCBJY18U9p8XL4iJr9WQFAoL2QfWuSS6EFHKRKjfw7j28HJYJpSeTiyALeVyoajybYuPH5](https://explorer.solana.com/tx/3vXHye5y8JR7kX2NhnmCBJY18U9p8XL4iJr9WQFAoL2QfWuSS6EFHKRKjfw7j28HJYJpSeTiyALeVyoajybYuPH5?cluster=devnet) | Finalized | 518862717 |

## MPL Core NFT

I created **Turbin3 Devnet Gull**, then changed its on-chain name to **Turbin3 Devnet Gull Evolved** and updated its metadata URI. The owner and update authority remained the same wallet.

| Field | Verified value |
| --- | --- |
| Network | Devnet |
| Asset | [2HinZ3FejE6EQeJ4XRPDCzQttrZUneUd9cMv9Udz6YqA](https://explorer.solana.com/address/2HinZ3FejE6EQeJ4XRPDCzQttrZUneUd9cMv9Udz6YqA?cluster=devnet) |
| Original name | Turbin3 Devnet Gull |
| Updated name | Turbin3 Devnet Gull Evolved |
| Updated metadata URI | [updated.json](https://kblaq1178.github.io/turbin3-q4-2026-assignment-1/metadata/updated.json) |
| Owner | [BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT](https://explorer.solana.com/address/BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT?cluster=devnet) |
| Update authority | [BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT](https://explorer.solana.com/address/BrEqFTA4SmzjXe5fC7FzgXSMubdu6BziRjfQvh6NmunT?cluster=devnet) |

| Operation | Signature / Devnet Explorer | Status |
| --- | --- | --- |
| Create asset | [3inheUJ3ESDJDqXdN4VeYsjeguDimkBDfG55BihexHcPnqs5vEHQCNxvTgH87kKX1bw5zyS4igQKnZJgQGoWTKGx](https://explorer.solana.com/tx/3inheUJ3ESDJDqXdN4VeYsjeguDimkBDfG55BihexHcPnqs5vEHQCNxvTgH87kKX1bw5zyS4igQKnZJgQGoWTKGx?cluster=devnet) | Finalized |
| Update name and URI | [5DnW1aZuR1yNUXquBSQam46UkHuobmzEJFU9FT4NmCxVZpFyqzK35gXXBV7cM4tQNa6gqq4SM4iNcypU3BkCyLM7](https://explorer.solana.com/tx/5DnW1aZuR1yNUXquBSQam46UkHuobmzEJFU9FT4NmCxVZpFyqzK35gXXBV7cM4tQNa6gqq4SM4iNcypU3BkCyLM7?cluster=devnet) | Finalized |

Both NFT statuses were independently confirmed by the read-only verification script. NFT finalized slots and verification timestamps were not included in the supplied evidence, so they are not asserted here.

## Assignment status

| Task | Result |
| --- | --- |
| SPL token creation, minting, and transfer | Complete; verified on Devnet |
| MPL Core NFT creation | Complete; finalized and verified on Devnet |
| NFT name and metadata URI update | Complete; finalized and verified on Devnet |
| Optional NFT ownership transfer | Intentionally skipped |
| Optional NFT burn | Intentionally skipped |
