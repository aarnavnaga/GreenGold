// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GreenGold
 * @dev ERC-20 token with purchase (ETH) and sustainability-claim (oracle-signed) minting.
 */
contract GreenGold is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    uint256 public tokenPriceWei;
    address public sustainabilityVerifier;
    mapping(bytes32 => bool) public claimUsed;

    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event SustainabilityClaimMinted(
        address indexed claimant,
        uint256 amount,
        uint256 nonce,
        uint8 claimType
    );

    constructor(
        uint256 initialSupply,
        uint256 _tokenPriceWei,
        address _sustainabilityVerifier
    ) ERC20("GreenGold", "GGC") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        tokenPriceWei = _tokenPriceWei;
        sustainabilityVerifier = _sustainabilityVerifier;
    }

    /**
     * @dev Purchase tokens with ETH at the current token price.
     */
    function buyWithEth() external payable nonReentrant {
        require(msg.value > 0, "GreenGold: zero ETH sent");
        uint256 tokenAmount = msg.value / tokenPriceWei;
        require(tokenAmount > 0, "GreenGold: ETH amount below minimum");
        _mint(msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    /**
     * @dev Claim tokens using oracle-verified sustainability data (signature-based).
     * @param amount Token amount to mint.
     * @param nonce Unique claim id to prevent replay.
     * @param claimType Category (e.g. 0 = renewable energy, 1 = emissions reduction).
     * @param signature Signature from sustainabilityVerifier over (claimant, amount, nonce, claimType, chainId).
     */
    function claimWithSustainabilityData(
        uint256 amount,
        uint256 nonce,
        uint8 claimType,
        bytes calldata signature
    ) external nonReentrant {
        require(sustainabilityVerifier != address(0), "GreenGold: verifier not set");
        require(amount > 0, "GreenGold: zero amount");

        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, amount, nonce, claimType, block.chainid)
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        require(!claimUsed[messageHash], "GreenGold: claim already used");
        claimUsed[messageHash] = true;

        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);
        address signer = ecrecover(ethSignedHash, v, r, s);
        require(signer == sustainabilityVerifier, "GreenGold: invalid signature");

        _mint(msg.sender, amount);
        emit SustainabilityClaimMinted(msg.sender, amount, nonce, claimType);
    }

    function _splitSignature(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(signature.length == 65, "GreenGold: invalid signature length");
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
    }

    function setTokenPriceWei(uint256 _tokenPriceWei) external onlyOwner {
        require(_tokenPriceWei > 0, "GreenGold: zero price");
        tokenPriceWei = _tokenPriceWei;
    }

    function setSustainabilityVerifier(address _sustainabilityVerifier) external onlyOwner {
        sustainabilityVerifier = _sustainabilityVerifier;
    }

    function withdrawEth() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "GreenGold: no ETH to withdraw");
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "GreenGold: withdraw failed");
    }
}
