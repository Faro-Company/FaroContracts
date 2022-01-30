//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import { FaroDutchAuction } from './FaroDutchAuction.sol';
import {FaroOffering} from "../Funding/FaroOffering.sol";

contract FaroDutchAuctionFactory is Ownable, Pausable {

    // vaultToken -> auctionAddress
    address[] public auctions;
    uint256 auctionCount;

    event AuctionCreated(address offeringAddress, address auctionContract, address owner);

    function createAuction(address faroOfferingAddress, uint256[] memory _priceUpdateArray, uint32 _supply,
        address[] memory _eligibleBidders) external whenNotPaused {
        address newAuction = address(new FaroDutchAuction(faroOfferingAddress, msg.sender,
            _priceUpdateArray, _supply, _eligibleBidders));
        auctions.push(newAuction);
        emit AuctionCreated(faroOfferingAddress, newAuction, msg.sender);
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

    function getLiveAuctions(uint32 liveAuctionStartIndex,
        uint32 liveAuctionEndIndex) public view returns (address[] memory) {
        require(liveAuctionEndIndex > liveAuctionStartIndex, "End index must be greater than start index");
        uint32 maxCount = liveAuctionEndIndex - liveAuctionStartIndex;
        uint32 count;
        require(auctionCount >= maxCount, "Number of auctions cannot be less than the number retrieved");
        bytes memory payload = abi.encodeWithSignature("auctionState()");
        address[] memory result = new address[](maxCount);
        uint[] memory countIndex = new uint[](maxCount);
        address auction;
        bytes memory returnData;
        bool success;
        for (uint i = liveAuctionStartIndex; i < liveAuctionEndIndex; i++) {
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
