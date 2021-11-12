// scripts/deploy.js
async function main () {
    // We get the contract to deploy

    const KTLOwnershipFactoryContract = await ethers.getContractFactory('KTLOwnershipFactory');
    console.log('Deploying KTLO ownership factory contract...');
    const kTLOwnershipFactoryContract = await KTLOwnershipFactoryContract.deploy();
    await kTLOwnershipFactoryContract.deployed();
    console.log("Sample contract deployed to:", kTLOwnershipFactoryContract.address);

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