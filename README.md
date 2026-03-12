# GreenGold (GGC)

ERC-20 token with two ways to acquire: (1) purchase with ETH at a fixed price, (2) mint via oracle-verified sustainability data (signature-based, mini carbon-credit style).

## Setup

```bash
npm install
npm run compile
```

## Tests

```bash
npm test
```

## Deployment

### Local (Hardhat network)

Uses the deployer as the sustainability verifier (for testing only):

```bash
npm run deploy:local
```

### Sepolia testnet

1. Set environment variables (never commit these):
   - `PRIVATE_KEY` – deployer wallet private key (hex, no `0x` prefix or with)
   - `SUSTAINABILITY_VERIFIER_ADDRESS` – address that will sign sustainability claims (can be an EOA or another wallet you control for testing)
   - Optional: `SEPOLIA_RPC_URL` (default: `https://rpc.sepolia.org`)
   - Optional: `ETHERSCAN_API_KEY` – for contract verification on Etherscan
   - Optional: `INITIAL_SUPPLY` – e.g. `1000000` (default: 1,000,000 tokens, 18 decimals)
   - Optional: `TOKEN_PRICE_WEI` – wei per token (default: `0.001` ETH)

2. Deploy:

```bash
npm run deploy
```

3. (Optional) Verify on Etherscan:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <INITIAL_SUPPLY> <TOKEN_PRICE_WEI> <SUSTAINABILITY_VERIFIER_ADDRESS>
```

Use the same constructor args as in your deploy (e.g. initial supply and token price as raw wei/ether values).

## Verifier key handling (sustainability oracle)

- The **sustainability verifier** is the address set at deploy (`SUSTAINABILITY_VERIFIER_ADDRESS`). Only signatures from this address are accepted by `claimWithSustainabilityData`.
- The verifier runs **off-chain** (script or backend). It receives claim data (e.g. renewable energy or emissions proof), checks it, then signs the claim so the user can submit it on-chain.
- **Never commit the verifier’s private key.** Use env vars or a secrets manager. The verifier key should be stored and used only on the server/script that issues signatures.
- The signed message is: `keccak256(abi.encodePacked(claimant, amount, nonce, claimType, chainId))`, with the standard Ethereum signed-message prefix. The contract checks that the signer equals `sustainabilityVerifier` and that the claim (by message hash) has not been used (replay protection).
- For local/testing, you can set `SUSTAINABILITY_VERIFIER_ADDRESS` to a test wallet and use that wallet’s key in the signing script.

## Signing a sustainability claim (verifier script)

Use the helper script to produce a signature for a claim (for testing or as a reference for your backend):

```bash
PRIVATE_KEY=<verifier_private_key> node scripts/signClaim.js <claimant_address> <amount_wei> <nonce> <claimType> [chainId]
```

Example (Sepolia chainId 11155111):

```bash
PRIVATE_KEY=0x... node scripts/signClaim.js 0x1234... 1000000000000000000 1 0 11155111
```

The output is the signature hex to pass to `claimWithSustainabilityData(amount, nonce, claimType, signature)`.
