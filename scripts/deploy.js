// scripts/deploy.js
async function main () {
    // We get the contract to deploy
    const Box = await ethers.getContractFactory('OfferableERC721TokenVault');
    console.log('Deploying OfferableTokenVault...');
    const box = await Box.deploy();
    await box.deployed();
    console.log('OfferableTokenVault deployed to:', box.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });