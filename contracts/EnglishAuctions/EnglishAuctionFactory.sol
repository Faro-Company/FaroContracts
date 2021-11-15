//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EnglishAuction} from './EnglishAuction.sol';

contract AuctionFactory {

    mapping(uint256 => address) public auctions;
    event AuctionCreated(address auctionContract, address owner);

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId) public {
        EnglishAuction newAuction = new EnglishAuction(msg.sender, _bidIncrement,
            _auctionPeriodInSeconds, _token, _tokenId);
        auctions[_tokenId] = address(newAuction);
        emit AuctionCreated(address(newAuction), msg.sender);
    }

    function getAuction(uint256 _tokenId) public view returns (address) {
        return auctions[_tokenId];
    }
}
