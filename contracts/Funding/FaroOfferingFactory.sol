//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./FaroOffering.sol";
import "./Proxy.sol";


contract FaroOfferingFactory is Ownable, Pausable {

    uint256 private offeringCount;

    address[] public offerings;

    address logic = address(new FaroOffering());

    event Mint(address indexed token, uint256 price, address vault, uint256 vaultId);

    function mint(address _token, address payable _projectFundingAddress, address _owner,
        uint32 _supply, uint256 _listPrice, uint _listingPeriod,
        string memory _name, string memory _symbol, address[] memory _funderAddresses,
        uint32[] memory _allocations) external onlyOwner whenNotPaused returns(uint256) {

        for (uint i = 0; i < _funderAddresses.length; i++){
            if (_funderAddresses[i] == _owner) {
                revert("Owner address cannot be among funders");
            }
        }

        bytes memory _initializationCalldata = abi.encodeWithSignature(
            "initialize(address,address,address,uint32,uint256,uint256,string,string,address[],uint32[])",
            _token,
            _projectFundingAddress,
            _owner,
            _supply,
            _listPrice,
            _listingPeriod,
            _name,
            _symbol,
            _funderAddresses,
            _allocations

        );

        address offering = address(new InitializedProxy(logic, _initializationCalldata));
        offerings.push(offering);
        offeringCount++;
        emit Mint(_token, _listPrice, offering, offeringCount);
        return offeringCount - 1;
    }

    function getLastOffering() public view returns (address) {
        require(offeringCount >= 1, "There are no offerings created by the factory, yet");
        return offerings[offeringCount - 1];
    }

    function getNumOfTokens() public view returns (uint256) {
        return offeringCount;
    }

    function getOffering(uint256 offeringNum) public view returns (address) {
        require(offeringNum < offeringCount, " Offering index is larger than the number of offerings");
        return offerings[offeringNum];
    }

    function getLiveOfferings(uint32 liveOfferingStartIndex,
        uint32 liveOfferingEndIndex) public view returns (address[] memory) {
        require(liveOfferingEndIndex > liveOfferingStartIndex, "End index must be greater than start index");
        uint32 maxCount = liveOfferingEndIndex - liveOfferingStartIndex;
        uint32 count;
        require(offerings.length >= maxCount, "Number of offerings cannot be less than the number retrieved");
        bytes memory offeringStatePayload = abi.encodeWithSignature("offeringState()");
        bytes memory pausedPayload = abi.encodeWithSignature("paused()");
        address[] memory result = new address[](maxCount);
        uint[] memory countIndex = new uint[](maxCount);
        address offering;

        bytes memory returnData;
        bytes memory returnData2;
        bool success;
        bool success2;
        for (uint i = liveOfferingStartIndex; i < liveOfferingEndIndex; i++) {
            offering = offerings[i];
            (success, returnData) = offering.staticcall(offeringStatePayload);
            (success2, returnData2) = offering.staticcall(pausedPayload);
            if (success && success2) {
                if (uint8(returnData[31]) == 1 && returnData2[31] == 0x0) {
                    result[i] = offering;
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
