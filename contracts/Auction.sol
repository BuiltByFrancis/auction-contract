// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Auction is Ownable, IERC721Receiver {
    event NewHighestBid(address indexed bidder, uint256 indexed bid);

    error WithdrawComplete();
    error AuctionRunning();
    error AuctionClosed();
    error BidTooLow();

    uint256 private constant _PRIZE_ID = 1;

    uint256 public constant TICK_SIZE = 1000 * 10**18;
    uint64 public constant TIME_EXTENSION = 60;

    IERC20 public immutable tokenContract;
    IERC721 public immutable rewardContract;

    struct AuctionData {
        address winner;
        uint32 ticks;
        uint64 endTimestamp;
    }
    AuctionData public auctionData;

    constructor(
        IERC20 _tokenContract,
        IERC721 _rewardContact,
        uint64 _endTimestamp
    ) {
        tokenContract = _tokenContract;
        rewardContract = _rewardContact;

        auctionData.endTimestamp = _endTimestamp;
    }

    function winnerAmount() external view returns (uint256) {
        return _calcAmount(auctionData.ticks);
    }

    function bid(uint32 ticks) external {
        AuctionData memory data = auctionData;

        if (block.timestamp >= data.endTimestamp) revert AuctionClosed();

        uint256 currentAmount = _calcAmount(data.ticks);
        uint256 amount = _calcAmount(ticks);

        if (amount <= currentAmount) revert BidTooLow();
        if (!tokenContract.transferFrom(msg.sender, address(this), amount)) revert();

        if (!(data.winner == address(0) || tokenContract.transfer(data.winner, currentAmount))) revert();

        if (data.endTimestamp - block.timestamp <= TIME_EXTENSION) {
            unchecked {
                data.endTimestamp += TIME_EXTENSION;
            }
        }

        data.winner = msg.sender;
        data.ticks = ticks;

        auctionData = data;

        emit NewHighestBid(msg.sender, amount);
    }

    function withdraw() external {
        AuctionData memory data = auctionData;

        if (block.timestamp < data.endTimestamp) revert AuctionRunning();
        if (data.winner == address(0)) revert WithdrawComplete();

        delete auctionData;

        rewardContract.transferFrom(address(this), data.winner, _PRIZE_ID);
    }

    function withdrawContractBalance(address to) external onlyOwner {
        uint256 balance = tokenContract.balanceOf(address(this));
        if (!tokenContract.transfer(to, balance)) revert();
    }

    function withdrawPrize(address to) external onlyOwner {
        rewardContract.transferFrom(address(this), to, _PRIZE_ID);
    }

    function _calcAmount(uint256 ticks) internal pure returns (uint256) {
        return ticks * TICK_SIZE;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
