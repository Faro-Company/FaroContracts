//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EnglishAuction} from './EnglishAuction.sol';

contract EnglishAuctionFactory {

    address[] public auctions;
    event AuctionCreated(address auctionContract, address owner);
    uint256 auctionCount;

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) public {
        EnglishAuction newAuction = new EnglishAuction(msg.sender, _bidIncrement,
            _auctionPeriodInSeconds, _token, _tokenId, _floorPrice);
        address auctionAddress = address(newAuction);
        IERC721(_token).transferFrom(msg.sender, auctionAddress, _tokenId);
        auctions.push(auctionAddress);
        auctionCount++;
        emit AuctionCreated(auctionAddress, msg.sender);
    }

    function getLastAuction() public view returns(address) {
        return auctions[auctionCount - 1];
    }



    function getAuctionCount() public view returns(uint256) {
        return auctionCount;
    }

    function getAuction(uint256 auctionIndex) public view returns(address) {
        return auctions[auctionIndex];
    }
}
