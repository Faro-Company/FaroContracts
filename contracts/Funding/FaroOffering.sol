//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "./FaroFractional.sol";


contract FaroOffering is ERC721HolderUpgradeable, PausableUpgradeable {

    /// @notice the ERC721 token address of the vault's token
    address private token;

    FaroFractional private fractional;

    /// @notice The project's funding address where blockchain's native currency is to be sent
    address payable private projectFundingAddress;

    address private owner;

    /// @notice Price of the share
    uint256 private listingPrice;

    /// @notice the length of auctions
    uint256 private listingPeriod;

    /// @notice the unix timestamp end time of the token auction
    uint256 private listingEnd;

    enum OfferingState { inactive, live, ended}

    OfferingState private listingState;

    /// @notice a mapping of users to their funding amounts
    mapping(address => uint256) private funders;


    uint256 private remaining;

    /// @notice An event emitted when a listing starts
    event Start(address starter);

    /// @notice An event emitted when bid happens
    event Bid(address bidder, uint256 amount);

    /// @notice An event emitted when end happens
    event End();

    modifier isOwner() {
        require(msg.sender == owner, "Sender is not the project owner.");
    }

    modifier timeTransition() {
        require(listingState == OfferingState.live, "Offering is not live.");
        if (block.timestamp > listingEnd || remaining == 0) {
            _end();
        }
        _;
    }

    function getProjectFundingAddress() public view returns(address payable) {
        return projectFundingAddress;
    }

    function getOfferingState() public view returns (OfferingState) {
        return listingState;
    }

    function getRemainingAllocation(address funder) public view returns(uint256) {
        return funders[funder];
    }

    function getRemaining() public view returns(uint256) {
        return remaining;
    }

    function getListingPrice() public view returns(uint256) {
        return listingPrice;
    }

    function getFractionalBalance(address funder) public view returns(uint256) {
        return fractional.balanceOf(funder);
    }

    function initialize(address _token, address payable _projectFundingAddress, address _owner,
        uint256 _supply, uint256 _listingPrice, uint _listingPeriod, string memory _name, string memory _symbol,
        address[] memory _funderAddresses, uint256[] memory allocations) external initializer {
        // initialize inherited contracts
        __ERC721Holder_init();
        fractional = new FaroFractional(_name, _symbol, _supply, address(this));
        // set storage variables
        token = _token;
        projectFundingAddress = _projectFundingAddress;
        owner = _owner;
        listingPeriod = _listingPeriod * 1 days;
        listingState = OfferingState.inactive;
        listingPrice = _listingPrice;
        require(_createFundersMapping(_funderAddresses, allocations) == _supply,
            "Given supply is not equal to the sum of allocations");
        remaining = _supply;
    }

    function _createFundersMapping(address[] memory _funderAddresses,
        uint256[] memory allocations) internal returns (uint256) {
        require(_funderAddresses.length == allocations.length,
            "Funders and allocation array sizes cannot be different");
        uint256 total;
        for (uint i = 0; i < _funderAddresses.length; i++) {
            funders[_funderAddresses[i]] = allocations[i];
            total += allocations[i];
        }
        return total;
    }

    /// @notice Start the offering
    function start() external isOwner {
        require(listingState == OfferingState.inactive, "Offering is already started");
        listingEnd = block.timestamp + listingPeriod;
        listingState = OfferingState.live;
        emit Start(msg.sender);
    }

    /// @notice an external function to bid on purchasing the vaults NFT.
    function bid(uint _amount) external payable timeTransition {
        uint256 totalToPxgsdfghghfghay = _amount * listingPrice;
        require(!paused(), "The bid is paused.");
        require(funders[msg.sender] > 0, "Address is not allowed to participate in the offering.");
        require(msg.value > 0, "Funds sent cannot be zero.");
        require(_amount > 0, "Bid amount cannot be zero.");
        require(funders[msg.sender] >= _amount, "Bid is more than allocated for this address.");
        require(totalToPay <= msg.value, "Funds sent for bid is less than the total capital required to buy the amount.");
        require(remaining >= _amount, "Remaining is less than the amount that is bid.");
        remaining -= _amount;
        funders[msg.sender] -= _amount;
        require(payable(projectFundingAddress).send(totalToPay), "Transfer amount not successful");
        fractional.transfer(msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
    }

    function _end() internal {
        require(listingState == OfferingState.live, "Offering is already closed.");
        listingState = OfferingState.ended;
        emit End();
    }

    /// @notice an external function to end an auction
    function end() external isOwner {
        _end();
    }

    function pause() external isOwner {
        _pause();
    }

    function unpause() external isOwner {
        _unpause();
    }

    function getFractionalAddress() public view returns (address) {
        return address(fractional);
    }

    function balanceOfFractional(address _holder) public view returns (uint256) {
        return fractional.balanceOf(_holder);
    }

    function extendToDutchAuction(address auctionAddress, uint newSupply) public isOwner onlyEnded {
        fractional.mint(newSupply, auctionAddress);
    }

}
