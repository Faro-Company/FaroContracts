//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { DutchAuction } from './DutchAuction.sol';
import { OfferableERC721TokenVault } from "../Funding/OfferableERC721TokenVault.sol";

contract DutchAuctionFactory is Ownable {

    // vaultToken -> auctionAddress
    mapping(address => address) public auctions;
    event AuctionCreated(address auctionContract, address owner);

    function createAuction(uint256 _stopPrice, uint256 _maxTokensSold, address projectFundingAddress, address _fractional,
        uint[] memory _priceUpdateArray) public onlyOwner returns(DutchAuction) {
        DutchAuction newAuction = new DutchAuction(_stopPrice, _maxTokensSold, projectFundingAddress, _fractional,
            _priceUpdateArray);
        IERC20(_fractional).approve(address(newAuction), _maxTokensSold);
        auctions[msg.sender] = address(newAuction);
        emit AuctionCreated(address(newAuction), msg.sender);
        return newAuction;
    }

    function getAuction(address vaultToken) public view returns (address) {
        return auctions[vaultToken];
    }
}
