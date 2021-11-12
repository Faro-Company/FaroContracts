// scripts/deploy.js
async function main () {
    // We get the contract to deploy

    const KTLTokenContract = await ethers.getContractFactory('KTLOToken');
    console.log('Deploying KTLO Token contract...');
    const kTLTokenContract = await KTLTokenContract.deploy();
    await kTLTokenContract.deployed();
    console.log("KTLO Token contract deployed to:", kTLTokenContract.address);

    const ERCVaultFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
    console.log('Deploying OfferableTokenVaultFactory...');
    const ercVaultFactory = await ERCVaultFactory.deploy();
    await ercVaultFactory.deployed();
    console.log('OfferableTokenVaultFactory deployed to:', ercVaultFactory.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });