# Building a safe SPL token workflow on Solana Devnet

Draft for the Turbin3 Q4 Builders 2026 Assignment 1 submission. Implementation is complete for Phase 1; this draft makes no claim that transactions have already run. Add public evidence and personal observations after execution, then publish manually.

I built a TypeScript command-line workflow to create a nine-decimal SPL token, mint exactly 1,000 units, and transfer 10 to another wallet. I kept the signing wallet separate from Phantom: the local development keypair signs, while Phantom sends Devnet SOL to its public address. No seed phrase export is needed.

An SPL token has a mint account that identifies the asset and tracks its precision, supply, and authorities. Balances live in token accounts. My workflow uses associated token accounts so the sender and recipient have predictable addresses for this mint. Creating a missing account costs rent, which the sender pays along with transaction fees.

The key amount calculation is integer arithmetic. With nine decimals, 1,000 tokens becomes `1_000_000_000_000n` base units. JavaScript `bigint` preserves the exact amount. Checked mint and transfer instructions also verify the expected decimal precision.

The less obvious challenge is recovery. A request can time out after the chain accepts a transaction. Retrying with a fresh signature could mint twice or transfer twice. I save the signed transaction and its signature before submission, then check finalized history on reruns. A retry can reuse identical signed bytes; expired or uncertain operations stop for review. Creating the ATA and issuing or transferring tokens in one transaction also avoids partially completed token actions.

After the manual run, I will verify supply, both ATA balances, and the historical token changes from finalized transaction metadata. Expected results are 1,000 total supply, 990 in the sender ATA, and 10 in the recipient ATA, assuming no other activity. These are expectations until the public evidence is added.

This pattern could support community rewards, loyalty points, or game currencies. The wider lesson is that operational reliability—key handling, exact amounts, confirmation, and recovery—is part of blockchain engineering. A working instruction alone is not enough.

Next phases will add NFT creation and metadata updates with Metaplex Core, followed by optional ownership transfer and burning. Those functions have not been implemented yet.

Before publication: insert the GitHub URL, Devnet mint and transaction links, actual verification results, and lessons from execution. Review every screenshot for secrets. Publishing remains pending.
