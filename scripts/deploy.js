const { ethers } = require("hardhat");

// scripts/deploy.js
async function main() {
  // We get the contract to deploy

  const FaroTokenContract = await ethers.getContractFactory("FaroToken");
  console.log("Deploying Faro Token contract...");
  const faroTokenContract = await FaroTokenContract.deploy();
  await faroTokenContract.deployed();
  console.log("Faro Token contract deployed to:", faroTokenContract.address);

  const FaroOfferingFactory = await ethers.getContractFactory(
    "FaroOfferingFactory"
  );
  console.log("Deploying OfferingFactory...");
  const faroOfferingFactory = await FaroOfferingFactory.deploy();
  await faroOfferingFactory.deployed();
  console.log(
    "OfferableTokenVaultFactory deployed to:",
    faroOfferingFactory.address
  );

  const FaroEnglishAuctionFactory = await ethers.getContractFactory(
    "FaroEnglishAuctionFactory"
  );
  console.log("Deploying FaroEnglishAuctionFactory");
  const faroEnglishAuctionFactory = await FaroEnglishAuctionFactory.deploy();
  await faroEnglishAuctionFactory.deployed();
  console.log(
    "FaroEnglishAuctionFactory deployed to:",
    faroEnglishAuctionFactory.address
  );

  const FaroDutchAuctionFactory = await ethers.getContractFactory(
    "FaroDutchAuctionFactory"
  );
  console.log("Deploying FaroDutchAuctionFactory");
  const faroDutchAuctionFactory = await FaroDutchAuctionFactory.deploy();
  await faroDutchAuctionFactory.deployed();
  console.log(
    "FaroDutchAuctionFactory deployed to:",
    faroDutchAuctionFactory.address
  );
}

main()
  .then(() => {
    return 0;
  })
  .catch((error) => {
    console.error(error);
    throw error;
  });
