// scripts/index.js

let wallet = require('ethereumjs-wallet');

async function main () {
    const accounts = await ethers.provider.listAccounts();
    const projectFundingAddress = accounts[0];
    const ethWallet = wallet.default.generate();
    const contractAddress = ethWallet.getAddressString();
    const ethWallet2 = wallet.default.generate();
    const tokenAddress = ethWallet2.getAddressString();
    const TokenFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
    const tokenFactory = await TokenFactory.attach(contractAddress);
    console.log("Attached address %s to contract", contractAddress);

    //string memory _name, string memory _symbol, address _projectFundingAddress,
    //         address _token, uint256 _id,
    //         uint256 _supply, uint256 _listPrice, address[] memory _funderAddresses,
    //         uint[] memory _allocations

    const movieName = "KTLO Journey Starting";
    const tokenSymbol = "KTLOM";
    const _id = 1;
    const _supply = 10000000;
    const _listPrice = 5;
    const participantsNum = 10000;
    let funderAddresses = [];
    let allocations = [];
    let etherWallet3;
    const fairAlloc = Math.floor(_supply / participantsNum);

    for (let i = 0; i < participantsNum; i++) {
        etherWallet3 = wallet.default.generate();
        funderAddresses.push(etherWallet3.getAddressString());
        allocations.push(fairAlloc);
    }

    console.log("Will create an NFT vault");
    const firstTokenIndex = await tokenFactory.mint(movieName, tokenSymbol, projectFundingAddress,
        tokenAddress, _id, _supply, _listPrice, funderAddresses, allocations);
    console.log("First NFT with supply was created %i", firstTokenIndex);

    console.log("Checking the created NFTs contract ID");
    const tokenAddressAsInt = tokenFactory.viewTokenWithID(firstTokenIndex);
    console.log("Here is the vault address as stored in the factory %i", tokenAddressAsInt);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

