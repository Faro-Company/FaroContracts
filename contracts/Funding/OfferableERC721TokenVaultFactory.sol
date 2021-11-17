//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import "./OfferableERC721TokenVault.sol";


contract OfferableERC721VaultFactory is Ownable, Pausable {
    /// @notice the number of ERC721 vaults
    uint256 public vaultCount;

    /// @notice the mapping of vault number to vault contract
    address[] public vaults;

    event Mint(address indexed token, uint256 id, uint256 price, address vault, uint256 vaultId);

    /// @notice the function to mint a new vault
    /// @param _name the desired name of the vault
    /// @param _symbol the desired sumbol of the vault
    /// @param _token the ERC721 token address to the NFT
    /// @param _id the uint256 ID of the token
    /// @param _listPrice the initial price of the NFT
    /// @return the ID of the vault
    /// address _token, address _projectFundingAddress, uint256 _id,
    //        uint256 _supply, uint256 _listingPrice, string memory _name, string memory _symbol,
    //        address[] memory funderAddresses, uint[] memory allocations
    function mint(address _token, address payable _projectFundingAddress, address _owner,
        uint256 _supply, uint256 _listPrice,
        string memory _name, string memory _symbol, address[] memory _funderAddresses,
        uint[] memory _allocations) external whenNotPaused returns(uint256) {

        OfferableERC721TokenVault vault = new OfferableERC721TokenVault();
        vault.initialize(_token, _projectFundingAddress, _owner, _supply, _listPrice,
            _name, _symbol, _funderAddresses, _allocations);
        address vaultAddress = address(vault);
        IERC721(_token).safeTransferFrom(_projectFundingAddress, vaultAddress, _id);
        vaults.push(vaultAddress);
        vaultCount++;
        emit Mint(_token, _listPrice, vaultAddress, vaultCount);
        return vaultCount - 1;
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
