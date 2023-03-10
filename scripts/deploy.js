const hre = require("hardhat");
const { ethers } = require("hardhat");

const TokenAddress = {
    1: "0x427A03Fb96D9A94A6727fbcfbBA143444090dd64",
    5: "0x3575BB3C035833C916E0700701e1d1087639AFD4",
};

const RewardAddress = {
    1: "0xB1cdf2bFaB043eA1D81d0A73b3b849EFAaC1d31a",
    5: "0x3E32C70294AE7865651236D195f1B6343aF5cE29",
};

const AuctionAddress = {
    1: "",
    5: "0xa6526f13BABD3E50EC3b92D71162710b1880fdD1",
};

async function main() {
    const { chainId } = await ethers.provider.getNetwork();
    if(chainId == 5) {
        await DeployTestToken();
    }

    await DeployAuction(chainId);

    console.log("Done");
}

async function DeployAuction(chainId) {
    var address = AuctionAddress[chainId];
    if (address != "") {
        console.log(`Auction already deployed at ${address}`);
        return;
    }

    const tokenAddress = TokenAddress[chainId];
    const rewardAddress = RewardAddress[chainId];
    const endTimeStamp = 1677263400;

    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy(tokenAddress, rewardAddress, endTimeStamp);

    await auction.deployed();

    AuctionAddress[chainId] = auction.address;
    console.log(`Auction deployed to ${auction.address}`);

    console.log("Sleeping before verify...");
    await sleep(120000);

    await hre.run("verify:verify", {
        address: auction.address,
        constructorArguments: [tokenAddress, rewardAddress, endTimeStamp],
    });
}

async function DeployTestToken() {
    const chainId = 5;
    var address = TokenAddress[chainId];
    if (address != "") {
        console.log(`Token already deployed at ${address}`);
        return;
    }

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();

    await token.deployed();

    TokenAddress[chainId] = token.address;
    console.log(`Token deployed to ${token.address}`);

    console.log("Sleeping before verify...");
    await sleep(120000);

    await hre.run("verify:verify", {
        address: token.address,
        constructorArguments: [],
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
