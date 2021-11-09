//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import "./InitializedProxy.sol";
import "./OfferableERC721TokenVault.sol";

contract OfferableERC721VaultFactory is Ownable, Pausable {
    /// @notice the number of ERC721 vaults
    uint256 public vaultCount;

    /// @notice the mapping of vault number to vault contract
    mapping(uint256 => address) public vaults;

    /// @notice the TokenVault logic contract
    address public immutable logic;

    event Mint(address indexed token, uint256 id, uint256 price, address vault, uint256 vaultId);

    constructor() {
        logic = address(new OfferableTokenVault());
    }

    /// @notice the function to mint a new vault
    /// @param _name the desired name of the vault
    /// @param _symbol the desired sumbol of the vault
    /// @param _token the ERC721 token address to the NFT
    /// @param _id the uint256 ID of the token
    /// @param _listPrice the initial price of the NFT
    /// @return the ID of the vault

    function mint(string memory _name, string memory _symbol, address _projectFundingAddress,
        address _token, uint256 _id,
        uint256 _supply, uint256 _listPrice, address[] memory _funderAddresses,
        uint[] memory _allocations) external whenNotPaused returns(uint256) {
        bytes memory _initializationCalldata =
        abi.encodeWithSignature(
            "initialize(address,address,uint256,uint256,uint256,uint256,string,string)",
            _token,
            _projectFundingAddress,
            _id,
            _supply,
            _listPrice,
            _name,
            _symbol,
            _funderAddresses,
            _allocations
        );

        address vault = address(
            new InitializedProxy(
                logic,
                _initializationCalldata
            )
        );

        emit Mint(_token, _id, _listPrice, vault, vaultCount);

        IERC721(_token).safeTransferFrom(msg.sender, vault, _id);
        vaults[vaultCount] = vault;
        vaultCount++;

        return vaultCount - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

}
