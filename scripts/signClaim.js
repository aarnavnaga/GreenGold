/**
 * Signs a sustainability claim for GreenGold.
 * Usage: PRIVATE_KEY=<verifier_private_key> node scripts/signClaim.js <claimant_address> <amount_wei> <nonce> <claimType> [chainId]
 * Example: PRIVATE_KEY=0x... node scripts/signClaim.js 0x1234... 1000000000000000000 1 0 11155111
 */
const { ethers } = require("ethers");

const [claimant, amountWei, nonce, claimType, chainIdRaw] = process.argv.slice(2);
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey || !claimant || amountWei === undefined || !nonce || claimType === undefined) {
  console.error("Usage: PRIVATE_KEY=<key> node scripts/signClaim.js <claimant> <amount_wei> <nonce> <claimType> [chainId]");
  process.exit(1);
}

const chainId = chainIdRaw ? BigInt(chainIdRaw) : 11155111n;
const amount = BigInt(amountWei);
const nonceBig = BigInt(nonce);
const claimTypeNum = parseInt(claimType, 10);

const wallet = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : "0x" + privateKey);
const messageHash = ethers.solidityPackedKeccak256(
  ["address", "uint256", "uint256", "uint8", "uint256"],
  [claimant, amount, nonceBig, claimTypeNum, chainId]
);
wallet.signMessage(ethers.getBytes(messageHash)).then((signature) => {
  console.log(signature);
});
