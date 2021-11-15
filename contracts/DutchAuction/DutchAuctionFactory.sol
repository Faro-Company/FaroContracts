//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { DutchAuction } from './DutchAuction.sol';
import { OfferableERC721TokenVault } from "../Funding/OfferableERC721TokenVault.sol";

contract AuctionFactory {

    // vaultToken -> auctionAddress
    mapping(address => address) public auctions;
    event AuctionCreated(address vaultToken, address auctionContract, address owner);

    function createAuction(address vaultToken, uint256[] memory _priceUpdateArray) public {
        DutchAuction newAuction = new DutchAuction(vaultToken, _priceUpdateArray);
        auctions[vaultToken] = address(newAuction);
        emit AuctionCreated(vaultToken, address(newAuction), msg.sender);
    }

    function getAuction(address vaultToken) public view returns (address) {
        return auctions[vaultToken];
    }
}
