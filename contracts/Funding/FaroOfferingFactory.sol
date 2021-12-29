//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./FaroOffering.sol";
import "./Proxy.sol";


contract FaroOfferingFactory is Ownable, Pausable {

    uint256 private vaultCount;

    uint private ID = 1;

    address[] public vaults;
     

    address logic = address(new FaroOffering());

    event Mint(address indexed token, uint256 price, address vault, uint256 vaultId);

    function mint(address _token, address payable _projectFundingAddress, address _owner,
        uint256 _supply, uint256 _listPrice, uint _listingPeriod,
        string memory _name, string memory _symbol, address[] memory _funderAddresses,
        uint256[] memory _allocations) external onlyOwner whenNotPaused returns(uint256) {

        bytes memory _initializationCalldata = abi.encodeWithSignature(
            "initialize(address,address,address,uint256,uint256,uint256,string,string,address[],uint256[])",
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

        address vault = address(new InitializedProxy(logic, _initializationCalldata));
        IERC721(_token).safeTransferFrom(_projectFundingAddress, vault, ID);
        vaults.push(vault);
        vaultCount++;
        emit Mint(_token, _listPrice, vault, vaultCount);
        return vaultCount - 1;
    }

    function getLastVault() public view returns (address) {
        return vaults[vaultCount - 1];
    }

    function getNumOfTokens() public view returns (uint256) {
        return vaultCount;
    }

    function getVault(uint256 vaultNum) public view returns (address) {
        return vaults[vaultNum];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

}
