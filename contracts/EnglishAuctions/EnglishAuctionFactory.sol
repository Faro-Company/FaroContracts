//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EnglishAuction} from './EnglishAuction.sol';

contract AuctionFactory {

    address[] public auctions;
    event AuctionCreated(address auctionContract, address owner);
    uint256 auctionCount;

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) public {
        EnglishAuction newAuction = new EnglishAuction(msg.sender, _bidIncrement,
            _auctionPeriodInSeconds, _token, _tokenId, _floorPrice);
        auctions.push(address(newAuction));
        auctionCount++;
        emit AuctionCreated(address(newAuction), msg.sender);
    }

    function getLastAuction() public view returns(address) {
        return auctions[auctionCount];
    }

    function getAuctionCount() public view returns(uint256) {
        return auctionCount;
    }
}
