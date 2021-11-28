pragma solidity ^0.8.0;

contract KTLONFT is ERC721 {

    string baseURI;
    uint256 contentID;

    constructor(string memory _contentName, string memory _symbol,
        string memory _agreementUri, uint256 _contentID) ERC721(_contentName, _symbol) {
        require(bytes(_agreementUri).length > 0, "Need to provide the URI of the agreement");
        baseURI  = _agreementUri;
        contentID = _contentID;
    }

    function mint(address _to) external {
        _mint(_to, 1);
    }

    function getAgreementURI() public view returns (string memory) {
        return baseURI;
    }
}
