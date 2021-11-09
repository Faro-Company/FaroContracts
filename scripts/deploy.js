// scripts/deploy.js
async function main () {
    // We get the contract to deploy

    const ERCVaultFactory = await ethers.getContractFactory('OfferableERC721VaultFactory');
    console.log('Deploying OfferableTokenVaultFactory...');
    const ercVaultFactory = await ERCVaultFactory.deploy();
    await ercVaultFactory.deployed();
    console.log('OfferableTokenVault deployed to:', ercVaultFactory.address);

    const ERCVault = await ethers.getContractFactory('OfferableERC721TokenVault');
    console.log('Deploying OfferableTokenVault...');
    const ercVault = await ERCVault.deploy();
    await ercVault.deployed();
    console.log('OfferableTokenVault deployed to:', ercVault.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });