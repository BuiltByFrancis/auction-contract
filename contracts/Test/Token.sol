// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint8 private _decimals;
    uint256 public constant maxTotalSupply = 160000000000000000000000000;

    constructor() ERC20("Reward Token", "RT") {
        _mint(msg.sender, maxTotalSupply);
    }
}
