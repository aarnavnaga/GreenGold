import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "ethers";

const INITIAL_SUPPLY = ethers.parseEther("1000000");
const TOKEN_PRICE_WEI = ethers.parseEther("0.001");

describe("GreenGold", function () {
  async function deployGreenGoldFixture() {
    const [owner, buyer, verifier, other] = await hre.ethers.getSigners();
    const GreenGold = await hre.ethers.getContractFactory("GreenGold");
    const token = await GreenGold.deploy(
      INITIAL_SUPPLY,
      TOKEN_PRICE_WEI,
      verifier.address
    );
    return { token, owner, buyer, verifier, other };
  }

  describe("Deployment", function () {
    it("Should set name and symbol", async function () {
      const { token } = await loadFixture(deployGreenGoldFixture);
      expect(await token.name()).to.equal("GreenGold");
      expect(await token.symbol()).to.equal("GGC");
    });

    it("Should mint initial supply to deployer", async function () {
      const { token, owner } = await loadFixture(deployGreenGoldFixture);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set token price and verifier", async function () {
      const { token, verifier } = await loadFixture(deployGreenGoldFixture);
      expect(await token.tokenPriceWei()).to.equal(TOKEN_PRICE_WEI);
      expect(await token.sustainabilityVerifier()).to.equal(verifier.address);
    });
  });

  describe("ERC-20: transfer, burn", function () {
    it("Should transfer tokens", async function () {
      const { token, owner, buyer } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("100");
      await token.transfer(buyer.address, amount);
      expect(await token.balanceOf(buyer.address)).to.equal(amount);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - amount);
    });

    it("Should burn tokens", async function () {
      const { token, owner } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("500");
      await token.burn(amount);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - amount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - amount);
    });
  });

  describe("buyWithEth", function () {
    it("Should mint tokens for sent ETH at token price", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      const ethSent = ethers.parseEther("1");
      const expectedTokens = ethSent / TOKEN_PRICE_WEI;
      await token.connect(buyer).buyWithEth({ value: ethSent });
      expect(await token.balanceOf(buyer.address)).to.equal(expectedTokens);
    });

    it("Should emit TokensPurchased", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      const ethSent = ethers.parseEther("0.5");
      await expect(token.connect(buyer).buyWithEth({ value: ethSent }))
        .to.emit(token, "TokensPurchased")
        .withArgs(buyer.address, ethSent, ethSent / TOKEN_PRICE_WEI);
    });

    it("Should store ETH in contract", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      const ethSent = ethers.parseEther("1");
      await token.connect(buyer).buyWithEth({ value: ethSent });
      const contractAddress = await token.getAddress();
      expect(await hre.ethers.provider.getBalance(contractAddress)).to.equal(ethSent);
    });

    it("Should revert when zero ETH sent", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      await expect(
        token.connect(buyer).buyWithEth({ value: 0 })
      ).to.be.revertedWith("GreenGold: zero ETH sent");
    });

    it("Should revert when ETH below minimum for one token", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      await expect(
        token.connect(buyer).buyWithEth({ value: TOKEN_PRICE_WEI / 2n })
      ).to.be.revertedWith("GreenGold: ETH amount below minimum");
    });
  });

  describe("claimWithSustainabilityData", function () {
    async function signClaim(
      claimant: string,
      amount: bigint,
      nonce: bigint,
      claimType: number,
      chainId: bigint,
      signer: ethers.Signer
    ): Promise<string> {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint8", "uint256"],
        [claimant, amount, nonce, claimType, chainId]
      );
      return await signer.signMessage(ethers.getBytes(messageHash));
    }

    it("Should mint when valid verifier signature", async function () {
      const { token, buyer, verifier } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("100");
      const nonce = 1n;
      const claimType = 0;
      const network = await hre.ethers.provider.getNetwork();
      const signature = await signClaim(
        buyer.address,
        amount,
        nonce,
        claimType,
        network.chainId,
        verifier
      );
      await token.connect(buyer).claimWithSustainabilityData(amount, nonce, claimType, signature);
      expect(await token.balanceOf(buyer.address)).to.equal(amount);
    });

    it("Should emit SustainabilityClaimMinted", async function () {
      const { token, buyer, verifier } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("50");
      const nonce = 2n;
      const claimType = 1;
      const network = await hre.ethers.provider.getNetwork();
      const signature = await signClaim(
        buyer.address,
        amount,
        nonce,
        claimType,
        network.chainId,
        verifier
      );
      await expect(
        token.connect(buyer).claimWithSustainabilityData(amount, nonce, claimType, signature)
      )
        .to.emit(token, "SustainabilityClaimMinted")
        .withArgs(buyer.address, amount, nonce, claimType);
    });

    it("Should revert when claim already used", async function () {
      const { token, buyer, verifier } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("100");
      const nonce = 3n;
      const claimType = 0;
      const network = await hre.ethers.provider.getNetwork();
      const signature = await signClaim(
        buyer.address,
        amount,
        nonce,
        claimType,
        network.chainId,
        verifier
      );
      await token.connect(buyer).claimWithSustainabilityData(amount, nonce, claimType, signature);
      await expect(
        token.connect(buyer).claimWithSustainabilityData(amount, nonce, claimType, signature)
      ).to.be.revertedWith("GreenGold: claim already used");
    });

    it("Should revert when signature from non-verifier", async function () {
      const { token, buyer, other } = await loadFixture(deployGreenGoldFixture);
      const amount = ethers.parseEther("100");
      const nonce = 4n;
      const claimType = 0;
      const network = await hre.ethers.provider.getNetwork();
      const signature = await signClaim(
        buyer.address,
        amount,
        nonce,
        claimType,
        network.chainId,
        other
      );
      await expect(
        token.connect(buyer).claimWithSustainabilityData(amount, nonce, claimType, signature)
      ).to.be.revertedWith("GreenGold: invalid signature");
    });

    it("Should revert when amount is zero", async function () {
      const { token, buyer, verifier } = await loadFixture(deployGreenGoldFixture);
      const nonce = 5n;
      const claimType = 0;
      const network = await hre.ethers.provider.getNetwork();
      const signature = await signClaim(
        buyer.address,
        0n,
        nonce,
        claimType,
        network.chainId,
        verifier
      );
      await expect(
        token.connect(buyer).claimWithSustainabilityData(0n, nonce, claimType, signature)
      ).to.be.revertedWith("GreenGold: zero amount");
    });
  });

  describe("Owner", function () {
    it("Should set token price", async function () {
      const { token, owner } = await loadFixture(deployGreenGoldFixture);
      const newPrice = ethers.parseEther("0.002");
      await token.connect(owner).setTokenPriceWei(newPrice);
      expect(await token.tokenPriceWei()).to.equal(newPrice);
    });

    it("Should set sustainability verifier", async function () {
      const { token, owner, other } = await loadFixture(deployGreenGoldFixture);
      await token.connect(owner).setSustainabilityVerifier(other.address);
      expect(await token.sustainabilityVerifier()).to.equal(other.address);
    });

    it("Should withdraw ETH", async function () {
      const { token, owner, buyer } = await loadFixture(deployGreenGoldFixture);
      const ethSent = ethers.parseEther("1");
      await token.connect(buyer).buyWithEth({ value: ethSent });
      const balanceBefore = await hre.ethers.provider.getBalance(owner.address);
      const tx = await token.connect(owner).withdrawEth();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await hre.ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + ethSent - gasUsed);
    });

    it("Should revert setTokenPriceWei when not owner", async function () {
      const { token, other } = await loadFixture(deployGreenGoldFixture);
      await expect(
        token.connect(other).setTokenPriceWei(ethers.parseEther("0.002"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should revert setSustainabilityVerifier when not owner", async function () {
      const { token, buyer, other } = await loadFixture(deployGreenGoldFixture);
      await expect(
        token.connect(buyer).setSustainabilityVerifier(other.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should revert withdrawEth when not owner", async function () {
      const { token, buyer } = await loadFixture(deployGreenGoldFixture);
      await expect(token.connect(buyer).withdrawEth()).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert setTokenPriceWei when zero", async function () {
      const { token, owner } = await loadFixture(deployGreenGoldFixture);
      await expect(token.connect(owner).setTokenPriceWei(0)).to.be.revertedWith(
        "GreenGold: zero price"
      );
    });
  });
});
