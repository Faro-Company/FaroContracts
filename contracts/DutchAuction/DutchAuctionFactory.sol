//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { DutchAuction } from './DutchAuctionForOwnership.sol';
import { OfferableERC721TokenVault } from "../Funding/OfferableERC721TokenVault.sol";

contract AuctionFactory {
    address[] public auctions;

    event AuctionCreated(address auctionContract, address owner, uint numAuctions, address[] allAuctions);

    function AuctionFactory() {
    }

    function createAuction(uint startingPrice, OfferableERC721TokenVault vaultToken, uint[] memory _priceDeductionArray) {
        DutchAuction newAuction = new DutchAuction(startingPrice, vaultToken, _priceDeductionArray);
        auctions.push(newAuction);

        AuctionCreated(newAuction, msg.sender, auctions.length, auctions);
    }

    function allAuctions() constant returns (address[]) {
        return auctions;
    }
}
