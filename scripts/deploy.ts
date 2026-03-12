import { ethers } from "hardhat";

async function main() {
  const initialSupply = process.env.INITIAL_SUPPLY
    ? ethers.parseEther(process.env.INITIAL_SUPPLY)
    : ethers.parseEther("1000000");
  const tokenPriceWei = process.env.TOKEN_PRICE_WEI
    ? BigInt(process.env.TOKEN_PRICE_WEI)
    : ethers.parseEther("0.001");
  const [deployer] = await ethers.getSigners();
  const verifierAddress =
    process.env.SUSTAINABILITY_VERIFIER_ADDRESS || deployer.address;
  if (process.env.SUSTAINABILITY_VERIFIER_ADDRESS) {
    console.log("Using verifier from env:", verifierAddress);
  } else {
    console.log("No SUSTAINABILITY_VERIFIER_ADDRESS set; using deployer as verifier (for local/test only)");
  }
  console.log("Deploying GreenGold with account:", deployer.address);
  console.log("Initial supply:", initialSupply.toString());
  console.log("Token price (wei):", tokenPriceWei.toString());
  console.log("Sustainability verifier:", verifierAddress);

  const GreenGold = await ethers.getContractFactory("GreenGold");
  const token = await GreenGold.deploy(initialSupply, tokenPriceWei, verifierAddress);
  await token.waitForDeployment();
  const address = await token.getAddress();
  console.log("GreenGold deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
