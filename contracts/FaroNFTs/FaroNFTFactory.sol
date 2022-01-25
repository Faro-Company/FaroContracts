//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./FaroNFT.sol";


contract FaroNFTFactory is Ownable, Pausable {

    uint256 private nftCount;

    address[] public nfts;

    event NFTCreated(address indexed token);

    function createNFT(string memory _contentName, string memory _symbol, string memory _agreementUri, uint _contentID,
        address[] memory ownerAddresses) external onlyOwner whenNotPaused returns(uint256) {
        FaroNFT nft = new FaroNFT(_contentName, _symbol, _agreementUri, _contentID);
        for (uint i = 0; i < ownerAddresses.length; i++) {
            nft.mint(ownerAddresses[i], i);
        }
        address nftAddress = address(nft);
        nfts.push(nftAddress);
        nftCount++;
        emit NFTCreated(nftAddress);
        return nftCount;
    }

    function getLastNFT() public view returns (address) {
        return nfts[nftCount - 1];
    }

    function getNumOfNFTS() public view returns (uint256) {
        return nftCount;
    }

    function getNFT(uint256 nftNum) public view returns (address) {
        return nfts[nftNum];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
