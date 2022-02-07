//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "./FaroFractional.sol";


contract FaroOffering is ERC721HolderUpgradeable, PausableUpgradeable {

    address private token;
    FaroFractional private fractional;

    address payable public projectFundingAddress;
    address public owner;

    uint256 public listingPrice;
    uint256 public listingPeriod;
    uint256 public listingEnd;

    enum OfferingState { inactive, live, ended}

    OfferingState public offeringState;

    mapping(address => uint32) private funders;
    uint32 public remaining;
    uint16 constant FUNDER_QUERY_LIMIT = 1000;

    event Start(address starter);
    event Bid(address bidder, uint256 amount);
    event End();

    modifier isOwner() {
        require(msg.sender == owner, "Sender is not the project owner.");
        _;
    }

    modifier timeTransition() {
        require(offeringState == OfferingState.live, "Offering is not live.");
        if (block.timestamp > listingEnd || remaining == 0) {
            _end();
        }
        _;
    }

    function getRemainingAllocation(address funder) public view returns(uint256) {
        return funders[funder];
    }

    function getRemainingAllocationsBatch(address[] memory fundersToQuery) public view returns(uint[] memory){
        uint numFunders = fundersToQuery.length;
        require(numFunders <= FUNDER_QUERY_LIMIT, "Number of funders to be queried must be less than FUNDER_QUERY_LIMIT");
        uint[] memory allocations = new uint[](numFunders);
        for (uint i = 0; i <  numFunders; i++) {
            allocations[i] = funders[fundersToQuery[i]];
        }
        return allocations;
    }

    function getFractionalBalance(address funder) public view returns(uint256) {
        return fractional.balanceOf(funder);
    }

    function getFractionalAddress() public view returns (address) {
        return address(fractional);
    }

    function initialize(address _token, address payable _projectFundingAddress, address _owner,
        uint32 _supply, uint256 _listingPrice, uint _listingPeriod, string memory _name, string memory _symbol,
        address[] memory _funderAddresses, uint32[] memory allocations) external initializer {
        // initialize inherited contracts
        __ERC721Holder_init();
        fractional = new FaroFractional(_name, _symbol, _supply, address(this));
        // set storage variables
        token = _token;
        projectFundingAddress = _projectFundingAddress;
        owner = _owner;
        listingPeriod = _listingPeriod * 1 days;
        offeringState = OfferingState.inactive;
        listingPrice = _listingPrice;
        require(_createFundersMapping(_funderAddresses, allocations) == _supply,
            "Given supply is not equal to the sum of allocations");
        remaining = _supply;
    }

    function _createFundersMapping(address[] memory _funderAddresses,
        uint32[] memory allocations) internal returns (uint32) {
        require(_funderAddresses.length == allocations.length,
            "Funders and allocation array sizes cannot be different");
        uint32 total;
        for (uint i = 0; i < _funderAddresses.length; i++) {
            funders[_funderAddresses[i]] = allocations[i];
            total += allocations[i];
        }
        return total;
    }

    function start() external isOwner {
        require(offeringState == OfferingState.inactive, "Offering is already started");
        listingEnd = block.timestamp + listingPeriod;
        offeringState = OfferingState.live;
        emit Start(msg.sender);
    }

    function bid(uint32 _amount) external payable timeTransition {
        require(!paused(), "The bid is paused.");
        require(funders[msg.sender] > 0, "Address is not allowed to participate in the offering.");
        require(msg.value > 0, "Funds sent cannot be zero.");
        require(_amount > 0, "Bid amount cannot be zero.");
        require(funders[msg.sender] >= _amount, "Bid is more than allocated for this address.");
        uint256 totalToPay = _amount * listingPrice;
        require(totalToPay <= msg.value,
            "Funds sent for bid is less than the total capital required to buy the amount.");
        require(remaining >= _amount, "Remaining is less than the amount that is bid.");
        remaining -= _amount;
        funders[msg.sender] -= _amount;
        (bool success, ) = payable(projectFundingAddress).call{value: totalToPay}("");
        require(success, "Transfer amount not successful");
        fractional.transfer(msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
    }

    function _end() internal {
        require(offeringState == OfferingState.live, "Offering is already closed.");
        offeringState = OfferingState.ended;
        emit End();
    }

    function end() external isOwner {
        _end();
    }

    function pause() external isOwner {
        _pause();
    }

    function unpause() external isOwner {
        _unpause();
    }

    function extendToFaroDutchAuction(address auctionAddress, uint32 newSupply) public isOwner {
        require(offeringState == OfferingState.ended, "Offering is not ended");
        fractional.mint(newSupply, auctionAddress);
    }

}
