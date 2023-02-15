const hre = require("hardhat");
const { ethers } = require("hardhat");

const TokenAddress = {
    1: "",
    5: "0x34D7be09C299f2364212c96335467f4dA01b35C7",
};

const RewardAddress = {
    1: "",
    5: "0x3446D487135A59125A27180842a5Bb1899947247",
};

const AuctionAddress = {
    1: "",
    5: "0x79bA52C05b4759c6c65361FE3336C4Ea660D97Ff",
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
    const endTimeStamp = 1676500493;

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
