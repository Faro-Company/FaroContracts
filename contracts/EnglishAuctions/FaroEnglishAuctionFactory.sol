//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {FaroEnglishAuction} from './FaroEnglishAuction.sol';

contract FaroEnglishAuctionFactory {

    address[] public auctions;
    event AuctionCreated(address auctionContract, address owner);
    uint256 auctionCount;

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) public {
        FaroEnglishAuction newAuction = new FaroEnglishAuction(msg.sender, _bidIncrement,
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

    function getLiveAuctions(uint32 liveAuctionStartIndex,
        uint32 liveAuctionEndIndex) public view returns (address[] memory) {
        uint32 maxCount = liveAuctionEndIndex - liveAuctionStartIndex;
        require(auctionCount >= maxCount);
        bytes memory payload = abi.encodeWithSignature("auctionState()");
        address[] memory result = new address[](maxCount);
        bytes memory returnData;
        address auction;
        bool success;
        uint count;
        for (uint32 i = liveAuctionStartIndex; i < liveAuctionEndIndex; i++) {
            auction = auctions[i];
            (success, returnData) = auction.staticcall(payload);
            if (success) {
                if (uint8(returnData[31]) == 1) {
                    result[i] = auction;
                    count++;
                }
            }
        }
        address[] memory filteredResult = new address[](count);
        for (uint i = 0; i < count; i++) {
            filteredResult[i] = result[i];
        }
        return filteredResult;
    }
}
