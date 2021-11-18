//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";


contract OfferableERC721TokenVault is ERC20Upgradeable, ERC721HolderUpgradeable, Pausable {

    Utils utils = new Utils();

    /// -----------------------------------
    /// -------- TOKEN INFORMATION --------
    /// -----------------------------------

    /// @notice the ERC721 token address of the vault's token
    address private token;

    /// @notice The project's funding address where stable coins are to be sent
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

    address[] private funderAddresses;

    uint256 private remaining;
    uint256 private supply;
    uint256 private totalFunding;
    uint256 private totalValue;

    bool private overFunded;

    /// @notice An event emitted when a listing starts
    event Start(address starter, uint256 value);

    /// @notice An event emitted when bid happens
    event Bid(address bidder, uint256 amount);

    event CannotBidWhenPaused();

    /// @notice An event emitted when end happens
    event End();

    modifier isOwner() {
        if (msg.sender != owner)
            revert("Sender is not the project owner.");
        _;
    }

    modifier timeTransition() {
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

    function getSupply() public view returns(uint256) {
        return supply;
    }

    function getTotalBoughtAmount() public view returns (uint256) {
        return supply - remaining;
    }

    function getTotalFunding() public view returns (uint256) {
        return totalFunding;
    }

    function getFunderAddresses() public view returns(address[] memory) {
        return funderAddresses;
    }

    function isOverFunded() public view returns(bool) {
        return overFunded;
    }

    function getListingPrice() public view returns(uint256) {
        return listingPrice;
    }

    function initialize(address _token, address payable _projectFundingAddress, address _owner,
        uint256 _supply, uint256 _listingPrice, string memory _name, string memory _symbol,
        address[] memory _funderAddresses, uint256[] memory allocations) external initializer {
        // initialize inherited contracts
        __ERC20_init(_name, _symbol);
        __ERC721Holder_init();
        // set storage variables
        token = _token;
        projectFundingAddress = _projectFundingAddress;
        owner = _owner;
        listingPeriod = 3 days;
        listingState = OfferingState.inactive;
        listingPrice = _listingPrice;
        require(_createFundersMapping(_funderAddresses, allocations) == _supply,
            "Given supply is not equal to the sum of allocations");
        _mint(projectFundingAddress, _supply);
        remaining = _supply;
        supply = _supply;
        totalValue = _supply * listingPrice;
    }

    function _createFundersMapping(address[] memory _funderAddresses, uint[] memory allocations) private returns (uint) {
        require(_funderAddresses.length == allocations.length, "Funders and allocation array sizes cannot be different");
        uint total = 0;
        address funderAddress;
        for (uint i = 0; i < _funderAddresses.length; i++) {
            funderAddress = _funderAddresses[i];
            funders[funderAddress] = allocations[i];
            funderAddresses.push(funderAddress);
            total += allocations[i];
        }
        return total;
    }

    /// @notice Start the offering
    function start() external payable isOwner {
        require(listingState == OfferingState.inactive, "Offering is already live");
        listingEnd = block.timestamp + listingPeriod;
        listingState = OfferingState.live;
        emit Start(msg.sender, msg.value);
    }

    /// @notice an external function to bid on purchasing the vaults NFT. The msg.value is the bid amount
    function bid(uint _amount) external payable timeTransition {
        require(listingState == OfferingState.live, "Offering is not live.");
            require(!paused(), "The bid is paused.");
        require(msg.value > 0, "Funds sent cannot be zero.");
        require(_amount > 0, "Bid amount cannot be zero.");
        require(funders[msg.sender] > 0, "Address is not allowed to participate in the offering.");
        require(funders[msg.sender] >= _amount, "Bid is more than allocated for this address.");
        require(_amount * listingPrice <= msg.value, "Funds sent for bid is less than the total capital required to buy the amount.");
        require(remaining >= _amount, "Remaining is less than the amount that is bid.");
        remaining -= _amount;
        funders[msg.sender] -= funders[msg.sender];
        require(utils.sendStableCoin(msg.sender, projectFundingAddress,
            msg.value), "Could not send the funds to the project offerings address.");
        totalFunding += msg.value;
        IERC20(address(this)).transferFrom(address(this), msg.sender, _amount);
        emit Bid(msg.sender, _amount);
        if (remaining == 0) {
            _end();
        }
        if (totalFunding > totalValue) {
            overFunded = true;
        }
    }

    function _end() internal {
        require(listingState == OfferingState.live, "Offering is already closed.");
        listingState = OfferingState.ended;
        emit End();
    }

    /// @notice an external function to end an auction after the timer has run out
    function end() external isOwner {
        _end();
    }

    function pause() external isOwner {
        _pause();
    }

    function unpause() external isOwner {
        _unpause();
    }

    function _msgData() internal view override(Context, ContextUpgradeable) returns (bytes memory) {
        return ContextUpgradeable._msgData();
    }

    function _msgSender() internal view override(Context, ContextUpgradeable) returns (address) {
        return ContextUpgradeable._msgSender();
    }
}
