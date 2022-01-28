//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {FaroEnglishAuction} from './FaroEnglishAuction.sol';

contract FaroEnglishAuctionFactory is Ownable, Pausable {

    address[] public auctions;
    event AuctionCreated(address auctionContract, address owner);
    uint256 auctionCount;

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) external whenNotPaused {
        FaroEnglishAuction newAuction = new FaroEnglishAuction(msg.sender, _bidIncrement,
            _auctionPeriodInSeconds, _token, _tokenId, _floorPrice);
        auctions.push(auctionAddress);
        auctionCount++;
        address auctionAddress = address(newAuction);
        IERC721(_token).transferFrom(msg.sender, auctionAddress, _tokenId);
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
        require(liveAuctionEndIndex > liveAuctionStartIndex, "End index must be greater than start index");
        uint32 maxCount = liveAuctionEndIndex - liveAuctionStartIndex;
        require(auctionCount >= maxCount, "Number of auctions cannot be less than the number retrieved");
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

}
