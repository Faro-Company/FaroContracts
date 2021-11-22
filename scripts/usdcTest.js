const {ethers} = require("hardhat");

async function main () {
    const usdcAbi = [{
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "owner", "type": "address"}, {
            "indexed": true,
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }, {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}],
        "name": "Approval",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{
            "indexed": true,
            "internalType": "address",
            "name": "authorizer",
            "type": "address"
        }, {"indexed": true, "internalType": "bytes32", "name": "nonce", "type": "bytes32"}],
        "name": "AuthorizationCanceled",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{
            "indexed": true,
            "internalType": "address",
            "name": "authorizer",
            "type": "address"
        }, {"indexed": true, "internalType": "bytes32", "name": "nonce", "type": "bytes32"}],
        "name": "AuthorizationUsed",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "_account", "type": "address"}],
        "name": "Blacklisted",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "newBlacklister", "type": "address"}],
        "name": "BlacklisterChanged",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "burner", "type": "address"}, {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }],
        "name": "Burn",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "newMasterMinter", "type": "address"}],
        "name": "MasterMinterChanged",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "minter", "type": "address"}, {
            "indexed": true,
            "internalType": "address",
            "name": "to",
            "type": "address"
        }, {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "Mint",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "minter", "type": "address"}, {
            "indexed": false,
            "internalType": "uint256",
            "name": "minterAllowedAmount",
            "type": "uint256"
        }],
        "name": "MinterConfigured",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "oldMinter", "type": "address"}],
        "name": "MinterRemoved",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{
            "indexed": false,
            "internalType": "address",
            "name": "previousOwner",
            "type": "address"
        }, {"indexed": false, "internalType": "address", "name": "newOwner", "type": "address"}],
        "name": "OwnershipTransferred",
        "type": "event"
    }, {"anonymous": false, "inputs": [], "name": "Pause", "type": "event"}, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "newAddress", "type": "address"}],
        "name": "PauserChanged",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "newRescuer", "type": "address"}],
        "name": "RescuerChanged",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "from", "type": "address"}, {
            "indexed": true,
            "internalType": "address",
            "name": "to",
            "type": "address"
        }, {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}],
        "name": "Transfer",
        "type": "event"
    }, {
        "anonymous": false,
        "inputs": [{"indexed": true, "internalType": "address", "name": "_account", "type": "address"}],
        "name": "UnBlacklisted",
        "type": "event"
    }, {"anonymous": false, "inputs": [], "name": "Unpause", "type": "event"}, {
        "inputs": [],
        "name": "APPROVE_WITH_AUTHORIZATION_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "CANCEL_AUTHORIZATION_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "DECREASE_ALLOWANCE_WITH_AUTHORIZATION_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "DOMAIN_SEPARATOR",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "INCREASE_ALLOWANCE_WITH_AUTHORIZATION_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "PERMIT_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "TRANSFER_WITH_AUTHORIZATION_TYPEHASH",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }],
        "name": "allowance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
        }],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }, {"internalType": "uint256", "name": "value", "type": "uint256"}, {
            "internalType": "uint256",
            "name": "validAfter",
            "type": "uint256"
        }, {"internalType": "uint256", "name": "validBefore", "type": "uint256"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "approveWithAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "authorizer", "type": "address"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }],
        "name": "authorizationState",
        "outputs": [{"internalType": "enum GasAbstraction.AuthorizationState", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_account", "type": "address"}],
        "name": "blacklist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [],
        "name": "blacklister",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "uint256", "name": "_amount", "type": "uint256"}],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "authorizer", "type": "address"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "cancelAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "minter", "type": "address"}, {
            "internalType": "uint256",
            "name": "minterAllowedAmount",
            "type": "uint256"
        }],
        "name": "configureMinter",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [],
        "name": "currency",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {
            "internalType": "uint256",
            "name": "decrement",
            "type": "uint256"
        }],
        "name": "decreaseAllowance",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }, {"internalType": "uint256", "name": "decrement", "type": "uint256"}, {
            "internalType": "uint256",
            "name": "validAfter",
            "type": "uint256"
        }, {"internalType": "uint256", "name": "validBefore", "type": "uint256"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "decreaseAllowanceWithAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {
            "internalType": "uint256",
            "name": "increment",
            "type": "uint256"
        }],
        "name": "increaseAllowance",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }, {"internalType": "uint256", "name": "increment", "type": "uint256"}, {
            "internalType": "uint256",
            "name": "validAfter",
            "type": "uint256"
        }, {"internalType": "uint256", "name": "validBefore", "type": "uint256"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "increaseAllowanceWithAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "string", "name": "tokenName", "type": "string"}, {
            "internalType": "string",
            "name": "tokenSymbol",
            "type": "string"
        }, {"internalType": "string", "name": "tokenCurrency", "type": "string"}, {
            "internalType": "uint8",
            "name": "tokenDecimals",
            "type": "uint8"
        }, {"internalType": "address", "name": "newMasterMinter", "type": "address"}, {
            "internalType": "address",
            "name": "newPauser",
            "type": "address"
        }, {"internalType": "address", "name": "newBlacklister", "type": "address"}, {
            "internalType": "address",
            "name": "newOwner",
            "type": "address"
        }], "name": "initialize", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    }, {
        "inputs": [{"internalType": "string", "name": "newName", "type": "string"}],
        "name": "initializeV2",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_account", "type": "address"}],
        "name": "isBlacklisted",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "isMinter",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "masterMinter",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_to", "type": "address"}, {
            "internalType": "uint256",
            "name": "_amount",
            "type": "uint256"
        }],
        "name": "mint",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "minter", "type": "address"}],
        "name": "minterAllowance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "nonces",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "pause",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [],
        "name": "paused",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "pauser",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
            "internalType": "address",
            "name": "spender",
            "type": "address"
        }, {"internalType": "uint256", "name": "value", "type": "uint256"}, {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "permit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "minter", "type": "address"}],
        "name": "removeMinter",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{
            "internalType": "contract IERC20",
            "name": "tokenContract",
            "type": "address"
        }, {"internalType": "address", "name": "to", "type": "address"}, {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }], "name": "rescueERC20", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    }, {
        "inputs": [],
        "name": "rescuer",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "to", "type": "address"}, {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
        }],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "from", "type": "address"}, {
            "internalType": "address",
            "name": "to",
            "type": "address"
        }, {"internalType": "uint256", "name": "value", "type": "uint256"}],
        "name": "transferFrom",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "newOwner", "type": "address"}],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "from", "type": "address"}, {
            "internalType": "address",
            "name": "to",
            "type": "address"
        }, {"internalType": "uint256", "name": "value", "type": "uint256"}, {
            "internalType": "uint256",
            "name": "validAfter",
            "type": "uint256"
        }, {"internalType": "uint256", "name": "validBefore", "type": "uint256"}, {
            "internalType": "bytes32",
            "name": "nonce",
            "type": "bytes32"
        }, {"internalType": "uint8", "name": "v", "type": "uint8"}, {
            "internalType": "bytes32",
            "name": "r",
            "type": "bytes32"
        }, {"internalType": "bytes32", "name": "s", "type": "bytes32"}],
        "name": "transferWithAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_account", "type": "address"}],
        "name": "unBlacklist",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [],
        "name": "unpause",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_newBlacklister", "type": "address"}],
        "name": "updateBlacklister",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_newMasterMinter", "type": "address"}],
        "name": "updateMasterMinter",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "_newPauser", "type": "address"}],
        "name": "updatePauser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }, {
        "inputs": [{"internalType": "address", "name": "newRescuer", "type": "address"}],
        "name": "updateRescuer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }];

    const cUsdcMainNetAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
    const usdcMock = new ethers.Contract(cUsdcMainNetAddress, usdcAbi, ethers.provider);
    const privateKeyString = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const accounts = await ethers.provider.listAccounts();
    const destAccount = accounts[2];

    let wallet = new ethers.Wallet(privateKeyString, ethers.provider);
    let address = await wallet.getAddress();

    const usdcSigner = usdcMock.connect(wallet);

    const numbUsdcToMint = (500 * 1e6).toString();

    let tx = await usdcSigner.transferFrom(address, destAccount, numbUsdcToMint);
    await tx.wait();

    console.log("USD mint ok");

    const balance =  await usdcSigner.balanceOf(destAccount);
    console.log("USD balance here ", balance.toString());

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
