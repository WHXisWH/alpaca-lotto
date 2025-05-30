pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PacaLuckToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("PacaLuck Token", "PLT") Ownable(initialOwner) {
        _mint(initialOwner, 1000000000 * (10 ** 18)); // Initial supply of 1 Billion PLT (18 decimals)
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}