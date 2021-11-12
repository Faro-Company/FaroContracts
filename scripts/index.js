// scripts/index.js


async function main () {

    const accounts = await ethers.provider.listAccounts();
    const projectFundingAddress = accounts[0];

    const movieName = "KTLO Journey Starting";
    const tokenSymbol = "KTLOM";
    const tokenUri = "here";
    const _id = 1;
    let _supply = 10000000;
    const _listPrice = 5;
    const participantsNum = 100;
    let funderAddresses = [];
    let allocations = [];
    let etherWallet3;
    const fairAlloc = Math.floor(_supply / participantsNum);

    _supply = participantsNum * fairAlloc;

    console.log("Will create fair allocations");

    for (let i = 0; i < participantsNum; i++) {
        etherWallet3 = ethers.Wallet.createRandom();
        funderAddresses.push(etherWallet3.getAddress());
        allocations.push(fairAlloc);
    }

    /*
    const sampleContractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"
    const SampleContract = await ethers.getContractFactory('sample');
    const sampleContract = await SampleContract.attach(sampleContractAddress);
    let sampleTx = await sampleContract.setMessage("Is it working? ");
    console.log("Sample setter tx hash :", sampleTx.hash.toString());
    await sampleTx.wait();
    const res = await sampleContract.getMessage();
    console.log("Sample message: ", res);
    */

    const privateKeyString = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    let wallet = new ethers.Wallet(privateKeyString, ethers.provider);
    let address = await wallet.getAddress();
    console.log("Address of wallet %s", address.toString());

    console.log('Deploying KTLO ownership contract...');
    const KTLOwnershipContract = await ethers.getContractFactory('KTLOwnership');
    const kTLOwnershipContract = await KTLOwnershipContract.deploy(movieName, tokenSymbol, tokenUri);
    await kTLOwnershipContract.deployed();

    const tokenAddress = kTLOwnershipContract.address;

    const erc721ContractWithSigner = kTLOwnershipContract.connect(wallet);
    const mintTx = await erc721ContractWithSigner.mint(projectFundingAddress);
    await mintTx.wait();

    console.log("KTLO movie ownership token contract deployed to ", tokenAddress);

    const tokenVaultFactoryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const TokenFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
    const tokenFactory = await TokenFactory.attach(tokenVaultFactoryAddress);
    console.log("Attached address %s to contract", tokenVaultFactoryAddress);

    console.log("Will create an NFT vault");
    const contractWithSigner = tokenFactory.connect(wallet);

    const approveTx = await erc721ContractWithSigner.setApprovalForAll(tokenVaultFactoryAddress, true);
    await approveTx.wait();

    const tx = await contractWithSigner.mint(tokenAddress, projectFundingAddress,
        _id, _supply, _listPrice, movieName, tokenSymbol, funderAddresses, allocations,
        {
            gasLimit: 9000000
        });
    console.log("Tx hash %s", tx.hash.toString());
    await tx.wait();

    const numOfVaults = await contractWithSigner.getNumOfTokens();
    console.log("Num of vaults in the factory %i", numOfVaults);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

