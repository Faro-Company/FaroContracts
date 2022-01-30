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
    mapping(bytes => address) public tokenToAuction;

    function createAuction(uint256 _bidIncrement, uint256 _auctionPeriodInSeconds,
        address _token, uint256 _tokenId, uint256 _floorPrice) external whenNotPaused {
        address existingAuctionAddress = tokenToAuction[abi.encodePacked(_token, _tokenId)];
        bool success;
        bytes memory returnData;
        if (existingAuctionAddress != address(0)) {
            (success, returnData) = existingAuctionAddress.staticcall(
                abi.encodeWithSignature("auctionState()"));
            require(success && uint8(returnData[31]) == 2,
                "There is already a non-ended auction with given token address and ID");
            (success, returnData) = existingAuctionAddress.staticcall(
                abi.encodeWithSignature("highestBidder()"));
            require(success && abi.decode(returnData, (address)) == msg.sender,
                "Auction can only be deployed by the owner of the token.");
        }
        FaroEnglishAuction newAuction = new FaroEnglishAuction(msg.sender, _bidIncrement,
            _auctionPeriodInSeconds, _token, _tokenId, _floorPrice);
        address auctionAddress = address(newAuction);
        tokenToAuction[abi.encodePacked(_token, _tokenId)] = auctionAddress;
        auctions.push(auctionAddress);
        auctionCount++;
        IERC721(_token).transferFrom(msg.sender, auctionAddress, _tokenId);
        emit AuctionCreated(auctionAddress, msg.sender);
    }

    function getLastAuction() public view returns(address) {
        require(auctionCount >= 1, "There aren't any auctions created by the factory");
        return auctions[auctionCount - 1];
    }

    function getAuctionCount() public view returns(uint256) {
        return auctionCount;
    }

    function getAuction(uint256 auctionIndex) public view returns(address) {
        require(auctionIndex < auctionCount, "Index is larger than the number of auctions");
        return auctions[auctionIndex];
    }

    function getLiveAuctions(uint32 liveAuctionStartIndex,
        uint32 liveAuctionEndIndex) public view returns (address[] memory) {
        require(liveAuctionEndIndex > liveAuctionStartIndex, "End index must be greater than start index");
        uint32 maxCount = liveAuctionEndIndex - liveAuctionStartIndex;
        require(auctionCount >= maxCount, "Number of auctions cannot be less than the number retrieved");
        bytes memory payload = abi.encodeWithSignature("auctionState()");
        address[] memory result = new address[](maxCount);
        uint[] memory countIndex = new uint[](maxCount);
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
                    countIndex[count] = i;
                    count++;
                }
            }
        }
        address[] memory filteredResult = new address[](count);
        for (uint i = 0; i < count; i++) {
            filteredResult[i] = result[countIndex[i]];
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
