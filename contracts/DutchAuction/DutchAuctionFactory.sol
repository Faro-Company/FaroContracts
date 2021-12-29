//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { DutchAuction } from './DutchAuction.sol';
import {FaroOffering} from "../Funding/FaroOffering.sol";

contract DutchAuctionFactory {

    // vaultToken -> auctionAddress
    address[] public auctions;
    uint256 auctionCount;

    event AuctionCreated(address offeringAddress, address auctionContract, address owner);

    function createAuction(address faroOfferingAddress, uint256[] memory _priceUpdateArray, uint256 _supply,
        address[] memory _eligibleBidders) public {
        address newAuction = address(new DutchAuction(faroOfferingAddress, msg.sender,
            _priceUpdateArray, _supply, _eligibleBidders));
        auctions.push(address(newAuction));
        emit AuctionCreated(faroOfferingAddress, address(newAuction), msg.sender);
        auctionCount += 1;
    }

    function getAuction(uint256 index) public view returns (address) {
        return auctions[index];
    }

    function getLastAuction() public view returns(address) {
        return auctions[auctionCount - 1];
    }

    function getAuctionCount() public view returns(uint256) {
        return auctionCount;
    }
}
