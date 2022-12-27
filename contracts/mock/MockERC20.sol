// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.15;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory _name, string memory _symbol, uint8 _dec
    ) ERC20(_name, _symbol) {
        _decimals = _dec;
    }

    function mint(address _account, uint256 _amount) public {
        _mint(_account, _amount);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}